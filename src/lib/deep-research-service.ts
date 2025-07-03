import type { AilockSkill } from './ailock/shared';
import { aiService } from './ai-service';

export interface ResearchSource {
  title: string;
  authors?: string[];
  year?: number;
  url: string;
  snippet: string;
  sourceType: 'academic' | 'web' | 'news' | 'patent';
  relevanceScore: number;
  citationCount?: number;
  doi?: string;
}

export interface ResearchReport {
  query: string;
  sources: ResearchSource[];
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  confidence: number;
  timestamp: Date;
}

export interface DeepResearchOptions {
  maxSources: number;
  includeAcademic: boolean;
  includeWeb: boolean;
  includePatents: boolean;
  language: string;
  researchDepth: 'basic' | 'comprehensive' | 'expert';
}

export class DeepResearchService {
  private readonly SEMANTIC_SCHOLAR_BASE = 'https://api.semanticscholar.org/graph/v1';
  private readonly TIMEOUT_MS = 15000;

  async conductResearch(
    query: string, 
    userSkills: AilockSkill[], 
    options: DeepResearchOptions
  ): Promise<ResearchReport> {
    console.log(`🔍 Starting Deep Research for query: "${query}"`);
    
    // Проверяем уровень навыка Deep Research
    const deepResearchSkill = userSkills.find(s => s.skillId === 'deep_research');
    const skillLevel = deepResearchSkill?.currentLevel || 0;
    
    if (skillLevel === 0) {
      throw new Error('Deep Research skill is not unlocked. Please upgrade your semantic_search skill first.');
    }

    // Адаптируем параметры под уровень навыка
    const adaptedOptions = this.adaptOptionsToSkillLevel(options, skillLevel);
    
    const sources: ResearchSource[] = [];
    
    try {
      // 1. Поиск в академических источниках
      if (adaptedOptions.includeAcademic) {
        const academicSources = await this.searchSemanticScholar(query, adaptedOptions.maxSources);
        sources.push(...academicSources);
      }

      // 2. Веб-поиск (симуляция)
      if (adaptedOptions.includeWeb) {
        const webSources = await this.simulateWebSearch(query, Math.min(5, adaptedOptions.maxSources - sources.length));
        sources.push(...webSources);
      }

      // 3. Анализ и синтез результатов
      const report = await this.synthesizeResearchReport(query, sources, adaptedOptions, skillLevel);
      
      console.log(`✅ Deep Research completed: ${sources.length} sources found`);
      return report;

    } catch (error) {
      console.error('Deep Research failed:', error);
      throw new Error(`Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private adaptOptionsToSkillLevel(options: DeepResearchOptions, skillLevel: number): DeepResearchOptions {
    const maxSourcesByLevel = { 1: 3, 2: 10, 3: 20 };
    return {
      ...options,
      maxSources: Math.min(options.maxSources, maxSourcesByLevel[skillLevel as keyof typeof maxSourcesByLevel] || 3)
    };
  }

  private async searchSemanticScholar(query: string, maxResults: number): Promise<ResearchSource[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const searchUrl = `${this.SEMANTIC_SCHOLAR_BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 10)}&fields=title,authors,year,url,abstract,citationCount,externalIds`;
      
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Ailock-DeepResearch/1.0' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Semantic Scholar API returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      const papers = data.data || [];

      return papers.map((paper: any) => ({
        title: paper.title || 'Untitled',
        authors: paper.authors?.map((a: any) => a.name) || [],
        year: paper.year,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        snippet: paper.abstract ? this.truncateText(paper.abstract, 200) : 'No abstract available',
        sourceType: 'academic' as const,
        relevanceScore: this.calculateRelevanceScore(query, paper),
        citationCount: paper.citationCount || 0,
        doi: paper.externalIds?.DOI
      })).filter((source: ResearchSource) => source.title.length > 0);

    } catch (error) {
      console.warn('Semantic Scholar search failed:', error);
      return [];
    }
  }

  private async simulateWebSearch(query: string, maxResults: number): Promise<ResearchSource[]> {
    const webSources = [
      {
        title: `Wikipedia: ${query}`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
        snippet: `Comprehensive overview of ${query} from Wikipedia, the free encyclopedia.`,
        sourceType: 'web' as const,
        relevanceScore: 0.8
      },
      {
        title: `Research Gate: ${query}`,
        url: `https://www.researchgate.net/search?q=${encodeURIComponent(query)}`,
        snippet: `Academic discussions and research papers about ${query} from ResearchGate community.`,
        sourceType: 'web' as const,
        relevanceScore: 0.7
      }
    ];
    return webSources.slice(0, maxResults);
  }

  private async synthesizeResearchReport(
    query: string, 
    sources: ResearchSource[], 
    options: DeepResearchOptions,
    skillLevel: number
  ): Promise<ResearchReport> {
    const sourcesText = sources.map(s => 
      `${s.title} (${s.sourceType}, score: ${s.relevanceScore}): ${s.snippet}`
    ).join('\n\n');

    const systemPrompt = `Вы специалист по анализу исследований. Проанализируйте найденные источники и создайте структурированный отчет на русском языке.

Уровень навыка Deep Research: ${skillLevel}/3
Глубина анализа: ${options.researchDepth}

Требования к отчету:
- Краткое резюме (2-3 предложения)
- Ключевые инсайты (3-5 пунктов)
- Практические рекомендации (2-4 пункта)
- Оценка достоверности (0-100%)

Формат ответа должен быть в JSON:
{
  "summary": "краткое резюме",
  "keyInsights": ["инсайт 1", "инсайт 2", ...],
  "recommendations": ["рекомендация 1", "рекомендация 2", ...],
  "confidence": число от 0 до 100
}`;

    try {
      const response = await aiService.generateWithCostOptimization(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Запрос: ${query}\n\nНайденные источники:\n${sourcesText}\n\nСоздайте исследовательский отчет по этим источникам.` }
        ],
        { 
          complexity: skillLevel >= 2 ? 'complex' : 'medium', 
          budget: 'standard',
          mode: 'analyst',
          language: options.language
        }
      );

      const analysisResult = this.parseAIResponse(response);
      
      return {
        query,
        sources: sources.sort((a, b) => b.relevanceScore - a.relevanceScore),
        summary: analysisResult.summary,
        keyInsights: analysisResult.keyInsights,
        recommendations: analysisResult.recommendations,
        confidence: analysisResult.confidence,
        timestamp: new Date()
      };

    } catch (error) {
      console.warn('AI synthesis failed, using fallback:', error);
      return this.createFallbackReport(query, sources);
    }
  }

  private parseAIResponse(response: string): {
    summary: string;
    keyInsights: string[];
    recommendations: string[];
    confidence: number;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        summary: response.substring(0, 200) + '...',
        keyInsights: ['AI анализ недоступен'],
        recommendations: ['Требуется дополнительное исследование'],
        confidence: 50
      };
    } catch (error) {
      return {
        summary: 'Ошибка анализа данных',
        keyInsights: ['Не удалось проанализировать источники'],
        recommendations: ['Попробуйте переформулировать запрос'],
        confidence: 0
      };
    }
  }

  private createFallbackReport(query: string, sources: ResearchSource[]): ResearchReport {
    return {
      query,
      sources,
      summary: `Найдено ${sources.length} источников по запросу "${query}". Анализ данных временно недоступен.`,
      keyInsights: [
        `Обнаружено ${sources.filter(s => s.sourceType === 'academic').length} академических источников`,
        `Средняя релевантность: ${(sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length * 100).toFixed(0)}%`
      ],
      recommendations: [
        'Изучите найденные источники подробнее',
        'Попробуйте уточнить поисковый запрос'
      ],
      confidence: 60,
      timestamp: new Date()
    };
  }

  private calculateRelevanceScore(query: string, paper: any): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const title = (paper.title || '').toLowerCase();
    const abstract = (paper.abstract || '').toLowerCase();
    
    let score = 0;
    
    for (const word of queryWords) {
      if (title.includes(word)) score += 0.3;
      if (abstract.includes(word)) score += 0.1;
    }
    
    if (paper.citationCount > 10) score += 0.1;
    if (paper.citationCount > 100) score += 0.1;
    
    return Math.min(1, score);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  async healthCheck(): Promise<{ status: string; services: Record<string, boolean> }> {
    const services: Record<string, boolean> = {};
    
    try {
      const response = await fetch(`${this.SEMANTIC_SCHOLAR_BASE}/paper/search?query=test&limit=1`, {
        signal: AbortSignal.timeout(5000)
      });
      services.semanticScholar = response.ok;
    } catch {
      services.semanticScholar = false;
    }
    
    const allHealthy = Object.values(services).every(Boolean);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services
    };
  }
}

export const deepResearchService = new DeepResearchService(); 