# Unheard Data Models Specification

## Template System + Git Integration + Cloud Backend

**Date**: 2026-02-04
**Version**: 2.0 (Updated for Tauri + Git + Convex + Modal)
**Purpose**: Complete data model specifications for cloud backend (Convex) and Git-based decision storage

---

## Table of Contents

1. [Overview](#1-overview)
2. [Convex Cloud Schema](#2-convex-cloud-schema)
3. [Git File Formats](#3-git-file-formats)
4. [TypeScript Types](#4-typescript-types)
5. [Relationships](#5-relationships)
6. [Indexes & Performance](#6-indexes--performance)
7. [Migration Strategy](#7-migration-strategy)

---

## 1. Overview

### 1.1 Storage Strategy

**Convex (Cloud)**:
- User authentication
- Context documents (metadata + raw data)
- Templates (official + user-created)
- Experiment configurations
- Persona definitions
- Real-time collaboration data

**Git/GitHub (Versioned Storage)**:
- Decision logs (Markdown)
- Experiment results (YAML + JSON)
- Context files (CSV, PDF - actual files)
- Custom templates (YAML)
- All decision-making artifacts

**Modal (Cloud Execution)**:
- Experiment runtime (ephemeral)
- Persona generation (stateless)
- Results aggregation (passed back to Tauri)

### 1.2 Data Flow

```
User uploads CSV
  → Tauri parses file
  → Stores metadata in Convex
  → Commits file to Git
  → Available to agent

User starts chat
  → Claude SDK (local)
  → Selects template (from Convex)
  → Generates decision log (Git)
  → Commits to Git

User runs experiment
  → Tauri calls Modal
  → Modal generates personas
  → Modal executes in parallel
  → Results stream back to Tauri
  → Results saved to Convex + Git
```

---

## 2. Convex Cloud Schema

### 2.1 Users & Authentication

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ==========================================
  // USERS & AUTH
  // ==========================================

  users: defineTable({
    clerkId: v.optional(v.string()), // For Clerk auth (optional)
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // User preferences
    preferences: v.optional(
      v.object({
        theme: v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
        defaultPersonaCount: v.number(),
        preferredModel: v.string(),
      })
    ),

    // Git integration
    githubUsername: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_clerk_id', ['clerkId']),

  // ==========================================
  // CONTEXT DOCUMENTS
  // ==========================================

  contextDocuments: defineTable({
    userId: v.id('users'),

    // File metadata
    filename: v.string(),
    fileType: v.union(
      v.literal('csv'),
      v.literal('pdf'),
      v.literal('xlsx'),
      v.literal('txt'),
      v.literal('md')
    ),
    contentType: v.union(
      v.literal('customer_data'),
      v.literal('investor_data'),
      v.literal('product_data'),
      v.literal('metrics'),
      v.literal('general')
    ),

    // Parsed schema
    schema: v.optional(
      v.array(
        v.object({
          columnName: v.string(),
          dataType: v.string(), // 'string', 'number', 'date', 'email', etc.
          sampleValues: v.array(v.string()),
        })
      )
    ),
    rowCount: v.number(),

    // Storage
    gitPath: v.string(), // Path in Git repo (e.g., 'context/customers.csv')
    convexStorageId: v.optional(v.id('_storage')), // For large files

    // Metadata
    summary: v.optional(v.string()), // AI-generated summary
    tags: v.array(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_content_type', ['contentType']),

  // ==========================================
  // TEMPLATES
  // ==========================================

  experimentTemplates: defineTable({
    // Basic Info
    name: v.string(),
    description: v.string(),
    category: v.union(
      v.literal('investors'),
      v.literal('product'),
      v.literal('operations'),
      v.literal('hiring'),
      v.literal('custom')
    ),

    // Authorship
    authorId: v.id('users'),
    authorName: v.string(),
    isOfficial: v.boolean(), // Official Unheard template

    // Configuration
    defaultPersonaCount: v.number(),
    defaultStimulus: v.string(),

    // Variables (for customization)
    variables: v.array(
      v.object({
        key: v.string(), // Variable name (e.g., 'fundingTarget')
        label: v.string(), // Display label
        type: v.union(
          v.literal('text'),
          v.literal('number'),
          v.literal('select'),
          v.literal('textarea')
        ),
        defaultValue: v.optional(v.any()),
        options: v.optional(v.array(v.string())), // For select type
        required: v.boolean(),
        placeholder: v.optional(v.string()),
      })
    ),

    // Full config template
    configTemplate: v.any(), // JSON config

    // Usage stats
    usageCount: v.number(),
    avgRating: v.number(),
    ratingCount: v.number(),

    // Version
    version: v.string(), // Semver
    parentTemplateId: v.optional(v.id('experimentTemplates')), // If forked

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_author', ['authorId'])
    .index('by_category', ['category'])
    .index('by_official', ['isOfficial'])
    .index('by_usage', ['usageCount']),

  // ==========================================
  // PERSONAS
  // ==========================================

  personas: defineTable({
    userId: v.id('users'),

    // Identity
    name: v.string(),
    role: v.string(),
    company: v.optional(v.string()),

    // Demographics
    age: v.optional(v.number()),
    location: v.optional(v.string()),

    // Context
    background: v.string(),
    beliefs: v.array(v.string()),
    preferences: v.array(v.string()),
    decisionMakingStyle: v.optional(v.string()),

    // Source
    generatedFrom: v.optional(
      v.object({
        contextDocId: v.id('contextDocuments'),
        sourceRow: v.optional(v.number()),
      })
    ),

    // Metadata
    tags: v.array(v.string()),

    createdAt: v.number(),
  }).index('by_user', ['userId']),

  // ==========================================
  // EXPERIMENTS
  // ==========================================

  experiments: defineTable({
    userId: v.id('users'),

    // Basic info
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('draft'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),

    // Template link
    templateId: v.optional(v.id('experimentTemplates')),
    templateName: v.optional(v.string()),

    // Configuration
    stimulus: v.string(),
    personaIds: v.array(v.id('personas')),
    contextDocIds: v.array(v.id('contextDocuments')),

    // Results
    results: v.optional(
      v.array(
        v.object({
          personaId: v.id('personas'),
          personaName: v.string(),
          response: v.string(),
          sentiment: v.number(), // -1 to 1
          timestamp: v.number(),
        })
      )
    ),

    // Insights (AI-generated)
    insights: v.optional(
      v.array(
        v.object({
          insight: v.string(),
          supportingEvidence: v.array(v.string()),
          actionableRecommendation: v.string(),
        })
      )
    ),

    // Git link
    gitDecisionLogPath: v.optional(v.string()), // Path to decision log in Git
    gitResultsPath: v.optional(v.string()), // Path to results file in Git

    // Execution metadata
    executionTime: v.optional(v.number()), // Milliseconds
    costUSD: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_template', ['templateId']),

  // ==========================================
  // CONVERSATIONS
  // ==========================================

  conversations: defineTable({
    userId: v.id('users'),

    // Messages
    messages: v.array(
      v.object({
        id: v.string(),
        role: v.union(v.literal('user'), v.literal('assistant')),
        content: v.string(),
        timestamp: v.number(),
      })
    ),

    // Context
    relatedExperimentId: v.optional(v.id('experiments')),
    relatedTemplateId: v.optional(v.id('experimentTemplates')),

    // Status
    isActive: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
})
```

---

## 3. Git File Formats

### 3.1 Repository Structure

```
company-decisions/  (Git repo root)
├── .unheard/
│   └── config.yaml           # Unheard project config
├── context/
│   ├── customers.csv         # Uploaded context files
│   ├── investors.csv
│   └── metrics.pdf
├── decisions/
│   ├── 2026-02-04-seed-vs-bootstrap.md
│   └── 2026-02-05-pricing-strategy.md
├── experiments/
│   └── exp-001-investor-pitch/
│       ├── config.yaml        # Experiment configuration
│       ├── results.json       # Raw results
│       └── summary.md         # Human-readable summary
└── templates/
    └── custom-investor-eval.yaml  # User-customized templates
```

### 3.2 Decision Log Format (Markdown)

```markdown
# Decision: Seed Funding vs Bootstrap

**Date**: 2026-02-04
**Status**: Evaluating
**Decision Type**: Investor Evaluation
**Template**: Investor Evaluation v1.0

## Context

We're a B2B SaaS company building developer tools with:
- **MRR**: $50,000
- **Customers**: 30 paying customers
- **Team**: 2 co-founders
- **Runway**: 12 months
- **Growth**: 15% MoM

## Decision Question

Should we raise a $2M seed round or continue bootstrapping?

## Options

### Option 1: Seed Funding ($2M)
**Pros**:
- Accelerate growth (hire 5-person team)
- Expand marketing reach
- Build enterprise features faster
- Longer runway (24+ months)

**Cons**:
- 20-25% dilution
- Investor pressure for growth
- Board meetings and reporting overhead
- Potential loss of control

### Option 2: Bootstrap
**Pros**:
- Full control and ownership
- Profitability focus
- No investor pressure
- Sustainable growth

**Cons**:
- Slower growth
- Resource constraints
- Competitors may outpace us
- Limited hiring capacity

## Experiment Configuration

- **Template**: Investor Evaluation
- **Personas**: 10 (5 VCs, 3 angels, 2 advisors)
- **Context Files**: customers.csv, metrics.pdf
- **Stimulus**: See `experiments/exp-001-investor-pitch/config.yaml`

## Results

*(Filled after experiment completes)*

### Sentiment Breakdown
- **Positive**: 60% (6/10)
- **Neutral**: 30% (3/10)
- **Negative**: 10% (1/10)

### Key Insights

1. **VCs strongly favor seed funding** (8/10 recommended)
   - Strong traction ($50K MRR) justifies seed round
   - Team experience seen as positive signal
   - Market timing is favorable

2. **Angels concerned about valuation**
   - Current metrics may not support high valuation
   - Recommend growth to $75-100K MRR first

3. **Advisors split on timing**
   - Some recommend waiting 3-6 months
   - Others say "strike while market is hot"

See detailed results: `experiments/exp-001-investor-pitch/summary.md`

## Decision

*(To be made after reviewing all insights)*

**Status**: Under consideration
**Next Steps**:
1. Talk to 3-5 VCs to validate market interest
2. Model financial scenarios (seed vs bootstrap)
3. Discuss with co-founder and advisors

## Notes

- Ran follow-up experiment with $3M target
- Considered strategic investors in developer tools space
- Board composition matters more than valuation

---

**Experiment History**:
- [exp-001: Initial investor pitch (2026-02-04)](../experiments/exp-001-investor-pitch/)
- [exp-002: Higher funding target test (2026-02-05)](../experiments/exp-002-higher-target/)
```

### 3.3 Experiment Config Format (YAML)

```yaml
# experiments/exp-001-investor-pitch/config.yaml

experimentId: exp-001
name: "Investor Pitch Evaluation"
createdAt: 2026-02-04T10:30:00Z
status: completed

# Template used
template:
  id: investor-evaluation
  version: 1.0.0

# Variables customized
variables:
  fundingStage: seed
  fundingTarget: 2000000  # $2M
  companyStage: early-revenue
  vertical: developer-tools

# Personas
personas:
  count: 10
  types:
    - type: vc_partner
      count: 5
    - type: angel_investor
      count: 3
    - type: advisor
      count: 2

# Stimulus
stimulus: |
  You're evaluating a B2B SaaS company in the developer tools space.

  Company metrics:
  - MRR: $50,000
  - Customers: 30 paying customers
  - Team: 2 experienced founders
  - Growth: 15% MoM
  - Runway: 12 months

  They're considering raising a $2M seed round.

  Questions:
  1. Would you invest? Why or why not?
  2. What concerns do you have?
  3. What metrics would you want to see improved?
  4. What advice would you give?

# Context files used
contextFiles:
  - path: context/customers.csv
    type: customer_data
    rows: 500
  - path: context/metrics.pdf
    type: financial_metrics
    pages: 5

# Execution metadata
execution:
  provider: modal
  model: claude-3-5-haiku-20241022
  parallelism: 10
  durationMs: 28453
  costUSD: 0.12

# Results summary
results:
  totalResponses: 10
  avgSentiment: 0.45  # Slightly positive
  sentimentBreakdown:
    positive: 6
    neutral: 3
    negative: 1
```

### 3.4 Results Format (JSON)

```json
{
  "experimentId": "exp-001",
  "completedAt": "2026-02-04T10:35:28Z",
  "results": [
    {
      "personaId": "persona-001",
      "personaName": "Sarah Chen",
      "personaRole": "VC Partner at Sequoia",
      "response": "I would invest. The metrics show strong product-market fit with $50K MRR and 15% MoM growth. The team's experience in developer tools is valuable. My main concern is the small customer base (30) - I'd want to see more diversification before a $2M round. I'd advise: 1) Get to $75-100K MRR first, 2) Expand to 50+ customers, 3) Then raise at a better valuation.",
      "sentiment": 0.6,
      "sentimentLabel": "positive",
      "keyPoints": [
        "Strong product-market fit",
        "Team experience valuable",
        "Customer base too small",
        "Recommend growing before raising"
      ],
      "timestamp": 1707048928
    },
    {
      "personaId": "persona-002",
      "personaName": "Michael Rodriguez",
      "personaRole": "VC Partner at a16z",
      "response": "Yes, I'd invest. $50K MRR with 15% MoM growth in 12 months is impressive for a developer tools company. The timing is right - developer tools market is hot. My concerns: 1) Competition - who else is in this space? 2) Customer concentration - are revenues spread out? 3) Churn rate? I'd advise raising sooner rather than later. Market conditions change quickly.",
      "sentiment": 0.8,
      "sentimentLabel": "positive",
      "keyPoints": [
        "Strong growth trajectory",
        "Market timing favorable",
        "Competition concerns",
        "Raise sooner rather than later"
      ],
      "timestamp": 1707048932
    }
    // ... 8 more personas
  ],
  "insights": [
    {
      "insight": "VCs strongly favor seed funding based on traction",
      "confidence": 0.85,
      "supportingEvidence": [
        "8/10 personas recommended raising",
        "Consistent mentions of strong MRR growth",
        "Multiple personas cited 'product-market fit'"
      ],
      "actionableRecommendation": "Move forward with seed round conversations. Prepare pitch deck highlighting MRR growth and team experience."
    },
    {
      "insight": "Customer base size is a concern for several investors",
      "confidence": 0.75,
      "supportingEvidence": [
        "5/10 personas mentioned customer count",
        "Angels particularly concerned about concentration risk",
        "VCs want to see 50+ customers"
      ],
      "actionableRecommendation": "Consider delaying raise by 2-3 months to grow customer base to 40-50. This will also improve valuation."
    },
    {
      "insight": "Market timing is favorable according to advisors",
      "confidence": 0.7,
      "supportingEvidence": [
        "Developer tools market is 'hot' right now",
        "Multiple mentions of favorable conditions",
        "Advisors recommend acting quickly"
      ],
      "actionableRecommendation": "Balance growth goals with market timing. Consider raising now with growth plan vs waiting for better metrics."
    }
  ]
}
```

### 3.5 Custom Template Format (YAML)

```yaml
# templates/custom-investor-eval.yaml

templateId: custom-investor-eval-v1
name: "Strategic Investor Evaluation"
description: "Evaluate strategic investors (corporate VCs, strategic partners)"
category: investors
version: 1.0.0

# Parent template (if forked)
basedOn:
  templateId: investor-evaluation
  version: 1.0.0

# Customizations
variables:
  - key: fundingStage
    label: "Funding Stage"
    type: select
    options: ["pre-seed", "seed", "series-a"]
    required: true

  - key: fundingTarget
    label: "Funding Target ($)"
    type: number
    required: true

  - key: strategic
    label: "Looking for strategic value?"
    type: select
    options: ["yes", "no", "open"]
    defaultValue: "yes"

# Persona configuration
personaConfig:
  defaultCount: 12
  types:
    - type: corporate_vc
      count: 4
      description: "Corporate VCs from relevant industry"
    - type: strategic_partner
      count: 4
      description: "Potential strategic partners"
    - type: traditional_vc
      count: 4
      description: "Traditional VCs for comparison"

# Stimulus template
stimulusTemplate: |
  You're evaluating a {{companyStage}} company seeking {{fundingTarget}}.

  {{#if strategic}}
  The company is particularly interested in strategic value beyond capital.
  {{/if}}

  Company metrics:
  - MRR: {{mrr}}
  - Customers: {{customerCount}}
  - Team: {{teamSize}}
  - Growth: {{growthRate}}

  Questions:
  1. Would you invest? Why or why not?
  2. What strategic value can you provide?
  3. What are your concerns?
  4. What would you want in return?
```

### 3.6 Project Config (.unheard/config.yaml)

```yaml
# .unheard/config.yaml

projectId: unheard-proj-001
projectName: "My Company Decisions"
createdAt: 2026-02-04T10:00:00Z

# Git integration
git:
  repoUrl: "https://github.com/myusername/company-decisions"
  branch: main
  autoCommit: true
  commitPrefix: "[unheard]"

# Default settings
defaults:
  personaCount: 10
  model: claude-3-5-haiku-20241022
  provider: modal

# Context file locations
contextPaths:
  - context/*.csv
  - context/*.pdf
  - context/*.xlsx

# Templates
templates:
  searchPaths:
    - templates/
  allowCustom: true

# Team collaboration
team:
  enabled: false
  members: []
```

---

## 4. TypeScript Types

### 4.1 Core Types

```typescript
// shared/types/index.ts

import { Id } from 'convex/values'

// ==========================================
// CONTEXT DOCUMENTS
// ==========================================

export interface ContextDocument {
  _id: Id<'contextDocuments'>
  userId: Id<'users'>

  filename: string
  fileType: 'csv' | 'pdf' | 'xlsx' | 'txt' | 'md'
  contentType: 'customer_data' | 'investor_data' | 'product_data' | 'metrics' | 'general'

  schema?: ColumnSchema[]
  rowCount: number

  gitPath: string
  convexStorageId?: Id<'_storage'>

  summary?: string
  tags: string[]

  createdAt: number
  updatedAt: number
}

export interface ColumnSchema {
  columnName: string
  dataType: string
  sampleValues: string[]
}

// ==========================================
// TEMPLATES
// ==========================================

export interface ExperimentTemplate {
  _id: Id<'experimentTemplates'>

  name: string
  description: string
  category: 'investors' | 'product' | 'operations' | 'hiring' | 'custom'

  authorId: Id<'users'>
  authorName: string
  isOfficial: boolean

  defaultPersonaCount: number
  defaultStimulus: string

  variables: TemplateVariable[]
  configTemplate: any

  usageCount: number
  avgRating: number
  ratingCount: number

  version: string
  parentTemplateId?: Id<'experimentTemplates'>

  createdAt: number
  updatedAt: number
}

export interface TemplateVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea'
  defaultValue?: any
  options?: string[]
  required: boolean
  placeholder?: string
}

// ==========================================
// PERSONAS
// ==========================================

export interface Persona {
  _id: Id<'personas'>
  userId: Id<'users'>

  name: string
  role: string
  company?: string

  age?: number
  location?: string

  background: string
  beliefs: string[]
  preferences: string[]
  decisionMakingStyle?: string

  generatedFrom?: {
    contextDocId: Id<'contextDocuments'>
    sourceRow?: number
  }

  tags: string[]
  createdAt: number
}

// ==========================================
// EXPERIMENTS
// ==========================================

export interface Experiment {
  _id: Id<'experiments'>
  userId: Id<'users'>

  name: string
  description?: string
  status: 'draft' | 'running' | 'completed' | 'failed'

  templateId?: Id<'experimentTemplates'>
  templateName?: string

  stimulus: string
  personaIds: Id<'personas'>[]
  contextDocIds: Id<'contextDocuments'>[]

  results?: PersonaResult[]
  insights?: ExperimentInsight[]

  gitDecisionLogPath?: string
  gitResultsPath?: string

  executionTime?: number
  costUSD?: number

  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface PersonaResult {
  personaId: Id<'personas'>
  personaName: string
  response: string
  sentiment: number // -1 to 1
  timestamp: number
}

export interface ExperimentInsight {
  insight: string
  supportingEvidence: string[]
  actionableRecommendation: string
}

// ==========================================
// GIT FILE TYPES
// ==========================================

export interface DecisionLog {
  title: string
  date: string
  status: 'evaluating' | 'decided' | 'implemented'
  decisionType: string
  template: {
    id: string
    version: string
  }

  context: {
    situation: string
    metrics: Record<string, any>
  }

  options: DecisionOption[]

  experimentConfig: {
    template: string
    personas: number
    contextFiles: string[]
    stimulus: string
  }

  results?: {
    sentimentBreakdown: {
      positive: number
      neutral: number
      negative: number
    }
    insights: ExperimentInsight[]
    detailedResultsPath: string
  }

  decision?: {
    chosen: string
    rationale: string
    nextSteps: string[]
  }

  notes?: string
  experimentHistory: string[]
}

export interface DecisionOption {
  name: string
  pros: string[]
  cons: string[]
}

export interface ExperimentConfig {
  experimentId: string
  name: string
  createdAt: string
  status: string

  template: {
    id: string
    version: string
  }

  variables: Record<string, any>

  personas: {
    count: number
    types: PersonaTypeConfig[]
  }

  stimulus: string
  contextFiles: ContextFileRef[]

  execution: ExecutionMetadata
  results?: {
    totalResponses: number
    avgSentiment: number
    sentimentBreakdown: {
      positive: number
      neutral: number
      negative: number
    }
  }
}

export interface PersonaTypeConfig {
  type: string
  count: number
}

export interface ContextFileRef {
  path: string
  type: string
  rows?: number
  pages?: number
}

export interface ExecutionMetadata {
  provider: string
  model: string
  parallelism: number
  durationMs: number
  costUSD: number
}
```

---

## 5. Relationships

### 5.1 Entity Relationship Diagram

```
User
  ├── ContextDocuments[]
  ├── Templates[]
  ├── Personas[]
  ├── Experiments[]
  └── Conversations[]

ContextDocument
  ├── uploaded by User
  ├── stored in Git (gitPath)
  ├── used in Personas[]
  └── referenced in Experiments[]

ExperimentTemplate
  ├── created by User
  ├── used in Experiments[]
  ├── forked from ParentTemplate
  └── generates ExperimentConfigs

Persona
  ├── belongs to User
  ├── generated from ContextDocument
  └── used in Experiments[]

Experiment
  ├── created by User
  ├── based on Template
  ├── uses Personas[]
  ├── uses ContextDocuments[]
  ├── stores results in Convex
  ├── stores decision log in Git
  └── stores results in Git
```

### 5.2 Git ↔ Convex Relationships

```
Convex                      Git
──────                      ───

ContextDocument.gitPath  → context/customers.csv
                          (actual file stored in Git)

Experiment._id           → decisions/2026-02-04-seed-vs-bootstrap.md
                          (decision log)

Experiment.gitResultsPath → experiments/exp-001/results.json
                          (detailed results)

Template._id             → templates/custom-investor-eval.yaml
                          (custom template)
```

---

## 6. Indexes & Performance

### 6.1 Critical Indexes

**For User Data**:
```typescript
.index("by_user", ["userId"])           // All user's data
.index("by_email", ["email"])           // Login
```

**For Templates**:
```typescript
.index("by_category", ["category"])     // Browse by category
.index("by_official", ["isOfficial"])   // Official vs custom
.index("by_usage", ["usageCount"])      // Popular templates
```

**For Experiments**:
```typescript
.index("by_user", ["userId"])           // User's experiments
.index("by_status", ["status"])         // Running, completed
.index("by_template", ["templateId"])   // Template usage
```

**For Context Documents**:
```typescript
.index("by_user", ["userId"])           // User's context
.index("by_content_type", ["contentType"]) // Filter by type
```

### 6.2 Query Patterns

**Get user's recent experiments**:
```typescript
const experiments = await ctx.db
  .query('experiments')
  .withIndex('by_user', q => q.eq('userId', userId))
  .order('desc')
  .take(20)
```

**Get official templates by category**:
```typescript
const templates = await ctx.db
  .query('experimentTemplates')
  .withIndex('by_official', q => q.eq('isOfficial', true))
  .filter(q => q.eq(q.field('category'), category))
  .collect()
```

**Get running experiments**:
```typescript
const running = await ctx.db
  .query('experiments')
  .withIndex('by_status', q => q.eq('status', 'running'))
  .collect()
```

---

## 7. Migration Strategy

### 7.1 From Existing Schema

**Current State**: Basic Convex integration from Phase 1

**Migration Steps**:

1. **Add new tables** (Week 3-4):
   - `experimentTemplates`
   - `personas`
   - `experiments`
   - `conversations`

2. **Update contextDocuments** (Week 1-2):
   - Add `gitPath` field
   - Add `schema` field (from parser)
   - Add `contentType` detection

3. **Seed official templates** (Week 3):
   - Create 3 official templates
   - Set `isOfficial: true`
   - Add default variables

4. **No data migration needed**:
   - All new tables start empty
   - Existing user data unchanged

### 7.2 Migration Script

```typescript
// convex/migrations/add-templates.ts

import { mutation } from './_generated/server'

export const seedOfficialTemplates = mutation({
  handler: async (ctx) => {
    const systemUser = await ctx.db
      .query('users')
      .filter(q => q.eq(q.field('email'), 'system@unheard.ai'))
      .first()

    if (!systemUser) {
      throw new Error('System user not found')
    }

    const templates = [
      {
        name: 'Investor Evaluation',
        description: 'Evaluate which investors to approach for funding',
        category: 'investors' as const,
        authorId: systemUser._id,
        authorName: 'Unheard',
        isOfficial: true,
        defaultPersonaCount: 10,
        defaultStimulus: INVESTOR_EVAL_STIMULUS,
        variables: INVESTOR_EVAL_VARIABLES,
        configTemplate: INVESTOR_EVAL_CONFIG,
        usageCount: 0,
        avgRating: 0,
        ratingCount: 0,
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: 'Pricing Strategy',
        description: 'Test different pricing models and price points',
        category: 'product' as const,
        // ... similar structure
      },
      {
        name: 'Product Roadmap',
        description: 'Prioritize features and product decisions',
        category: 'product' as const,
        // ... similar structure
      },
    ]

    for (const template of templates) {
      await ctx.db.insert('experimentTemplates', template)
    }

    console.log('Seeded 3 official templates')
  },
})
```

---

## Summary

This data model design enables:

1. **Cloud Backend (Convex)**:
   - User authentication
   - Template library (official + custom)
   - Context metadata
   - Experiment tracking
   - Real-time collaboration

2. **Git Storage**:
   - Decision logs (Markdown)
   - Experiment configs (YAML)
   - Results (JSON)
   - Context files (CSV, PDF)
   - Full version history

3. **Cloud Execution (Modal)**:
   - Stateless persona generation
   - Parallel experiment execution
   - Results streaming back to Tauri

**Key Features**:
- Git-based collaboration (GitHub workflows)
- Template-driven approach (best practices)
- Context-grounded personas (from real data)
- Full experiment history (Git log)
- Real-time updates (Convex subscriptions)

**Next Steps**:
1. Implement Convex schema (Week 1-2)
2. Implement Git file operations (Week 1-2)
3. Build template system (Week 3-4)
4. Integrate Modal execution (Week 5-6)
5. Build results visualization (Week 7)
