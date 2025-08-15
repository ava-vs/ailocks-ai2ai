import { getDeployStore, getStore, Store } from '@netlify/blobs';
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
      // Try getDeployStore first (works in most Netlify environments)
      return getDeployStore(storeName);
    } catch (error) {
      console.error('getDeployStore failed, trying manual configuration:', error);
      
      // Fallback: use getStore with explicit deployID from environment
      const deployID = process.env.NETLIFY_DEPLOY_ID || process.env.deployID;
      
      if (!deployID) {
        console.error('No deployID found in environment variables');
        throw new Error('Blob storage unavailable: missing deployID');
      }
      
      try {
        return getStore({
          name: storeName,
          deployID: deployID
        });
      } catch (fallbackError) {
        console.error('Failed to initialize Netlify Blobs store with manual config:', fallbackError);
        throw new Error('Blob storage unavailable');
      }
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
    const sessionRecord = await store.get(uploadId, { type: 'json' }) as any | null;
    
    if (!sessionRecord) {
      throw new Error('Upload session not found');
    }

    // Verify all chunks are uploaded
    const uploadedChunksSet = new Set<number>(
      Array.isArray(sessionRecord.uploadedChunks)
        ? sessionRecord.uploadedChunks as number[]
        : []
    );
    if (uploadedChunksSet.size !== sessionRecord.expectedChunks) {
      throw new Error('Not all chunks uploaded');
    }

    // Update product with manifest
    await db.update(digitalProducts)
      .set({
        manifest: manifest,
        storagePointer: sessionRecord.storagePrefix,
        updatedAt: new Date(),
      })
      .where(eq(digitalProducts.id, sessionRecord.productId));

    // Clean up upload session
    await store.delete(uploadId);

    return { success: true, productId: sessionRecord.productId };
  }

  // Product Management
  async createProduct(
    ownerAilockId: string,
    title: string,
    contentType: string,
    size: number,
    contentHash: string,
    // Расширенные поля продукта
    description?: string,
    shortDescription?: string,
    price?: string | number, // Может быть строкой или числом для numeric в БД
    currency?: string,
    status?: string,
    category?: string,
    tags?: string[],
    licenseType?: string,
    licenseTerms?: string,
    previewContent?: string,
    thumbnailUrl?: string,
    demoUrl?: string,
    version?: string,
    changelog?: any,
    requirements?: any,
    seoTitle?: string,
    seoDescription?: string,
    seoKeywords?: string[],
    featured?: boolean,
    policy?: any
  ): Promise<string> {
    // Создаем объект, соответствующий схеме digitalProducts
    // Обязательные поля
    const insertValues = {
      ownerAilockId,
      title,
      contentType,
      size,
      contentHash,
      encryptionAlgo: 'AES-256-GCM' as const,
      storageType: 'netlify_blobs' as const,
      storagePointer: 'pending', // Will be set during upload completion
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Добавляем опциональные поля, если они предоставлены
    // Используем частичный тип для опциональных полей
    const optionalFields: Partial<typeof digitalProducts.$inferInsert> = {};

    if (description !== undefined) optionalFields.description = description;
    if (shortDescription !== undefined) optionalFields.shortDescription = shortDescription;
    
    // Преобразуем price в строку для numeric типа в БД
    if (price !== undefined) optionalFields.price = String(price);
    
    if (currency !== undefined) optionalFields.currency = currency;
    if (status !== undefined) optionalFields.status = status as any; // Используем as any для совместимости с enum
    if (category !== undefined) optionalFields.category = category;
    if (tags !== undefined && Array.isArray(tags)) optionalFields.tags = tags;
    if (licenseType !== undefined) optionalFields.licenseType = licenseType as any; // Используем as any для совместимости с enum
    if (licenseTerms !== undefined) optionalFields.licenseTerms = licenseTerms;
    if (previewContent !== undefined) optionalFields.previewContent = previewContent;
    if (thumbnailUrl !== undefined) optionalFields.thumbnailUrl = thumbnailUrl;
    if (demoUrl !== undefined) optionalFields.demoUrl = demoUrl;
    if (version !== undefined) optionalFields.version = version;
    
    // JSON поля
    if (changelog !== undefined) optionalFields.changelog = changelog;
    if (requirements !== undefined) optionalFields.requirements = requirements;
    
    // SEO поля
    if (seoTitle !== undefined) optionalFields.seoTitle = seoTitle;
    if (seoDescription !== undefined) optionalFields.seoDescription = seoDescription;
    if (seoKeywords !== undefined && Array.isArray(seoKeywords)) optionalFields.seoKeywords = seoKeywords;
    if (featured !== undefined) optionalFields.featured = featured;
    
    // Добавляем дату публикации, если статус published
    if (status === 'published') optionalFields.publishedAt = new Date();

    // Объединяем обязательные и опциональные поля
    const fullInsertValues = {
      ...insertValues,
      ...optionalFields
    };

    // Выполняем вставку с подготовленными данными
    // Теперь storageRef удален из схемы, поэтому нет необходимости его исключать
    const [product] = await db.insert(digitalProducts)
      .values(fullInsertValues)
      .returning({ id: digitalProducts.id });
      
    return product.id;
  }

  async getProduct(productId: string): Promise<DigitalProduct | null> {
    const [product] = await db.select({
      id: digitalProducts.id,
      ownerAilockId: digitalProducts.ownerAilockId,
      title: digitalProducts.title,
      contentType: digitalProducts.contentType,
      size: digitalProducts.size,
      encryptionAlgo: digitalProducts.encryptionAlgo,
      contentHash: digitalProducts.contentHash,
      storageType: digitalProducts.storageType,
      storagePointer: digitalProducts.storagePointer,
      manifest: digitalProducts.manifest,
      price: digitalProducts.price,
      currency: digitalProducts.currency,
      status: digitalProducts.status,
      createdAt: digitalProducts.createdAt
    })
      .from(digitalProducts)
      .where(eq(digitalProducts.id, productId))
      .limit(1);

    if (!product) return null;
    
    return {
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
      createdAt: product.createdAt || new Date(),
    };
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

    // Check if there's a valid transfer (paid or claimed)
    const [transfer] = await db.select({
      id: productTransfers.id,
      status: productTransfers.status
    })
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
      console.log(`No valid transfer found for product ${productId} and user ${ailockId}`);
      return false;
    }

    console.log(`Found valid transfer with status ${transfer.status} for product ${productId} and user ${ailockId}`);

    // Check if there's a valid key envelope
    const [key] = await db.select({
      id: productKeys.id,
      expiresAt: productKeys.expiresAt
    })
      .from(productKeys)
      .where(
        and(
          eq(productKeys.productId, productId),
          eq(productKeys.recipientAilockId, ailockId)
        )
      )
      .limit(1);

    const keyValid = !!key && new Date(key.expiresAt) > new Date();
    console.log(`Key validation result: ${keyValid ? 'valid' : 'invalid'} for product ${productId} and user ${ailockId}`);
    
    return keyValid;
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

