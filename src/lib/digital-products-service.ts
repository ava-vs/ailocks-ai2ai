import { getDeployStore, Store } from '@netlify/blobs';
import { db } from './db';
import { digitalProducts, productTransfers, productKeys, paymentIntents, deliveryReceipts, contentChecks } from './schema';
import { eq, and } from 'drizzle-orm';

// Types for chunked upload/download
export interface ChunkManifest {
  chunks: Array<{
    index: number;
    hash: string;
    size: number;
  }>;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  contentHash: string;
}

export interface UploadSession {
  uploadId: string;
  productId: string;
  storagePrefix: string;
  chunkSize: number;
  expectedChunks: number;
  uploadedChunks: Set<number>;
  createdAt: Date;
}

export interface DigitalProduct {
  id: string;
  ownerAilockId: string;
  title: string;
  contentType: string;
  size: number;
  encryptionAlgo: string;
  contentHash: string;
  storageType: string;
  storagePointer: string; 
  manifest: ChunkManifest | null;
  createdAt: Date;
}

export interface ProductTransfer {
  id: string;
  productId: string;
  fromAilockId: string;
  toAilockId: string;
  price: string | null;
  currency: string;
  status: string;
  policy: any;
  createdAt: Date;
  updatedAt: Date;
}

export class DigitalProductsService {
  private getStoreInstance(storeName: string = 'digital-products'): Store {
    try {
      return getDeployStore(storeName);
    } catch (error) {
      console.error('Failed to initialize Netlify Blobs store:', error);
      throw new Error('Blob storage unavailable');
    }
  }

  // Chunked Upload Management
  async initializeUpload(
    productId: string,
    totalSize: number,
    chunkSize: number = 4 * 1024 * 1024 // 4MB default
  ): Promise<{ uploadId: string; storagePrefix: string; chunkSize: number; expectedChunks: number }> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const storagePrefix = `products/${productId}/chunks/${uploadId}`;
    const expectedChunks = Math.ceil(totalSize / chunkSize);

    const session: UploadSession = {
      uploadId,
      productId,
      storagePrefix,
      chunkSize,
      expectedChunks,
      uploadedChunks: new Set(),
      createdAt: new Date(),
    };

    // Store upload session metadata in blobs
    const store = this.getStoreInstance('upload-sessions');
    await store.setJSON(uploadId, session);

