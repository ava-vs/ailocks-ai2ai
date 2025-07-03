import { db } from './db';
import { intents, offers } from './schema';
import { eq, sql } from 'drizzle-orm';

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class EmbeddingService {
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
  private readonly MODEL = 'text-embedding-3-small';
  private readonly BATCH_SIZE = 100; // Process embeddings in batches

  async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(this.OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text.substring(0, 8000), // Limit text length for cost optimization
          model: this.MODEL,
          encoding_format: 'float'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      // The OpenAI embeddings endpoint returns a list with one embedding object
      // { object: 'list', data: [ { embedding: number[] } ], model: '...', usage: { ... } }
      // We extract data[0].embedding to get raw vector as number[]
      const json = await response.json();

      const embedding: number[] | undefined = json?.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('OpenAI response did not contain a valid embedding');
      }

      return embedding;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('OpenAI API request timed out after 10 seconds');
          throw new Error('OpenAI API timeout');
        }
        console.error('Failed to generate embedding:', error.message);
      } else {
        console.error('Failed to generate embedding:', error);
      }
      throw error;
    }
  }

  async generateAndStoreIntentEmbedding(intentId: string): Promise<void> {
    try {
      // Get the intent data
      const [intent] = await db
        .select()
        .from(intents)
        .where(eq(intents.id, intentId))
        .limit(1);

      if (!intent) {
        throw new Error(`Intent not found: ${intentId}`);
      }

      // Skip if embedding already exists and is recent
      if (intent.embedding && intent.embeddingGeneratedAt) {
        const hoursSinceGenerated = (Date.now() - intent.embeddingGeneratedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceGenerated < 24) {
          console.log(`Embedding for intent ${intentId} is recent, skipping regeneration`);
          return;
        }
      }

      // Create text for embedding (title + description + skills)
      const embeddingText = [
        intent.title,
        intent.description,
        intent.requiredSkills?.join(' ') || '',
        intent.category
      ].filter(Boolean).join(' ');

      console.log(`Generating embedding for intent: ${intent.title.substring(0, 50)}...`);

      // Generate embedding
      const embedding = await this.generateEmbedding(embeddingText);

      // Store in PostgreSQL as array
      await db.update(intents)
        .set({
          embedding: embedding,
          embeddingModel: this.MODEL,
          embeddingGeneratedAt: new Date()
        })
        .where(eq(intents.id, intentId));

      console.log(`✅ Embedding stored for intent ${intentId}`);
    } catch (error) {
      console.error(`Failed to generate/store embedding for intent ${intentId}:`, error);
      throw error;
    }
  }

  async generateAndStoreOfferEmbedding(offerId: string): Promise<void> {
    try {
      // Get the offer data
      const [offer] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, offerId))
        .limit(1);

      if (!offer) {
        throw new Error(`Offer not found: ${offerId}`);
      }

      // Skip if embedding already exists and is recent
      if (offer.embedding && offer.embeddingGeneratedAt) {
        const hoursSinceGenerated = (Date.now() - offer.embeddingGeneratedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceGenerated < 24) {
          console.log(`Embedding for offer ${offerId} is recent, skipping regeneration`);
          return;
        }
      }

      // Create text for embedding
      const embeddingText = [
        offer.title,
        offer.description,
        offer.skills?.join(' ') || '',
        offer.category
      ].filter(Boolean).join(' ');

      console.log(`Generating embedding for offer: ${offer.title.substring(0, 50)}...`);

      // Generate embedding
      const embedding = await this.generateEmbedding(embeddingText);

      // Store in PostgreSQL as array
      await db.update(offers)
        .set({
          embedding: embedding,
          embeddingModel: this.MODEL,
          embeddingGeneratedAt: new Date()
        })
        .where(eq(offers.id, offerId));

      console.log(`✅ Embedding stored for offer ${offerId}`);
    } catch (error) {
      console.error(`Failed to generate/store embedding for offer ${offerId}:`, error);
      throw error;
    }
  }

  async batchGenerateEmbeddings(intentIds: string[]): Promise<void> {
    console.log(`🔄 Batch generating embeddings for ${intentIds.length} intents...`);
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < intentIds.length; i += this.BATCH_SIZE) {
      const batch = intentIds.slice(i, i + this.BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(id => this.generateAndStoreIntentEmbedding(id))
      );
      
      // Rate limiting: wait between batches
      if (i + this.BATCH_SIZE < intentIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Batch embedding generation completed`);
  }

  async findSimilarIntents(queryEmbedding: number[], limit: number = 10, threshold: number = 0.8) {
    try {
      // Guard: if embedding vector is empty or malformed, skip vector search
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        console.warn('⚠️ Empty embedding vector – skipping similarity search');
        return [];
      }

      const vectorAsStr = JSON.stringify(queryEmbedding);
      // Use PostgreSQL vector similarity search with explicit casting
      // Using sql.raw to prevent parameterization of the vector, as it may cause issues with the driver
      const vectorComparison = sql.raw(`embedding <=> CAST('${vectorAsStr}' AS vector)`);

      const results = await db.execute(sql`
        SELECT 
          id, title, description, category, required_skills,
          budget, timeline, priority, created_at, user_id,
          target_country, target_city,
          ${vectorComparison} as similarity_score
        FROM intents 
        WHERE embedding IS NOT NULL 
          AND status = 'active'
          AND ${vectorComparison} < ${1 - threshold}
        ORDER BY ${vectorComparison}
        LIMIT ${limit}
      `);

      return results.rows.map((row: any) => ({
        ...row,
        similarity_score: 1 - row.similarity_score, // Convert distance to similarity
        match_percentage: Math.round((1 - row.similarity_score) * 100)
      }));
    } catch (error) {
      console.error('Vector similarity search failed:', error);
      // Fallback to regular search without embeddings
      return [];
    }
  }

  async searchByText(query: string, limit: number = 10): Promise<any[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Find similar intents using vector search
      return await this.findSimilarIntents(queryEmbedding, limit);
    } catch (error) {
      console.error('Text-based similarity search failed:', error);
      return [];
    }
  }

  // Utility method to check embedding health
  async checkEmbeddingCoverage(): Promise<{
    totalIntents: number;
    withEmbeddings: number;
    coverage: number;
  }> {
    try {
      const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM intents WHERE status = 'active'`);
      const embeddedResult = await db.execute(sql`SELECT COUNT(*) as embedded FROM intents WHERE embedding IS NOT NULL AND status = 'active'`);
      
      const total = parseInt(totalResult.rows[0].total as string);
      const embedded = parseInt(embeddedResult.rows[0].embedded as string);
      const coverage = total > 0 ? (embedded / total) * 100 : 0;

      return {
        totalIntents: total,
        withEmbeddings: embedded,
        coverage: Math.round(coverage)
      };
    } catch (error) {
      console.error('Failed to check embedding coverage:', error);
      return { totalIntents: 0, withEmbeddings: 0, coverage: 0 };
    }
  }
}

export const embeddingService = new EmbeddingService();