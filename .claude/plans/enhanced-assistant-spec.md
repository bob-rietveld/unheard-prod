> **LEGACY DOCUMENT** - This references superseded architecture (Electron/Mastra/GPT-4o). See README.md for current architecture.

# Enhanced Experiment Assistant Agent

## Complete Implementation Specification

**Date**: 2026-01-29
**Version**: 1.0
**Purpose**: Detailed specification for the conversational AI agent that generates optimal experiment configs

---

## Table of Contents

1. [Overview](#1-overview)
2. [Agent Architecture](#2-agent-architecture)
3. [System Prompt & Instructions](#3-system-prompt--instructions)
4. [Tool Definitions](#4-tool-definitions)
5. [Conversation Flows](#5-conversation-flows)
6. [Context Management](#6-context-management)
7. [Error Handling](#7-error-handling)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Overview

### 1.1 Purpose

The Enhanced Experiment Assistant transforms user intent (natural language) into complete, optimized experiment configurations through intelligent conversation.

**Core Capabilities**:

- Understands ambiguous research goals
- Asks clarifying questions strategically
- Searches and recommends templates
- Generates valid, optimized configs
- Explains choices in plain English
- Iterates based on user feedback
- Suggests follow-up experiments

### 1.2 Design Principles

1. **Template-First**: Always try to match/fork existing template before creating from scratch
2. **Context-Aware**: Knows user's personas, past experiments, preferences
3. **Optimizer-Integrated**: Uses Execution Optimizer for smart defaults
4. **Cost-Conscious**: Shows estimates, suggests cheaper alternatives
5. **Conversational**: Multi-turn dialogue, not single-shot generation
6. **Transparent**: Explains all choices and trade-offs

### 1.3 Performance Goals

- **Response time**: <3s for text responses, <5s for config generation
- **Accuracy**: >90% of generated configs are valid and runnable
- **User satisfaction**: <3 clarifying questions on average
- **Template match rate**: >70% of requests match existing template

---

## 2. Agent Architecture

### 2.1 Mastra Agent Definition

```typescript
// src/mastra/agents/EnhancedExperimentAssistant.ts

import { Agent } from '@mastra/core'
import { z } from 'zod'

export const EnhancedExperimentAssistant = new Agent({
  name: 'enhanced-experiment-assistant',
  model: {
    provider: 'openai',
    name: 'gpt-4o', // Need reasoning capability
    toolChoice: 'auto',
  },
  instructions: SYSTEM_INSTRUCTIONS, // See section 3
  tools: {
    searchTemplateLibrary,
    getTemplateDetails,
    getUserPersonas,
    getUserFocusGroups,
    getUserExperimentHistory,
    validateConfig,
    estimateCost,
    optimizeExecution,
    forkTemplate,
    saveConfig,
  },
})
```

### 2.2 State Management

```typescript
interface ConversationState {
  // User context (loaded once)
  userContext: {
    userId: string
    availablePersonas: Persona[]
    availableFocusGroups: FocusGroup[]
    recentExperiments: Experiment[]
    preferences?: UserPreferences
  }

  // Conversation progress
  conversationId: string
  type: ConversationType
  stage: ConversationStage

  // Intermediate artifacts
  userIntent?: {
    goal: string
    category?: string
    keywords: string[]
  }
  matchedTemplates?: ExperimentTemplate[]
  selectedTemplate?: ExperimentTemplate
  customizedVariables?: Record<string, any>

  // Generated config
  draftConfig?: UnheardExperimentConfig
  finalConfig?: UnheardExperimentConfig

  // Optimization
  optimizationIntent?: UserIntent
  optimizedExecution?: OptimizedExecution
}

type ConversationStage =
  | 'understanding_intent'
  | 'searching_templates'
  | 'customizing_template'
  | 'generating_config'
  | 'optimizing_execution'
  | 'review_approval'
  | 'completed'
```

### 2.3 Integration Points

```
┌───────────────────────────────────────────┐
│   Enhanced Experiment Assistant           │
└───────────────────────────────────────────┘
         │          │           │
         ▼          ▼           ▼
┌────────────┐ ┌─────────┐ ┌──────────────┐
│ Template   │ │ Convex  │ │ Execution    │
│ Manager    │ │ Client  │ │ Optimizer    │
└────────────┘ └─────────┘ └──────────────┘
         │          │           │
         ▼          ▼           ▼
┌────────────┐ ┌─────────┐ ┌──────────────┐
│ Template   │ │ User    │ │ LLM          │
│ Library    │ │ Data    │ │ Orchestrator │
└────────────┘ └─────────┘ └──────────────┘
```

---

## 3. System Prompt & Instructions

### 3.1 Core System Prompt

```typescript
const SYSTEM_INSTRUCTIONS = `
You are an expert research designer who helps users create optimal experiments on the Unheard platform.

## Your Capabilities

You help users:
1. Clarify their research goals
2. Find and customize proven templates
3. Generate complete experiment configurations
4. Optimize for speed, cost, or quality
5. Understand and iterate on results

## The Unheard Platform

Unheard simulates customer feedback using AI personas that respond to stimuli (products, prices, messages, etc.).

Key concepts:
- **Personas**: Realistic customer profiles with demographics, beliefs, behaviors
- **Focus Groups**: Collections of personas grouped for specific research
- **Experiments**: Structured tests with different network topologies:
  - Broadcast: All personas respond simultaneously (fast, parallel)
  - RoundRobin: Sequential discussion rounds (deeper insights)
  - Moderated: AI moderator guides discussion (most realistic)
- **Discovery**: MCTS algorithm that explores surprising market insights
- **Templates**: Pre-optimized experiment configurations for common use cases

## Your Workflow

### Stage 1: Understand Intent
1. Ask user what they want to learn
2. Identify category: pricing, features, messaging, market research, etc.
3. Extract keywords: product type, target audience, specific questions

### Stage 2: Template Matching
1. Search template library using extracted keywords
2. If match found (>70% relevance):
   - Suggest template
   - Explain why it fits
   - Show what needs customization
3. If no match:
   - Ask if user wants to build from scratch or modify closest match

### Stage 3: Customization
1. Guide user through template variables
2. Only ask for required variables
3. Suggest defaults when possible
4. Use user's existing personas/focus groups

### Stage 4: Optimization
1. Ask user's priority: speed, cost, quality, or balanced
2. Call optimizeExecution tool
3. Explain optimization choices
4. Show cost/time estimates

### Stage 5: Review & Approval
1. Summarize what will run
2. Show execution plan
3. Ask for confirmation
4. Offer to save as template if successful

## Conversation Guidelines

**DO**:
- Ask clarifying questions strategically (max 2-3 before suggesting solution)
- Suggest templates proactively
- Explain trade-offs in plain English
- Show cost/time estimates early
- Use user's existing resources (personas, focus groups)
- Recommend follow-up experiments after results

**DON'T**:
- Overwhelm with options (suggest 1-2 best templates, not 10)
- Ask for information you can infer or look up
- Use jargon (explain "Broadcast" as "parallel", etc.)
- Generate configs without user approval
- Assume user knows technical details

## Tool Usage Rules

1. **Always search templates first** before generating from scratch
2. **Load user context once** at conversation start
3. **Validate configs** before presenting to user
4. **Estimate costs** before user approves
5. **Save successful configs** as templates when appropriate

## Response Format

Structure responses clearly:

**For template suggestions**:
"I found a perfect match: [Template Name]
- Use case: [Brief description]
- What it tests: [Key questions]
- Estimated: [Time] seconds, $[Cost]

Need to customize:
1. [Variable 1]: [Description]
2. [Variable 2]: [Description]

[Proceed button]"

**For clarifying questions**:
"To help you best, I need to know:
- [Question 1]
- [Question 2]

(Keep it brief - 2-3 questions max)"

**For config review**:
"Here's what I'll run for you:

📊 Experiment: [Name]
👥 Personas: [Count] from [Focus Group Name]
💬 Approach: [Network type - explained simply]
⚡ Strategy: [Speed/Quality/Cost - with reasoning]

Estimated: [Time] seconds, $[Cost]

[Adjust] [Run Experiment]"

## Context Awareness

You have access to:
- User's personas and focus groups
- User's past experiments (success/failure)
- User's preferences (if set)
- Template usage statistics
- Cost tracking

Use this to:
- Suggest relevant personas automatically
- Learn from past experiments
- Avoid repeating failed approaches
- Recommend based on what worked before

## Error Handling

If something goes wrong:
1. Explain the issue in simple terms
2. Suggest fix or alternative
3. Never blame the user
4. Offer to try different approach

Example:
"That focus group doesn't have enough personas for this test. You need at least 10, but 'Startup CTOs' only has 7.

Options:
- Add more personas to that group, or
- Use 'Enterprise Buyers' (has 15 personas)"

## Follow-Up Suggestions

After experiment completes, proactively suggest:
- "Results show X. Want to test Y next?"
- "Try this variation: [Concrete suggestion]"
- "Your template worked! Save it for future use?"

Always provide 1-2 concrete next steps, not vague advice.
`
```

### 3.2 Advanced Instructions (Context-Specific)

```typescript
// For different conversation types

const EXPERIMENT_DESIGN_INSTRUCTIONS = `
When helping design experiments:
1. Start with "What do you want to learn?" not "What experiment type?"
2. Infer experiment type from goal (don't ask explicitly)
3. Default to simplest approach (Broadcast network, local models)
4. Only suggest discovery if user wants "surprising insights" or "explore"
5. Optimize for fast iteration (10 seconds > 2 minutes unless quality critical)
`

const RESULTS_ANALYSIS_INSTRUCTIONS = `
When analyzing results:
1. Summarize key findings in 2-3 bullets
2. Highlight surprising patterns
3. Suggest 2 follow-up experiments
4. Offer to save config as template if successful
5. Ask if user wants to adjust and re-run
`

const TEMPLATE_CREATION_INSTRUCTIONS = `
When creating templates:
1. Identify which parts should be variables
2. Suggest good variable names (clear, not technical)
3. Set reasonable defaults
4. Write clear descriptions
5. Tag appropriately for discovery
`
```

---

## 4. Tool Definitions

### 4.1 searchTemplateLibrary

```typescript
const searchTemplateLibrary = {
  name: 'searchTemplateLibrary',
  description:
    'Search the template library for matching experiments. Use extracted keywords from user intent.',
  parameters: z.object({
    query: z
      .string()
      .describe(
        'Search query with keywords like "pricing", "b2b", "validation"'
      ),
    category: z
      .enum([
        'pricing',
        'feature-validation',
        'messaging',
        'market-research',
        'competitive-analysis',
        'persona-development',
        'discovery',
      ])
      .optional()
      .describe('Category to filter by'),
    minRating: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe('Minimum rating (0-5)'),
    verifiedOnly: z
      .boolean()
      .optional()
      .describe('Only show official Unheard templates'),
  }),
  handler: async ({ query, category, minRating, verifiedOnly }) => {
    // Implementation
    const templates = await templateManager.search({
      query,
      category,
      minRating,
      verified: verifiedOnly,
    })

    return {
      templates: templates.slice(0, 5), // Top 5 matches
      totalFound: templates.length,
    }
  },
}
```

### 4.2 getTemplateDetails

```typescript
const getTemplateDetails = {
  name: 'getTemplateDetails',
  description:
    'Get full details of a specific template including variables, config, and usage stats.',
  parameters: z.object({
    templateId: z.string().describe('Template ID from search results'),
  }),
  handler: async ({ templateId }) => {
    const template = await templateManager.getById(templateId)
    const usageStats = await templateManager.getUsageStats(templateId)

    return {
      template,
      usageStats: {
        usageCount: usageStats.total,
        successRate: usageStats.successRate,
        avgRating: usageStats.avgRating,
        avgCost: usageStats.avgCost,
        avgDuration: usageStats.avgDuration,
      },
    }
  },
}
```

### 4.3 getUserPersonas

```typescript
const getUserPersonas = {
  name: 'getUserPersonas',
  description:
    'Get all personas belonging to the current user. Use this to suggest relevant personas for experiments.',
  parameters: z.object({
    tags: z
      .array(z.string())
      .optional()
      .describe('Filter by tags like "B2B", "CTO", "startup"'),
    limit: z.number().optional().describe('Max personas to return'),
  }),
  handler: async ({ tags, limit }) => {
    const personas = await convex.query(api.personas.list, {
      userId: currentUserId,
      tags,
      limit,
    })

    return {
      personas: personas.map(p => ({
        id: p._id,
        name: p.name,
        summary: `${p.demographics.age}yo ${p.demographics.gender}, ${p.jobRole?.title || 'Consumer'}`,
        tags: p.tags,
      })),
      total: personas.length,
    }
  },
}
```

### 4.4 getUserFocusGroups

```typescript
const getUserFocusGroups = {
  name: 'getUserFocusGroups',
  description:
    'Get all focus groups for this user. Focus groups are collections of personas.',
  parameters: z.object({}),
  handler: async () => {
    const focusGroups = await convex.query(api.focusGroups.list, {
      userId: currentUserId,
    })

    return {
      focusGroups: focusGroups.map(fg => ({
        id: fg._id,
        name: fg.name,
        description: fg.description,
        personaCount: fg.personaIds.length,
        tags: fg.tags,
      })),
      total: focusGroups.length,
    }
  },
}
```

### 4.5 getUserExperimentHistory

```typescript
const getUserExperimentHistory = {
  name: 'getUserExperimentHistory',
  description:
    "Get user's recent experiments to learn from past successes/failures.",
  parameters: z.object({
    limit: z.number().default(10).describe('Number of recent experiments'),
    category: z.string().optional().describe('Filter by category'),
  }),
  handler: async ({ limit, category }) => {
    const experiments = await convex.query(api.experiments.listRecent, {
      userId: currentUserId,
      limit,
      category,
    })

    return {
      experiments: experiments.map(exp => ({
        id: exp._id,
        name: exp.name,
        type: exp.type,
        status: exp.status,
        summary: `${exp.name}: ${exp.status}, ${exp.extractedDataset?.summary}`,
        wasSuccessful: exp.status === 'completed',
        templateUsed: exp.sourceTemplateId,
      })),
    }
  },
}
```

### 4.6 validateConfig

```typescript
const validateConfig = {
  name: 'validateConfig',
  description:
    'Validate an experiment configuration for errors before presenting to user.',
  parameters: z.object({
    config: z.any().describe('Complete UnheardExperimentConfig object'),
  }),
  handler: async ({ config }) => {
    const validator = new ConfigValidator()
    const result = validator.validate(config)

    if (!result.valid) {
      return {
        valid: false,
        errors: result.errors.map(err => ({
          field: err.path,
          message: err.message,
          suggestion: err.suggestion,
        })),
      }
    }

    return {
      valid: true,
      warnings: result.warnings || [],
    }
  },
}
```

### 4.7 estimateCost

```typescript
const estimateCost = {
  name: 'estimateCost',
  description: 'Estimate cost and duration for an experiment configuration.',
  parameters: z.object({
    config: z.any().describe('UnheardExperimentConfig'),
    optimizationIntent: z
      .enum(['speed', 'cost', 'quality', 'balanced'])
      .optional(),
  }),
  handler: async ({ config, optimizationIntent }) => {
    const estimator = new CostEstimator()
    const estimate = await estimator.estimate(config, {
      intent: optimizationIntent || 'balanced',
      systemState: await getSystemState(),
    })

    return {
      estimatedCostUSD: estimate.cost,
      estimatedDurationSeconds: estimate.duration,
      breakdown: {
        personaCalls: estimate.personaCalls,
        discoveryCalls: estimate.discoveryCalls,
        totalLLMCalls: estimate.totalLLMCalls,
      },
      provider: estimate.selectedProvider,
      model: estimate.selectedModel,
    }
  },
}
```

### 4.8 optimizeExecution

```typescript
const optimizeExecution = {
  name: 'optimizeExecution',
  description:
    'Optimize experiment execution strategy based on user intent (speed/cost/quality).',
  parameters: z.object({
    config: z.any().describe('Base config to optimize'),
    intent: z
      .enum(['speed', 'cost', 'quality', 'balanced'])
      .describe("User's optimization priority"),
    budget: z.number().optional().describe('Maximum budget in USD'),
    timeLimit: z.number().optional().describe('Maximum time in seconds'),
  }),
  handler: async ({ config, intent, budget, timeLimit }) => {
    const optimizer = new ExecutionOptimizer()
    const optimized = await optimizer.optimize(
      config,
      {
        priority: intent,
        budget,
        timeLimit,
      },
      await getSystemState()
    )

    return {
      optimizedConfig: optimized.config,
      strategy: optimized.strategy,
      explanation: optimized.explanation,
      estimates: {
        cost: optimized.estimatedCost,
        duration: optimized.estimatedDuration,
      },
      changes: optimized.changesFromOriginal,
    }
  },
}
```

### 4.9 forkTemplate

```typescript
const forkTemplate = {
  name: 'forkTemplate',
  description: 'Fork a template and customize its variables.',
  parameters: z.object({
    templateId: z.string().describe('Template to fork'),
    variableValues: z.record(z.any()).describe('Variable values to customize'),
  }),
  handler: async ({ templateId, variableValues }) => {
    const template = await templateManager.getById(templateId)
    const customized = await templateManager.fork(template, variableValues)

    return {
      config: customized.config,
      valid: customized.valid,
      errors: customized.errors,
    }
  },
}
```

### 4.10 saveConfig

```typescript
const saveConfig = {
  name: 'saveConfig',
  description: 'Save a finalized config so user can run it.',
  parameters: z.object({
    config: z.any().describe('Complete validated config'),
    name: z.string().describe('User-facing name'),
    saveAsTemplate: z
      .boolean()
      .optional()
      .describe('Whether to save as reusable template'),
  }),
  handler: async ({ config, name, saveAsTemplate }) => {
    const configId = await convex.mutation(api.experimentConfigs.create, {
      userId: currentUserId,
      name,
      config,
      sourceType: 'conversation',
      sourceId: currentConversationId,
      canBeTemplate: saveAsTemplate || false,
    })

    return {
      configId,
      message: `Saved as "${name}". Ready to run!`,
    }
  },
}
```

---

## 5. Conversation Flows

### 5.1 Flow 1: Template Match (Ideal Path)

```
User: "I want to test if developers will pay $50/mo for my API"

Agent:
1. Extract intent:
   - Goal: pricing validation
   - Product: API
   - Audience: developers
   - Price: $50/mo

2. Search templates:
   searchTemplateLibrary({
     query: "pricing validation API developers",
     category: "pricing"
   })
   → Finds: "B2B SaaS Pricing Validation"

3. Get details:
   getTemplateDetails({ templateId: "template123" })
   → Success rate: 89%, Avg cost: $0.01

4. Check user resources:
   getUserFocusGroups()
   → Has "Developer Personas" group (12 personas)

5. Respond:
   "I found the perfect template: **B2B SaaS Pricing Validation**

   This template tests if your target customers accept your pricing.
   It's been used 247 times with 89% success rate.

   I just need to know:
   - Product name: [Your API name]
   - Price point: $50/mo ✓
   - Target personas: I'll use your 'Developer Personas' group ✓

   Estimated: 10 seconds, $0 (using local AI)

   [Fill in name] [Run]"

User: "It's called CloudQueue API"

Agent:
6. Fork template:
   forkTemplate({
     templateId: "template123",
     variableValues: {
       productName: "CloudQueue API",
       pricePoint: 50,
       targetPersonas: "fg_developers_123"
     }
   })

7. Validate:
   validateConfig({ config: customizedConfig })
   → Valid ✓

8. Estimate:
   estimateCost({ config: customizedConfig })
   → $0, 10 seconds, Ollama Qwen2.5

9. Respond:
   "Perfect! Here's what I'll test:

   📊 **CloudQueue API Pricing Test**
   👥 12 developer personas
   💬 3-round focus group (parallel responses)
   ⚡ Using local AI (free, fast)

   Estimated: 10 seconds, $0

   [Adjust] [Run Experiment]"

User: "Run it"

Agent:
10. Save and execute:
    saveConfig({ config, name: "CloudQueue API Pricing Test" })
    → Returns configId

11. Hand off to experiment runner:
    "Starting your experiment now! ⚡

    [Live progress will appear here...]"
```

**Time from start to execution: ~60 seconds**

### 5.2 Flow 2: No Template Match (Custom Build)

```
User: "I want to understand why customers churn after 3 months"

Agent:
1. Extract intent:
   - Goal: churn analysis
   - Timeline: after 3 months
   - Type: discovery/exploration

2. Search templates:
   searchTemplateLibrary({
     query: "churn analysis retention customer",
     category: "market-research"
   })
   → No strong matches (best is 45% relevant)

3. Check if user wants discovery:
   "Churn analysis is perfect for open-ended discovery. I can use MCTS to explore unexpected patterns.

   Do you have specific hypotheses, or want me to explore everything?"

User: "Explore everything"

Agent:
4. Get user resources:
   getUserFocusGroups()
   → Has "Churned Q3 Customers" (23 personas)

   getUserExperimentHistory({ category: "churn" })
   → No previous churn experiments

5. Build config from scratch:
   config = {
     experiment: {
       name: "Q3 Churn Deep Dive",
       type: "discovery",
       context: {
         problem: "Understanding 3-month churn drivers",
         targetMarket: "Q3 churned customers"
       }
     },
     agents: {
       focusGroupId: "fg_churned_q3",
       network: { topology: "broadcast", maxRounds: 1 }
     },
     discovery: {
       enabled: true,
       trigger: "immediate",
       config: {
         maxIterations: 100,
         parallelExpansion: 10
       }
     }
   }

6. Optimize for quality (discovery needs good models):
   optimizeExecution({ config, intent: "quality" })
   → Uses GPT-4o, estimated $0.50, 2 minutes

7. Validate:
   validateConfig({ config })
   → Valid ✓

8. Present:
   "I'll run a discovery experiment with your 23 churned customer personas.

   📊 **Q3 Churn Deep Dive**
   🔍 MCTS Discovery (100 iterations)
   🧠 Using GPT-4o for best insights

   Estimated: 2 minutes, $0.50

   This will explore unexpected churn patterns you might miss with manual analysis.

   [Adjust] [Run Discovery]"

User: "That's expensive, can you make it cheaper?"

Agent:
9. Re-optimize for cost:
   optimizeExecution({ config, intent: "cost", budget: 0.10 })
   → Switches to DeepSeek-V3 via Modal, 50 iterations

10. Present alternative:
    "I can reduce cost by:
    - Using DeepSeek-V3 (90% quality of GPT-4o)
    - 50 iterations instead of 100

    New estimate: 1 minute, $0.08

    [Run This] [Keep Original]"
```

### 5.3 Flow 3: Follow-Up After Results

```
[Experiment just completed with results]

Agent (proactive message):
"✅ Your experiment is complete!

**Key Findings**:
- 60% positive sentiment toward $50 pricing
- BUT: Bootstrapped founders want $35 or less
- Funded startups find $50 acceptable

**Surprising Pattern**:
Developers expect managed Redis + webhooks at $50/mo.
Basic queue processing alone isn't enough value.

**What's Next?**

I can help you:
1. Test tiered pricing ($35 basic, $50 premium with Redis)
2. Test feature bundles at $50
3. Re-run with just bootstrapped founders at $35

Which sounds most useful?"

User: "Let's test tiered pricing"

Agent:
1. Fork previous config:
   previousConfig = getExperimentById(experimentId).config

2. Modify for tiered test:
   newConfig = {
     ...previousConfig,
     stimulus: {
       type: "scenario",
       content: "Imagine two tiers:
         - Basic: $35/mo (queue processing)
         - Premium: $50/mo (+ Redis, webhooks, priority support)

         Which would you choose and why?"
     }
   }

3. Present:
   "I'll test tiered pricing with the same personas:

   📊 **CloudQueue API - Tiered Pricing Test**
   💰 Tier 1: $35/mo basic
   💰 Tier 2: $50/mo premium (Redis + webhooks)

   Estimated: 10 seconds, $0

   [Run]"
```

---

## 6. Context Management

### 6.1 Loading User Context

```typescript
async function loadUserContext(userId: string): Promise<UserContext> {
  // Load once at conversation start
  const [personas, focusGroups, recentExperiments, preferences] =
    await Promise.all([
      convex.query(api.personas.list, { userId }),
      convex.query(api.focusGroups.list, { userId }),
      convex.query(api.experiments.listRecent, { userId, limit: 10 }),
      convex.query(api.users.getPreferences, { userId }),
    ])

  return {
    userId,
    availablePersonas: personas,
    availableFocusGroups: focusGroups,
    recentExperiments,
    preferences: preferences || DEFAULT_PREFERENCES,
  }
}
```

### 6.2 Context-Aware Suggestions

```typescript
// Example: Suggest personas based on user's research history

function suggestRelevantPersonas(
  userContext: UserContext,
  experimentGoal: string
): Persona[] {
  const { availablePersonas, recentExperiments } = userContext

  // If user has done similar experiments, suggest same personas
  const similarExperiments = recentExperiments.filter(exp =>
    exp.name.toLowerCase().includes(extractKeywords(experimentGoal))
  )

  if (similarExperiments.length > 0) {
    const usedPersonaIds = similarExperiments.flatMap(
      exp => exp.focusGroup.personaIds
    )

    return availablePersonas.filter(p => usedPersonaIds.includes(p._id))
  }

  // Otherwise, match by tags
  const keywords = extractKeywords(experimentGoal)
  return availablePersonas.filter(p =>
    p.tags.some(tag => keywords.includes(tag.toLowerCase()))
  )
}
```

### 6.3 Learning from History

```typescript
// Example: Avoid repeating failed approaches

function shouldWarnAboutSimilarFailure(
  userContext: UserContext,
  proposedConfig: UnheardExperimentConfig
): string | null {
  const { recentExperiments } = userContext

  // Check if similar config failed before
  const similar = recentExperiments.find(
    exp =>
      exp.status === 'failed' &&
      exp.hypothesis.category ===
        proposedConfig.experiment.hypothesis.category &&
      exp.focusGroupId === proposedConfig.agents.focusGroupId
  )

  if (similar) {
    return `⚠️ Note: A similar experiment ("${similar.name}") failed ${formatTimeAgo(similar.createdAt)}.

    Reason: ${similar.errorMessage || 'Unknown'}

    Want to adjust the approach or continue anyway?`
  }

  return null
}
```

---

## 7. Error Handling

### 7.1 Validation Errors

```typescript
// When config validation fails

agent.on('validationError', (error, context) => {
  const userFriendlyMessage = translateValidationError(error)

  return {
    message: `I found an issue with the configuration:

    ${userFriendlyMessage}

    ${error.suggestion || 'Let me help you fix this.'}`,
    actions: ['fix_automatically', 'adjust_manually', 'start_over'],
  }
})

function translateValidationError(error: ValidationError): string {
  switch (error.code) {
    case 'INSUFFICIENT_PERSONAS':
      return `Your selected focus group only has ${error.actual} personas, but this experiment needs at least ${error.required}.`

    case 'INVALID_FOCUS_GROUP':
      return `The focus group "${error.focusGroupName}" doesn't exist or has been deleted.`

    case 'MISSING_REQUIRED_FIELD':
      return `The "${error.field}" is required but wasn't provided.`

    default:
      return error.message
  }
}
```

### 7.2 Resource Unavailable

```typescript
// When Ollama isn't available, suggest alternatives

agent.on('resourceUnavailable', (resource, context) => {
  if (resource === 'ollama') {
    return {
      message: `Local AI (Ollama) isn't running right now.

      I can use cloud AI instead:
      - Modal (DeepSeek-V3): ~$0.003, same speed
      - OpenAI (GPT-4o-mini): ~$0.01, highest quality

      Which would you prefer?`,
      actions: ['use_modal', 'use_openai', 'install_ollama'],
    }
  }
})
```

### 7.3 Budget Exceeded

```typescript
// When estimated cost exceeds budget

agent.on('budgetExceeded', (estimate, budget, context) => {
  const overBudget = estimate.cost - budget.limit

  return {
    message: `This experiment would cost $${estimate.cost}, which is $${overBudget} over your $${budget.limit} limit.

    Ways to reduce cost:
    1. Use fewer personas (currently: ${estimate.personaCount})
    2. Use local AI (free instead of $${estimate.cost})
    3. Skip discovery (saves $${estimate.discoveryCost})

    What would you like to do?`,
    actions: [
      'reduce_personas',
      'use_local',
      'skip_discovery',
      'increase_budget',
    ],
  }
})
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// Test individual tools

describe('searchTemplateLibrary', () => {
  it('should find pricing templates', async () => {
    const result = await searchTemplateLibrary({
      query: 'pricing validation b2b',
      category: 'pricing',
    })

    expect(result.templates).toHaveLength(5)
    expect(result.templates[0].category).toBe('pricing')
  })

  it('should prioritize verified templates', async () => {
    const result = await searchTemplateLibrary({
      query: 'pricing',
      verifiedOnly: true,
    })

    expect(result.templates.every(t => t.verified)).toBe(true)
  })
})

describe('forkTemplate', () => {
  it('should customize template variables', async () => {
    const result = await forkTemplate({
      templateId: 'pricing-template',
      variableValues: {
        productName: 'TestAPI',
        pricePoint: 99,
      },
    })

    expect(result.config.experiment.context.productName).toBe('TestAPI')
    expect(result.valid).toBe(true)
  })
})
```

### 8.2 Integration Tests

```typescript
// Test full conversation flows

describe('Enhanced Assistant Conversation', () => {
  it('should handle template match flow', async () => {
    const agent = new EnhancedExperimentAssistant()
    const context = await loadUserContext('user123')

    // User message
    const response1 = await agent.chat({
      message: 'I want to test if developers will pay $50/mo',
      context,
    })

    expect(response1.message).toContain('template')
    expect(response1.actions.searchedTemplates).toBe(true)

    // User confirms
    const response2 = await agent.chat({
      message: 'Product name is CloudQueue API',
      threadId: response1.threadId,
    })

    expect(response2.generatedConfig).toBeDefined()
    expect(response2.generatedConfig.experiment.context.productName).toBe(
      'CloudQueue API'
    )
  })

  it('should handle no template match', async () => {
    const agent = new EnhancedExperimentAssistant()

    const response = await agent.chat({
      message: 'I want to understand why customers churn',
      context: userContext,
    })

    expect(response.message).toContain('discovery')
    expect(response.actions.suggestedTemplates).toHaveLength(0)
  })
})
```

### 8.3 E2E Tests

```typescript
// Test complete user journey

describe('E2E: Pricing Experiment', () => {
  it('should create and run pricing experiment from conversation', async () => {
    // 1. User starts conversation
    const conv1 = await startConversation({
      userId: testUser.id,
      message: 'test pricing for my SaaS at $50/mo',
    })

    expect(conv1.status).toBe('active')

    // 2. Agent suggests template
    expect(conv1.message).toContain('B2B SaaS Pricing')

    // 3. User customizes
    const conv2 = await continueConversation({
      threadId: conv1.threadId,
      message: 'product is TestSaaS, use Developer focus group',
    })

    // 4. Agent generates config
    expect(conv2.generatedConfig).toBeDefined()

    // 5. User runs experiment
    const experiment = await runExperiment({
      configId: conv2.generatedConfig.id,
    })

    expect(experiment.status).toBe('running')

    // 6. Wait for completion
    await waitForExperiment(experiment.id, { timeout: 30000 })

    const results = await getExperimentResults(experiment.id)
    expect(results.status).toBe('completed')
    expect(results.extractedDataset).toBeDefined()
  })
})
```

### 8.4 Quality Metrics

**Track in production**:

```typescript
interface AssistantMetrics {
  // Accuracy
  configValidationRate: number // % of generated configs that are valid
  experimentSuccessRate: number // % that complete successfully
  templateMatchAccuracy: number // % of matches rated relevant by users

  // Efficiency
  avgQuestionsToConfig: number // How many Q's before generating config
  avgTimeToConfig: number // Time from start to config ready
  avgConfigIterations: number // How many iterations before user approves

  // User Satisfaction
  userApprovalRate: number // % of configs user approves without changes
  conversationAbandonmentRate: number // % of conversations abandoned
  followUpEngagement: number // % who accept follow-up suggestions

  // Cost
  avgCostPerConversation: number // LLM cost for conversation
  avgCostPerExperiment: number // Including execution
}
```

---

## Summary

This specification provides:

1. **Complete agent architecture** with Mastra integration
2. **Detailed system prompts** for consistent behavior
3. **10 tool definitions** with implementations
4. **3 conversation flows** covering main use cases
5. **Context management** for personalized experience
6. **Error handling** for common failure modes
7. **Testing strategy** from unit to E2E
8. **Quality metrics** for production monitoring

**Key Design Decisions**:

- GPT-4o for reasoning (not GPT-4o-mini)
- Template-first approach
- Max 2-3 clarifying questions
- Always estimate cost before running
- Proactive follow-up suggestions
- Context-aware persona/template suggestions

**Implementation Order**:

1. Week 1: Core agent + first 5 tools
2. Week 2: Remaining tools + conversation flows
3. Week 3: Context management + error handling
4. Week 4: Testing + optimization

**Success Criteria**:

- > 90% config validation rate
- > 80% user approval rate
- <3 questions to generated config
- <30s average conversation time
- > 70% template match rate