    return { uploadId, storagePrefix, chunkSize, expectedChunks };
  }

  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<{ success: boolean; chunkHash: string }> {
    const store = this.getStoreInstance('upload-sessions');
    const sessionData = await store.get(uploadId, { type: 'json' }) as UploadSession | null;
    
    if (!sessionData) {
      throw new Error('Upload session not found');
    }

    if (chunkIndex >= sessionData.expectedChunks) {
      throw new Error('Invalid chunk index');
    }

    // Calculate chunk hash
    const crypto = await import('crypto');
    const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');

    // Store chunk data
    const chunkStore = this.getStoreInstance();
    const chunkKey = `${sessionData.storagePrefix}/chunk_${chunkIndex.toString().padStart(4, '0')}`;
    await chunkStore.set(chunkKey, chunkData);

    // Update session with uploaded chunk
    sessionData.uploadedChunks.add(chunkIndex);
    await store.setJSON(uploadId, sessionData);

    return { success: true, chunkHash };
  }

  async completeUpload(
    uploadId: string,
    manifest: ChunkManifest
  ): Promise<{ success: boolean; productId: string }> {
    const store = this.getStoreInstance('upload-sessions');
    const sessionData = await store.get(uploadId, { type: 'json' }) as UploadSession | null;
    
    if (!sessionData) {
      throw new Error('Upload session not found');
    }

    // Verify all chunks are uploaded
    if (sessionData.uploadedChunks.size !== sessionData.expectedChunks) {
      throw new Error('Not all chunks uploaded');
    }

    // Update product with manifest
    await db.update(digitalProducts)
      .set({
        manifest: manifest,
        storagePointer: sessionData.storagePrefix,
      })
      .where(eq(digitalProducts.id, sessionData.productId));

    // Clean up upload session
    await store.delete(uploadId);

    return { success: true, productId: sessionData.productId };
  }

  // Product Management
  async createProduct(
    ownerAilockId: string,
    title: string,
    contentType: string,
    size: number,
    contentHash: string
  ): Promise<string> {
    const [product] = await db.insert(digitalProducts).values({
      ownerAilockId,
      title,
      contentType,
      size,
      contentHash,
      encryptionAlgo: 'AES-256-GCM',
      storageType: 'netlify_blobs',
      storagePointer: 'pending', // Will be set during upload completion
    }).returning({ id: digitalProducts.id });

    return product.id;
  }

  async getProduct(productId: string): Promise<DigitalProduct | null> {
    const [product] = await db.select()
      .from(digitalProducts)
      .where(eq(digitalProducts.id, productId))
      .limit(1);

    return product ? {
      id: product.id,
      ownerAilockId: product.ownerAilockId,
      title: product.title,
      contentType: product.contentType,
      size: product.size,
      encryptionAlgo: product.encryptionAlgo || 'AES-256-GCM',
      contentHash: product.contentHash,
      storageType: product.storageType || 'netlify_blobs',
      storagePointer: product.storagePointer || 'pending',
      manifest: product.manifest as ChunkManifest | null,
      createdAt: product.createdAt!,
    } : null;
  }

  // Chunked Download
  async getProductManifest(
    productId: string,
    requestingAilockId: string
  ): Promise<ChunkManifest | null> {
    // Verify access rights
    const hasAccess = await this.verifyDownloadAccess(productId, requestingAilockId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    const product = await this.getProduct(productId);
    return product?.manifest || null;
  }

  async downloadChunk(
    productId: string,
    chunkIndex: number,
    requestingAilockId: string
  ): Promise<Buffer | null> {
    // Verify access rights
    const hasAccess = await this.verifyDownloadAccess(productId, requestingAilockId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    const product = await this.getProduct(productId);
    if (!product || !product.manifest || !product.storagePointer || product.storagePointer === 'pending') {
      return null;
    }

    if (chunkIndex >= product.manifest.totalChunks) {
      throw new Error('Invalid chunk index');
    }

    const store = this.getStoreInstance();
    const chunkKey = `${product.storagePointer}/chunk_${chunkIndex.toString().padStart(4, '0')}`;
    
    const chunkData = await store.get(chunkKey, { type: 'arrayBuffer' });
    return chunkData ? Buffer.from(chunkData) : null;
  }

  // Access Control
  private async verifyDownloadAccess(productId: string, ailockId: string): Promise<boolean> {
    // Check if user is the owner
    const product = await this.getProduct(productId);
    if (product?.ownerAilockId === ailockId) {
      return true;
    }

    // Check if there's a valid paid transfer
    const [transfer] = await db.select()
      .from(productTransfers)
      .where(
        and(
          eq(productTransfers.productId, productId),
          eq(productTransfers.toAilockId, ailockId),
          eq(productTransfers.status, 'paid')
        )
      )
      .limit(1);

    if (!transfer) {
      return false;
    }

    // Check if there's a valid key envelope
    const [key] = await db.select()
      .from(productKeys)
      .where(
        and(
          eq(productKeys.productId, productId),
          eq(productKeys.recipientAilockId, ailockId)
        )
      )
      .limit(1);

    return !!key && new Date(key.expiresAt) > new Date();
  }

  // Transfer Management
  async createTransfer(
    productId: string,
    fromAilockId: string,
    toAilockId: string,
    price?: number,
    currency: string = 'USD'
  ): Promise<string> {
    const [transfer] = await db.insert(productTransfers).values({
      productId,
      fromAilockId,
      toAilockId,
      price: price?.toString(),
      currency,
      status: 'offered',
    }).returning({ id: productTransfers.id });

    return transfer.id;
  }

  async updateTransferStatus(transferId: string, status: string): Promise<void> {
    await db.update(productTransfers)
      .set({ 
        status: status as any,
        updatedAt: new Date(),
      })
      .where(eq(productTransfers.id, transferId));
  }

  // Key Management
  async createProductKey(
    productId: string,
    recipientAilockId: string,
    keyEnvelope: string,
    expiresAt: Date
  ): Promise<string> {
    const [key] = await db.insert(productKeys).values({
      productId,
      recipientAilockId,
      keyEnvelope,
      expiresAt,
    }).returning({ id: productKeys.id });

    return key.id;
  }

  // Delivery Receipt
  async createDeliveryReceipt(
    transferId: string,
    clientHash: string,
    signature: string,
    meta: any = {}
  ): Promise<string> {
    const [receipt] = await db.insert(deliveryReceipts).values({
      transferId,
      clientHash,
      signature,
      meta,
    }).returning({ id: deliveryReceipts.id });

    // Update transfer status to acknowledged
    await this.updateTransferStatus(transferId, 'acknowledged');

    return receipt.id;
  }

  // Cleanup expired content
  async cleanupExpiredContent(maxAgeHours: number = 24 * 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    try {
      // Find expired products
      const expiredProducts = await db.select()
        .from(digitalProducts)
        .where(eq(digitalProducts.createdAt, cutoffDate)); // This should use a proper date comparison

      const store = this.getStoreInstance();
      
      for (const product of expiredProducts) {
        if (product.storagePointer) {
          // Delete all chunks for this product
          const { blobs } = await store.list({ prefix: product.storagePointer });
          for (const blob of blobs) {
            await store.delete(blob.key);
          }
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired content:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const digitalProductsService = new DigitalProductsService();
