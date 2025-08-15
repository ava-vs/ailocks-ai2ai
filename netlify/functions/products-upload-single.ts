import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users, ailocks } from '../../src/lib/schema';
import { comparePassword } from '../../src/lib/auth/auth-utils';
import { eq } from 'drizzle-orm';
import { DigitalProductsService } from '../../src/lib/digital-products-service';
import crypto from 'crypto';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/**
 * Single-call file upload handler for Netlify Blobs
 * 
 * This function combines authentication, initialization, chunking, and upload completion
 * into a single serverless function call to simplify the upload process for tools like Postman.
 * 
 * Request format (multipart/form-data):
 * - email: Seller email for authentication
 * - password: Seller password for authentication
 * - title: Title of the product
 * - file: The file to upload
 * 
 * Optional parameters:
 * - contentType: MIME type (if not provided, will be inferred from file)
 * - chunkSize: Size of chunks in bytes (default: 4MB)
 */
export const handler: Handler = async (event) => {
  const digitalProductsService = new DigitalProductsService();
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headersBase,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse multipart form data
    if (!event.body || !event.isBase64Encoded) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body must be multipart/form-data' })
      };
    }

    // Parse the multipart form data (need the original Content-Type with boundary)
    const contentTypeHeader = event.headers?.['content-type'] || event.headers?.['Content-Type'];
    const formData = await parseMultipartFormData(event.body, event.isBase64Encoded, contentTypeHeader);
    
    // Extract form fields
    const email = formData.fields.email;
    const password = formData.fields.password;
    const title = formData.fields.title;
    
    // Determine content type, with special handling for markdown files
    let contentType = formData.fields.contentType;
    if (!contentType) {
      const file = formData.files[0];
      if (file) {
        if (file.filename?.toLowerCase().endsWith('.md')) {
          contentType = 'text/markdown';
        } else {
          contentType = file.contentType || 'application/octet-stream';
        }
      } else {
        contentType = 'application/octet-stream';
      }
    }
    
    const chunkSize = parseInt(formData.fields.chunkSize || '4194304', 10); // Default 4MB
    
    // Validate required fields
    if (!email || !password || !title) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields: email, password, title' 
        })
      };
    }

    // Validate file
    if (!formData.files || formData.files.length === 0) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No file provided' })
      };
    }

    const file = formData.files[0];
    const fileBuffer = file.content;
    const fileSize = fileBuffer.length;

    // Size validation (200MB limit)
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    if (fileSize > MAX_SIZE) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `File size exceeds maximum limit of ${MAX_SIZE / (1024 * 1024)}MB` 
        })
      };
    }

    // Chunk size validation
    const MAX_CHUNK_SIZE = 4.5 * 1024 * 1024; // 4.5MB
    if (chunkSize > MAX_CHUNK_SIZE) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `Chunk size exceeds maximum limit of ${MAX_CHUNK_SIZE / (1024 * 1024)}MB` 
        })
      };
    }

    // Step 1: Authenticate user
    console.log('Single upload: authenticating user', { email });
    const userRes = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (userRes.length === 0 || !userRes[0].passwordHash) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const user = userRes[0];
    const valid = await comparePassword(password, user.passwordHash as string);
    if (!valid) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Update last_login
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    // Auth token generation is not needed here
    
    // Step 2: Calculate file hash
    const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    console.log('Single upload: creating product', { 
      title, 
      contentType, 
      size: fileSize,
      userId: user.id 
    });

    // Get user's Ailock ID from the 'ailocks' table by userId
    const ailockRows = await db
      .select({ ailockId: ailocks.id })
      .from(ailocks)
      .where(eq(ailocks.userId, user.id))
      .limit(1);
    const ailockData = ailockRows[0];
    
    if (!ailockData?.ailockId) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'User does not have an associated Ailock ID' 
        })
      };
    }
    
    // Step 3: Create product record
    const ownerAilockId = ailockData.ailockId;
    console.log('Single upload: using owner ailock ID', { ownerAilockId });
    
    const productId = await digitalProductsService.createProduct(
      ownerAilockId,
      title,
      contentType,
      fileSize,
      contentHash
    );

    // Step 4: Initialize upload session
    const uploadSession = await digitalProductsService.initializeUpload(
      productId,
      fileSize,
      chunkSize
    );

    console.log('Upload session created:', { 
      productId, 
      uploadId: uploadSession.uploadId,
      expectedChunks: uploadSession.expectedChunks 
    });

    // Step 5: Split file into chunks and upload each chunk
    const expectedChunks = uploadSession.expectedChunks;
    const chunks: Array<{ index: number; hash: string; size: number }> = [];

    for (let i = 0; i < expectedChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      const chunkBuffer = fileBuffer.slice(start, end);
      
      // Upload chunk
      const result = await digitalProductsService.uploadChunk(
        uploadSession.uploadId,
        i,
        chunkBuffer
      );
      
      // Store chunk info for manifest
      chunks.push({
        index: i,
        hash: result.chunkHash,
        size: chunkBuffer.length
      });
      
      console.log(`Uploaded chunk ${i+1}/${expectedChunks}`, {
        size: chunkBuffer.length,
        hash: result.chunkHash
      });
    }

    // Step 6: Complete upload with manifest
    const manifest = {
      chunks,
      totalChunks: expectedChunks,
      chunkSize,
      totalSize: fileSize,
      contentHash
    };

    const completeResult = await digitalProductsService.completeUpload(
      uploadSession.uploadId,
      manifest
    );

    console.log('Upload completed successfully:', { 
      uploadId: uploadSession.uploadId, 
      productId: completeResult.productId 
    });

    // Return success response
    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        productId: completeResult.productId,
        title,
        contentType,
        size: fileSize,
        contentHash,
        message: 'File uploaded successfully'
      })
    };

  } catch (error) {
    console.error('Single upload error:', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Parse multipart form data from base64 encoded request body
 * contentTypeHeader must include the original boundary, e.g.:
 *   multipart/form-data; boundary=----WebKitFormBoundaryxyz
 */
async function parseMultipartFormData(
  body: string,
  isBase64Encoded: boolean,
  contentTypeHeader?: string
): Promise<{
  fields: Record<string, string>;
  files: Array<{
    fieldName: string;
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}> {
  // Decode base64 if needed
  const rawBody = isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body);
  
  // Import busboy dynamically to avoid bundling issues
  const { default: Busboy } = await import('busboy');
  
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: Array<{
      fieldName: string;
      filename: string;
      contentType: string;
      content: Buffer;
    }> = [];
    
    // Validate and use the actual Content-Type header (must include boundary)
    const ct = contentTypeHeader || '';
    if (!/multipart\/form-data;.*boundary=/i.test(ct)) {
      return reject(new Error('Invalid or missing Content-Type header with boundary for multipart/form-data'));
    }
    
    const busboy = Busboy({ headers: { 'content-type': ct } });
    
    busboy.on('field', (fieldname: string, val: string) => {
      fields[fieldname] = val;
    });
    
    busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: any) => {
      const { filename, mimeType } = info as { filename: string; mimeType: string };
      const chunks: Buffer[] = [];
      
      file.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      file.on('end', () => {
        files.push({
          fieldName: fieldname,
          filename: filename,
          contentType: mimeType,
          content: Buffer.concat(chunks)
        });
      });
    });
    
    busboy.on('finish', () => {
      resolve({ fields, files });
    });
    
    busboy.on('error', (error) => {
      reject(error);
    });
    
    busboy.write(rawBody);
    busboy.end();
  });
}
