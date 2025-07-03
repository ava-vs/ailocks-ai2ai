export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  branch: 'research' | 'collaboration' | 'efficiency' | 'convenience';
  maxLevel: number;
  prerequisites: string[];
  effects: {
    level1: string;
    level2: string;
    level3: string;
  };
}

export const BRANCH_COLORS = {
  research: '#3b82f6',    // Blue-500
  collaboration: '#10b981', // Emerald-500
  efficiency: '#f59e0b',  // Amber-500
  convenience: '#8b5cf6'  // Violet-500
};

export const BRANCH_NAMES = {
  research: 'Research',
  collaboration: 'Collaboration', 
  efficiency: 'Efficiency',
  convenience: 'Convenience'
};

export const SKILL_TREE: Record<string, SkillDefinition> = {
  // Research Branch (Blue)
  semantic_search: {
    id: 'semantic_search',
    name: 'Semantic Search',
    description: 'Improves the relevance and accuracy of all searches.',
    branch: 'research',
    maxLevel: 3,
    prerequisites: [],
    effects: {
      level1: 'Basic keyword and category matching.',
      level2: 'Enabled semantic understanding for deeper context.',
      level3: 'AI predicts search intent for hyper-relevant results.'
    }
  },
  deep_research: {
    id: 'deep_research',
    name: 'Deep Research',
    description: 'Performs comprehensive analysis using multiple data sources.',
    branch: 'research',
    maxLevel: 3,
    prerequisites: ['semantic_search'],
    effects: {
      level1: 'Analyzes up to 3 external sources for reports.',
      level2: 'Cross-references up to 10 sources and identifies patterns.',
      level3: 'Generates detailed reports with cited sources and novel insights.'
    }
  },
  proactive_analysis: {
    id: 'proactive_analysis',
    name: 'Proactive Analysis',
    description: 'Ailock anticipates your needs and suggests relevant information.',
    branch: 'research',
    maxLevel: 3,
    prerequisites: ['deep_research'],
    effects: {
      level1: 'Provides basic suggestions based on current chat context.',
      level2: 'Sends notifications about relevant new opportunities.',
      level3: 'Delivers predictive trend analysis for your field.'
    }
  },

  // Collaboration Branch (Green)
  chain_builder: {
    id: 'chain_builder',
    name: 'Chain Builder',
    description: 'Breaks down complex user requests into manageable project steps.',
    branch: 'collaboration',
    maxLevel: 3,
    prerequisites: [],
    effects: {
      level1: 'Decomposes requests into a simple checklist (3-5 steps).',
      level2: 'Creates detailed project plans with dependencies.',
      level3: 'Dynamically optimizes project plans based on progress.'
    }
  },
  cultural_adaptation: {
    id: 'cultural_adaptation',
    name: 'Cultural Adaptation',
    description: 'Adapts communication style for effective international collaboration.',
    branch: 'collaboration',
    maxLevel: 3,
    prerequisites: ['chain_builder'],
    effects: {
      level1: 'Adjusts tone and formality for different regions.',
      level2: 'Recognizes and adapts to cultural nuances in communication.',
      level3: 'Provides real-time cultural intelligence and advice.'
    }
  },
  predictive_matching: {
    id: 'predictive_matching',
    name: 'Predictive Matching',
    description: 'Uses advanced algorithms to find your perfect collaborator.',
    branch: 'collaboration',
    maxLevel: 3,
    prerequisites: ['cultural_adaptation'],
    effects: {
      level1: 'Calculates a basic compatibility score for potential partners.',
      level2: 'Multi-dimensional matching based on skills, work style, and personality.',
      level3: 'Models the predicted success probability for each potential collaboration.'
    }
  },

  // Efficiency Branch (Amber)
  cost_optimization: {
    id: 'cost_optimization',
    name: 'Cost Optimization',
    description: 'Smartly selects AI models to optimize cost and performance.',
    branch: 'efficiency',
    maxLevel: 3,
    prerequisites: [],
    effects: {
      level1: 'Switches to cheaper models for simple, non-critical tasks.',
      level2: 'Dynamically balances cost vs. performance based on task complexity.',
      level3: 'Predictively models API costs and suggests budget-saving strategies.'
    }
  },
  result_caching: {
    id: 'result_caching',
    name: 'Result Caching',
    description: 'Intelligently caches results to speed up repeated queries.',
    branch: 'efficiency',
    maxLevel: 3,
    prerequisites: ['cost_optimization'],
    effects: {
      level1: 'Caches identical queries for 1 hour.',
      level2: 'Smarter cache invalidation and caches similar queries.',
      level3: 'Predictively pre-computes and caches common follow-up queries.'
    }
  },
  autonomous_actions: {
    id: 'autonomous_actions',
    name: 'Autonomous Actions',
    description: 'Authorizes Ailock to execute routine tasks without intervention.',
    branch: 'efficiency',
    maxLevel: 3,
    prerequisites: ['result_caching'],
    effects: {
      level1: 'Can perform simple, pre-approved actions (e.g., save intent).',
      level2: 'Handles multi-step autonomous workflows that you configure.',
      level3: 'Learns from your behavior to suggest new automations.'
    }
  },

  // Convenience Branch (Purple)
  multi_format_output: {
    id: 'multi_format_output',
    name: 'Multi-Format Output',
    description: 'Generates content in various formats like cards, lists, and tables.',
    branch: 'convenience',
    maxLevel: 3,
    prerequisites: [],
    effects: {
      level1: 'Can format responses as structured lists or text.',
      level2: 'Generates rich formats like summary cards and comparison tables.',
      level3: 'Creates interactive elements and data visualizations in chat.'
    }
  },
  document_generation: {
    id: 'document_generation',
    name: 'Document Generation',
    description: 'Creates professional documents from your conversations.',
    branch: 'convenience',
    maxLevel: 3,
    prerequisites: ['multi_format_output'],
    effects: {
      level1: 'Exports chat summary to a formatted text document.',
      level2: 'Generates structured reports (e.g., project proposals) in PDF format.',
      level3: 'Creates interactive slide decks from project plans.'
    }
  },
  media_creation: {
    id: 'media_creation',
    name: 'Media Creation',
    description: 'Generates images, diagrams, and other media to visualize ideas.',
    branch: 'convenience',
    maxLevel: 3,
    prerequisites: ['document_generation'],
    effects: {
      level1: 'Generates simple diagrams (e.g., Mermaid.js flowcharts).',
      level2: 'Creates custom charts and infographics based on data.',
      level3: 'Generates illustrative images for concepts using DALL-E or similar.'
    }
  }
};

export function getSkillsByBranch(branch: string): SkillDefinition[] {
  return Object.values(SKILL_TREE).filter(skill => skill.branch === branch);
}

export function getSkillPrerequisites(skillId: string): string[] {
  return SKILL_TREE[skillId]?.prerequisites || [];
}

export function canUnlockSkill(skillId: string, unlockedSkills: string[]): boolean {
  const skill = SKILL_TREE[skillId];
  if (!skill) return false;
  if (!skill.prerequisites || skill.prerequisites.length === 0) return true;
  
  return skill.prerequisites.every(prereqId => {
    const prereq = SKILL_TREE[prereqId];
    if (!prereq) return false;
    // For now, let's assume if the skill ID is in the list, it's sufficiently unlocked.
    // A more complex check could require a certain level.
    return unlockedSkills.includes(prereqId);
  });
}

export function getSkillEffect(skillId: string, level: number): string {
  const skill = SKILL_TREE[skillId];
  if (!skill) return 'Unknown skill effect.';
  
  if (level >= 3 && skill.effects.level3) return skill.effects.level3;
  if (level >= 2 && skill.effects.level2) return skill.effects.level2;
  if (level >= 1 && skill.effects.level1) return skill.effects.level1;
  
  return 'No effect at this level.';
}
  