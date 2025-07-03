import { aiService } from './ai-service';
import { db } from './db';
import { smartChains, chainSteps, intents } from './schema';
import { eq } from 'drizzle-orm';

export interface ChainStep {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  estimated_hours: number;
  dependencies: string[];
  deliverable: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface Intent {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredSkills?: string[] | null;
  budget?: number | null;
  timeline?: string | null;
}

export class SmartChainBuilder {
  async decomposeIntent(intent: Intent): Promise<ChainStep[]> {
    const prompt = `
You are an expert project manager and AI assistant. Decompose this complex intent into sequential, actionable steps that can be executed by different collaborators.

INTENT DETAILS:
Title: ${intent.title}
Description: ${intent.description}
Category: ${intent.category}
Budget: ${intent.budget ? `$${Math.floor(intent.budget / 100)}` : 'Flexible'}
Skills Needed: ${intent.requiredSkills?.join(', ') || 'Not specified'}
Timeline: ${intent.timeline || 'Not specified'}

REQUIREMENTS:
1. Break down into 3-8 logical steps
2. Each step should be completable by 1-2 people
3. Estimate realistic hours for each step
4. Identify dependencies between steps
5. Specify concrete deliverables
6. Consider the budget and timeline constraints

Return a JSON array of steps with this EXACT format:
[
  {
    "id": "step_1",
    "title": "Brief step title (max 50 chars)",
    "description": "Specific actionable description with clear requirements and acceptance criteria",
    "required_skills": ["skill1", "skill2"],
    "estimated_hours": 10,
    "dependencies": [],
    "deliverable": "Concrete output description (e.g., 'Wireframes in Figma', 'API documentation', 'Test results report')"
  }
]

Focus on practical, executable steps that move the project forward efficiently.
`;

    try {
      // Use free model for decomposition to save costs
      const response = await aiService.generateWithCostOptimization(
        [{ role: 'user', content: prompt }],
        { complexity: 'medium', budget: 'free', mode: 'analyst' }
      );
      
      // Clean and parse the response
      const cleanedResponse = this.cleanJsonResponse(response);
      const steps = JSON.parse(cleanedResponse);
      
      // Validate and sanitize the steps
      return this.validateAndSanitizeSteps(steps);
    } catch (error) {
      console.error('Failed to decompose intent:', error);
      
      // Fallback to basic decomposition
      return this.createFallbackSteps(intent);
    }
  }

  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks and extra text
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find the JSON array
    const jsonStart = cleaned.indexOf('[');
    const jsonEnd = cleaned.lastIndexOf(']') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd);
    }
    
    return cleaned;
  }

  private validateAndSanitizeSteps(steps: any[]): ChainStep[] {
    if (!Array.isArray(steps)) {
      throw new Error('Invalid steps format');
    }

    return steps.map((step, index) => ({
      id: step.id || `step_${index + 1}`,
      title: (step.title || `Step ${index + 1}`).substring(0, 50),
      description: step.description || 'No description provided',
      required_skills: Array.isArray(step.required_skills) ? step.required_skills.slice(0, 5) : [],
      estimated_hours: typeof step.estimated_hours === 'number' ? Math.max(1, Math.min(200, step.estimated_hours)) : 8,
      dependencies: Array.isArray(step.dependencies) ? step.dependencies : [],
      deliverable: step.deliverable || 'Deliverable to be defined',
      status: 'pending' as const
    }));
  }

  private createFallbackSteps(intent: Intent): ChainStep[] {
    // Create basic steps based on category
    const baseSteps: Partial<ChainStep>[] = [];

    switch (intent.category.toLowerCase()) {
      case 'technology':
        baseSteps.push(
          { title: 'Requirements Analysis', description: 'Define technical requirements and specifications', estimated_hours: 16 },
          { title: 'System Design', description: 'Create system architecture and design documents', estimated_hours: 24 },
          { title: 'Development', description: 'Implement the core functionality', estimated_hours: 80 },
          { title: 'Testing & QA', description: 'Comprehensive testing and quality assurance', estimated_hours: 32 },
          { title: 'Deployment', description: 'Deploy to production environment', estimated_hours: 16 }
        );
        break;
      
      case 'design':
        baseSteps.push(
          { title: 'Research & Discovery', description: 'User research and competitive analysis', estimated_hours: 20 },
          { title: 'Wireframing', description: 'Create wireframes and user flows', estimated_hours: 24 },
          { title: 'Visual Design', description: 'Design high-fidelity mockups', estimated_hours: 32 },
          { title: 'Prototyping', description: 'Create interactive prototypes', estimated_hours: 16 },
          { title: 'Design System', description: 'Develop design system and guidelines', estimated_hours: 20 }
        );
        break;
      
      default:
        baseSteps.push(
          { title: 'Planning & Research', description: 'Initial planning and research phase', estimated_hours: 16 },
          { title: 'Execution Phase 1', description: 'First phase of project execution', estimated_hours: 40 },
          { title: 'Review & Iteration', description: 'Review progress and iterate', estimated_hours: 16 },
          { title: 'Final Delivery', description: 'Complete and deliver final results', estimated_hours: 24 }
        );
    }

    return baseSteps.map((step, index) => ({
      id: `step_${index + 1}`,
      title: step.title || `Step ${index + 1}`,
      description: step.description || 'Step description',
      required_skills: intent.requiredSkills?.slice(0, 3) || ['General'],
      estimated_hours: step.estimated_hours || 16,
      dependencies: index > 0 ? [`step_${index}`] : [],
      deliverable: `Deliverable for ${step.title}`,
      status: 'pending' as const
    }));
  }

  async createSmartChain(intentId: string): Promise<string> {
    try {
      // Get the intent
      const [intent] = await db
        .select()
        .from(intents)
        .where(eq(intents.id, intentId))
        .limit(1);

      if (!intent) {
        throw new Error(`Intent not found: ${intentId}`);
      }

      console.log(`🔗 Creating smart chain for intent: ${intent.title}`);

      // Convert database intent to our Intent interface
      const intentForDecomposition: Intent = {
        id: intent.id,
        title: intent.title,
        description: intent.description,
        category: intent.category,
        requiredSkills: intent.requiredSkills,
        budget: intent.budget,
        timeline: intent.timeline
      };

      // Decompose the intent into steps
      const steps = await this.decomposeIntent(intentForDecomposition);

      // Create the smart chain
      const [chain] = await db.insert(smartChains).values({
        rootIntentId: intentId,
        title: `Smart Chain: ${intent.title}`,
        description: `Automated decomposition of "${intent.title}" into ${steps.length} actionable steps`,
        status: 'planning',
        totalSteps: steps.length,
        completedSteps: 0
      }).returning();

      console.log(`✅ Smart chain created: ${chain.id}`);

      // Create the chain steps
      const chainStepsData = steps.map((step, index) => ({
        chainId: chain.id,
        stepNumber: index + 1,
        title: step.title,
        description: step.description,
        status: step.status,
        estimatedHours: step.estimated_hours,
        requiredSkills: step.required_skills,
        deliverable: step.deliverable,
        dependencies: step.dependencies
      }));

      await db.insert(chainSteps).values(chainStepsData);

      console.log(`✅ Created ${steps.length} chain steps`);

      return chain.id;
    } catch (error) {
      console.error('Failed to create smart chain:', error);
      throw error;
    }
  }

  async getChainProgress(chainId: string): Promise<{
    chain: any;
    steps: any[];
    progress: number;
    nextSteps: any[];
  }> {
    try {
      // Get chain details
      const [chain] = await db
        .select()
        .from(smartChains)
        .where(eq(smartChains.id, chainId))
        .limit(1);

      if (!chain) {
        throw new Error(`Chain not found: ${chainId}`);
      }

      // Get all steps
      const steps = await db
        .select()
        .from(chainSteps)
        .where(eq(chainSteps.chainId, chainId))
        .orderBy(chainSteps.stepNumber);

      // Calculate progress
      const completedSteps = steps.filter(step => step.status === 'completed').length;
      const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

      // Find next available steps (no blocking dependencies)
      const nextSteps = steps.filter(step => {
        if (step.status !== 'pending') return false;
        
        // Check if all dependencies are completed
        const dependencies = step.dependencies || [];
        return dependencies.every(depId => 
          steps.find(s => s.id === depId)?.status === 'completed'
        );
      });

      return {
        chain,
        steps,
        progress: Math.round(progress),
        nextSteps
      };
    } catch (error) {
      console.error('Failed to get chain progress:', error);
      throw error;
    }
  }

  async suggestOptimizations(chainId: string): Promise<string[]> {
    try {
      const { chain, steps } = await this.getChainProgress(chainId);
      
      const prompt = `
Analyze this project chain and suggest optimizations:

CHAIN: ${chain.title}
TOTAL STEPS: ${steps.length}
COMPLETED: ${steps.filter((s: any) => s.status === 'completed').length}

STEPS:
${steps.map((s: any, i: number) => `${i + 1}. ${s.title} (${s.status}) - ${s.estimatedHours}h`).join('\n')}

Suggest 3-5 specific optimizations to improve efficiency, reduce bottlenecks, or enhance collaboration. Focus on practical improvements.

Return as a JSON array of strings:
["optimization 1", "optimization 2", ...]
`;

      const response = await aiService.generateWithCostOptimization(
        [{ role: 'user', content: prompt }],
        { complexity: 'medium', budget: 'free', mode: 'analyst' }
      );

      const optimizations = JSON.parse(this.cleanJsonResponse(response));
      return Array.isArray(optimizations) ? optimizations : [];
    } catch (error) {
      console.error('Failed to suggest optimizations:', error);
      return [
        'Consider parallelizing independent tasks',
        'Review dependencies for potential simplification',
        'Ensure clear deliverables for each step'
      ];
    }
  }
}

export const smartChainBuilder = new SmartChainBuilder();