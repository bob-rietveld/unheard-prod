# SLICE 9: Startup Screening (DIALECTIC Integration)

## VC Due Diligence with Argument-Based Multi-Agent Debate

**Date**: 2026-01-29
**Version**: 1.0
**Timeline**: Week 18-19 (2 weeks after SLICE 8)
**Priority**: Optional extension - Expands Unheard into VC/investment domain

---

## Overview

### **What This Adds**

Extends Unheard with **DIALECTIC-style startup screening** capabilities, enabling venture capital investors to:

- Evaluate startups through simulated VC debates
- Generate pro/contra investment arguments from facts
- Iteratively critique and refine arguments (survival of fittest)
- Score argument quality using 14-criteria framework
- Rank startups by decision scores for prioritization

**Based on**: "DIALECTIC: A Multi-Agent System for Startup Evaluation" (Bae et al., 2025)

- Paper: arxiv.org/DIALECTIC
- Code: github.com/pantageepapa/DIALECTIC

### **Value Proposition**

**For VCs**:

- Screen 100s of startups efficiently
- Get ranked decision scores (prioritize top opportunities)
- See transparent pro/contra arguments (interpretable)
- Iterative reasoning (matches how VCs actually think)

**For Unheard Platform**:

- Expands TAM (venture capital market)
- Leverages existing architecture (Mastra, MCTS, Context)
- Reuses 80% of existing code
- New use case demonstrates platform flexibility

---

## Architecture: DIALECTIC Integration

### **DIALECTIC's 3-Phase Pipeline**

```
Phase 1: Fact Collection
  ↓
Phase 2: Reasoning (Pro/Contra Debate)
  ↓
Phase 3: Decision (Ranked Scoring)
```

### **How It Maps to Unheard**

```
┌────────────────────────────────────────────────────────────┐
│  PHASE 1: FACT COLLECTION (Unheard Context System)        │
├────────────────────────────────────────────────────────────┤
│  DIALECTIC: Question trees + web search                    │
│  Unheard:   Context upload + CRM + RAG (BETTER!)          │
│                                                             │
│  Input:                                                     │
│    - Startup pitch deck (PDF)                              │
│    - Crunchbase data (CSV/API)                             │
│    - Website content (scraped)                             │
│    - Search results (Perplexity/Tavily)                    │
│                                                             │
│  Output: Hierarchical fact base                            │
│    Q: "What is the TAM?"                                   │
│    A: "$50B in cloud infrastructure market"                │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│  PHASE 2: REASONING (NEW - Debate Network)                │
├────────────────────────────────────────────────────────────┤
│  Step 1: Generate Arguments                                │
│    Pro agents (5): "Strong team with 2 exits..."          │
│    Contra agents (5): "Market too crowded..."             │
│                                                             │
│  Step 2: Critique (Devil's Advocate)                       │
│    Critic: "The team argument ignores lack of domain      │
│             expertise in enterprise sales..."              │
│                                                             │
│  Step 3: Evaluate (14-Criteria Scoring)                    │
│    Argument quality score: 89/98 (14 criteria × 7 max)    │
│                                                             │
│  Step 4: Refine (Improve Based on Critique)                │
│    Refined: "Strong technical team, but should add         │
│              enterprise sales leader before Series A..."   │
│                                                             │
│  Step 5: Survival of Fittest                               │
│    Round 1: 10 pro, 10 contra → Keep top 5 each           │
│    Round 2: 5 pro, 5 contra → Keep top 3 each             │
│    Round 3: 3 pro, 3 contra → Final arguments             │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│  PHASE 3: DECISION (Scoring + Ranking)                    │
├────────────────────────────────────────────────────────────┤
│  Decision Score = Σ(pro scores) - Σ(contra scores)        │
│                                                             │
│  Example:                                                   │
│    Pro scores: 89 + 87 + 84 = 260                         │
│    Contra scores: 78 + 75 + 71 = 224                      │
│    Decision: 260 - 224 = +36 → INVEST ✅                   │
│                                                             │
│  Ranking: Sort all startups by decision score              │
│    1. Startup A: +42 (strong invest)                       │
│    2. Startup B: +36 (invest)                              │
│    3. Startup C: +12 (marginal)                            │
│    ...                                                      │
│    50. Startup Z: -28 (pass)                               │
└────────────────────────────────────────────────────────────┘
```

---

## New Components to Implement

### **1. Debate Network Topology**

```typescript
// src/mastra/networks/DebateNetwork.ts

export interface DebateConfig {
  proAgentCount: number // Default: 5
  contraAgentCount: number // Default: 5
  maxRounds: number // Default: 3
  argumentsKeptPerRound: number[] // [10, 5, 3]
  decisionThreshold: number // Default: 0
}

export class DebateNetwork extends NetworkTopology {
  private config: DebateConfig
  private evaluator: ArgumentEvaluatorAgent
  private refiner: ArgumentRefinerAgent

  async execute(
    factBase: FactBase,
    stimulus: Stimulus,
    config: DebateConfig
  ): Promise<DebateResult> {
    // Round 0: Generate initial arguments
    const proAgents = this.createProAgents(config.proAgentCount)
    const contraAgents = this.createContraAgents(config.contraAgentCount)

    let proArguments = await this.generateArguments(proAgents, factBase, 'pro')
    let contraArguments = await this.generateArguments(
      contraAgents,
      factBase,
      'contra'
    )

    // Iterative refinement (T rounds)
    for (let round = 0; round < config.maxRounds; round++) {
      // Critique each argument
      const proCritiques = await this.critiqueArguments(
        proArguments,
        'contra', // Contra agents critique pro arguments
        factBase
      )
      const contraCritiques = await this.critiqueArguments(
        contraArguments,
        'pro', // Pro agents critique contra arguments
        factBase
      )

      // Evaluate argument quality (14 criteria)
      const proScores = await this.evaluateArguments(proArguments, proCritiques)
      const contraScores = await this.evaluateArguments(
        contraArguments,
        contraCritiques
      )

      // Keep top K arguments (survival of fittest)
      const K = config.argumentsKeptPerRound[round]
      proArguments = this.selectTopK(proArguments, proScores, K)
      contraArguments = this.selectTopK(contraArguments, contraScores, K)

      // Refine survivors
      proArguments = await this.refineArguments(
        proArguments,
        proCritiques,
        proScores,
        factBase
      )
      contraArguments = await this.refineArguments(
        contraArguments,
        contraCritiques,
        contraScores,
        factBase
      )

      // Emit progress
      this.emit('round-complete', {
        round,
        proArgumentsCount: proArguments.length,
        contraArgumentsCount: contraArguments.length,
        avgProScore: this.average(proScores),
        avgContraScore: this.average(contraScores),
      })
    }

    // Calculate decision score
    const finalProScore = this.sumScores(proArguments)
    const finalContraScore = this.sumScores(contraArguments)
    const decisionScore = finalProScore - finalContraScore
    const decision =
      decisionScore > config.decisionThreshold ? 'invest' : 'pass'

    return {
      decision,
      decisionScore,
      proArguments: proArguments.map(a => ({
        text: a.text,
        score: a.qualityScore,
        referencedFacts: a.factIds,
      })),
      contraArguments: contraArguments.map(a => ({
        text: a.text,
        score: a.qualityScore,
        referencedFacts: a.factIds,
      })),
      debugInfo: {
        finalProScore,
        finalContraScore,
        rounds: config.maxRounds,
      },
    }
  }
}
```

### **2. Six New Agents (from DIALECTIC)**

**Agent 1: Question Decomposer**

```typescript
const QuestionDecomposerAgent = new Agent({
  name: 'question-decomposer',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
You decompose complex VC questions into hierarchical question trees.

Given a seed question like "How large is the company's market opportunity?",
decompose it into sub-questions:
  - What is the TAM (Total Addressable Market)?
    - What customer segments are included?
    - What is total industry revenue?
  - What is the SAM (Serviceable Available Market)?
  - What is the SOM (Serviceable Obtainable Market)?

Customize questions for the startup's specific industry.

Return JSON tree structure.
`,
})
```

**Agent 2: Fact Answerer**

```typescript
const FactAnswererAgent = new Agent({
  name: 'fact-answerer',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
Answer questions about a startup using:
- Provided company data (description, team, product, market)
- Web search tool (for market data, competitors, trends)

Keep answers concise (<50 words) and data-backed.
Answer questions in post-order traversal (leaf nodes first).
`,
  tools: {
    webSearch: searchTool, // Perplexity or Tavily
  },
})
```

**Agent 3: Argument Generator (Pro/Contra)**

```typescript
const ArgumentGeneratorAgent = new Agent({
  name: 'argument-generator',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
Generate investment arguments (pro OR contra) based on facts.

Each argument should:
- Be concise (max 100 words)
- Cite specific facts from the fact base
- Address the 14 argument quality criteria
- Provide unique perspective

Generate {K} arguments per stance.
`,
})
```

**Agent 4: Argument Critic**

```typescript
const ArgumentCriticAgent = new Agent({
  name: 'argument-critic',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
You are a devil's advocate. Your job:
- Critique the given argument using facts
- Point out logical flaws
- Challenge assumptions
- Be direct and persuasive

If critiquing PRO argument: Argue why NOT to invest
If critiquing CONTRA argument: Argue why TO invest

Keep critique concise (3-4 sentences).
`,
})
```

**Agent 5: Argument Evaluator**

```typescript
const ArgumentEvaluatorAgent = new Agent({
  name: 'argument-evaluator',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
Evaluate argument quality using 14 criteria (from Wachsmuth et al., 2017):

LOCAL QUALITY:
1. Local Acceptability (1-7): Are premises believable given facts?
2. Local Relevance (1-7): Do premises support the conclusion?
3. Local Sufficiency (1-7): Enough support for conclusion?

RHETORICAL QUALITY:
4. Cogency (1-7): Acceptable + relevant + sufficient?
5. Credibility (1-7): Author appears trustworthy?
6. Emotional Appeal (1-7): Creates receptive emotions?
7. Clarity (1-7): Clear, unambiguous language?
8. Appropriateness (1-7): Professional VC discussion style?
9. Arrangement (1-7): Logical structure?
10. Effectiveness (1-7): Persuasive to VCs?

GLOBAL QUALITY:
11. Global Acceptability (1-7): Valid to most VCs?
12. Global Relevance (1-7): Contributes to investment question?
13. Global Sufficiency (1-7): Anticipates counter-arguments?
14. Reasonableness (1-7): Balanced and acceptable resolution?

Return:
- Score for each criterion (1-7)
- Brief feedback for each (1 sentence)
- Total quality score (sum of 14 scores, max 98)
`,
})
```

**Agent 6: Argument Refiner**

```typescript
const ArgumentRefinerAgent = new Agent({
  name: 'argument-refiner',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
Refine an argument based on:
- The critique received
- The quality scores (which criteria are weak)
- The fact base (add more evidence)

Improve the argument to address weaknesses while maintaining its core thesis.

Keep refined argument concise (max 100 words).
`,
})
```

### **3. Startup Screening Template**

```typescript
// Official template for VC use case

export const StartupScreeningTemplate: ExperimentTemplate = {
  id: 'official-startup-screening',
  name: 'VC Startup Due Diligence',
  description:
    'Evaluate startups through simulated VC debate with pro/contra arguments',
  category: 'investment_analysis',

  config: {
    experiment: {
      name: '{{companyName}} Investment Evaluation',
      type: 'debate', // NEW experiment type
      hypothesis: {
        statement: 'Should we invest in {{companyName}}?',
        category: 'investment',
      },
      stimulus: {
        type: 'startup_data',
        content: `
COMPANY: {{companyName}}

DESCRIPTION:
{{shortDescription}}

{{longDescription}}

TEAM:
{{teamMembers}}

PRODUCT:
{{productDescription}}

MARKET:
{{industry}} - {{marketSize}}

TRACTION:
{{metrics}}

FUNDRAISING:
Round: {{fundingRound}}
Amount: {{fundingAmount}}
Valuation: {{valuation}}
`,
      },
    },

    agents: {
      network: {
        topology: 'debate',
        proAgentCount: 5,
        contraAgentCount: 5,
        maxRounds: 3,
        argumentsKeptPerRound: [10, 5, 3], // Survival of fittest
        decisionThreshold: 0,
      },
    },

    execution: {
      llmStrategy: 'quality-first', // Use GPT-4o for reasoning
      models: {
        decomposer: 'gpt-4o',
        answerer: 'gpt-4o',
        generator: 'gpt-4o',
        critic: 'gpt-4o',
        evaluator: 'gpt-4o',
        refiner: 'gpt-4o',
      },
    },

    discovery: {
      enabled: true,
      trigger: 'after_debate',
      config: {
        maxIterations: 50,
        focusAreas: ['team_risks', 'market_risks', 'competitive_threats'],
      },
    },
  },

  variables: [
    { key: 'companyName', label: 'Company Name', type: 'text', required: true },
    {
      key: 'shortDescription',
      label: 'One-line Description',
      type: 'text',
      required: true,
    },
    {
      key: 'longDescription',
      label: 'Full Description',
      type: 'textarea',
      required: false,
    },
    {
      key: 'teamMembers',
      label: 'Team (names, roles, backgrounds)',
      type: 'textarea',
      required: true,
    },
    {
      key: 'productDescription',
      label: 'Product Description',
      type: 'textarea',
      required: true,
    },
    { key: 'industry', label: 'Industry', type: 'text', required: true },
    {
      key: 'marketSize',
      label: 'Market Size (TAM/SAM)',
      type: 'text',
      required: false,
    },
    {
      key: 'metrics',
      label: 'Traction Metrics (MRR, users, growth)',
      type: 'textarea',
      required: false,
    },
    {
      key: 'fundingRound',
      label: 'Funding Round',
      type: 'select',
      required: true,
      validation: { options: ['Pre-seed', 'Seed', 'Series A', 'Series B'] },
    },
    {
      key: 'fundingAmount',
      label: 'Funding Amount',
      type: 'text',
      required: false,
    },
    { key: 'valuation', label: 'Valuation', type: 'text', required: false },
  ],

  solves: [
    'startup screening',
    'due diligence',
    'investment evaluation',
    'VC decision',
  ],
  audience: ['Venture Capitalists', 'Angel Investors', 'Fund Managers'],
  tags: ['vc', 'investment', 'startup', 'due-diligence', 'dialectic'],

  verified: true,
  featured: true,
}
```

---

## Implementation Details

### **File Structure**

```
src/
├── mastra/
│   ├── agents/
│   │   ├── debate/                    # NEW
│   │   │   ├── QuestionDecomposer.ts
│   │   │   ├── FactAnswerer.ts
│   │   │   ├── ArgumentGenerator.ts
│   │   │   ├── ArgumentCritic.ts
│   │   │   ├── ArgumentEvaluator.ts
│   │   │   └── ArgumentRefiner.ts
│   │   └── ...
│   ├── networks/
│   │   ├── DebateNetwork.ts           # NEW
│   │   └── ...
│   └── ...
│
├── templates/
│   └── official-templates.ts          # Add StartupScreeningTemplate
│
└── types/
    └── debate.ts                       # NEW: Debate-specific types

renderer/src/components/
├── debate/                             # NEW
│   ├── DebateProgress.tsx              # Live debate visualization
│   ├── ArgumentCard.tsx                # Display argument + score
│   ├── DecisionScoreCard.tsx           # Final decision display
│   └── StartupRanking.tsx              # Ranked list of startups
```

### **Data Models**

```typescript
// shared/types/debate.ts

export interface FactBase {
  questions: QuestionTree[]
  answers: Answer[]
}

export interface QuestionTree {
  question: string
  subQuestions?: QuestionTree[]
  answer?: string
}

export interface Argument {
  id: string
  stance: 'pro' | 'contra'
  text: string
  referencedFacts: string[] // Fact IDs
  qualityScore?: number // Sum of 14 criteria (max 98)
  criteriaScores?: Record<string, number> // Individual scores
  critique?: string
  iteration: number
}

export interface DebateResult {
  decision: 'invest' | 'pass'
  decisionScore: number
  confidence: number

  finalProArguments: Argument[]
  finalContraArguments: Argument[]

  allProArguments: Argument[][] // Per round
  allContraArguments: Argument[][]

  debugInfo: {
    rounds: number
    finalProScore: number
    finalContraScore: number
    factCount: number
  }
}

export interface StartupEvaluation {
  _id: Id<'startupEvaluations'>
  userId: Id<'users'>

  // Startup data
  companyName: string
  industry: string
  fundingRound: string

  // Fact base
  factBase: FactBase

  // Debate result
  debateResult: DebateResult

  // Metadata
  createdAt: number
  completedAt: number
}
```

### **Convex Schema Updates**

```typescript
// convex/schema.ts - ADD

startupEvaluations: defineTable({
  userId: v.id("users"),

  // Startup info
  companyName: v.string(),
  shortDescription: v.string(),
  industry: v.string(),
  fundingRound: v.string(),

  // Context data
  pitchDeckId: v.optional(v.id("contextDocuments")),
  crunchbaseData: v.optional(v.any()),

  // Fact collection
  factBase: v.any(),  // QuestionTree[] + Answer[]

  // Debate result
  debateResult: v.any(),  // DebateResult

  // Decision
  decision: v.union(v.literal("invest"), v.literal("pass")),
  decisionScore: v.number(),
  confidence: v.number(),

  // Status
  status: v.union(
    v.literal("collecting_facts"),
    v.literal("debating"),
    v.literal("completed"),
    v.literal("failed")
  ),

  createdAt: v.number(),
  completedAt: v.optional(v.number()),
})
.index("by_user", ["userId"])
.index("by_decision_score", ["decisionScore"])
.index("by_decision", ["decision"]),
```

---

## User Experience

### **Flow 1: Single Startup Evaluation**

```
1. User selects "VC Startup Due Diligence" template

2. Upload startup data:
   - Drag pitch deck (PDF)
   - Paste Crunchbase URL or upload CSV
   - Optional: Website URL for scraping

3. System extracts facts:
   "Collecting facts...
    ✓ Company: CloudQueue
    ✓ Team: 3 founders (2 technical, 1 business)
    ✓ Product: Background job processing API
    ✓ Market: $50B TAM in cloud infrastructure
    ✓ Traction: 120 customers, $15K MRR, 20% MoM growth"

4. User clicks "Run Evaluation"

5. Debate starts (live visualization):
   "Round 1/3: Generating arguments...
    Pro: 10 arguments generated
    Contra: 10 arguments generated

    Critiquing...
    Evaluating...

    Top Pro: 'Strong technical team with prior exit at LogScale' (score: 89)
    Top Contra: 'Crowded market with 15 competitors' (score: 78)

    Keeping top 5 pro + 5 contra..."

6. After 3 rounds (2 minutes):
   ┌──────────────────────────────────────────────────────┐
   │  ✅ Evaluation Complete                              │
   │  Decision: INVEST ✅                                 │
   │  Score: +36 (260 pro - 224 contra)                  │
   │  Confidence: 78%                                     │
   ├──────────────────────────────────────────────────────┤
   │  Top Pro Arguments:                                  │
   │  ⭐⭐⭐⭐⭐ (89/98)                                    │
   │  "Strong technical team with 2 prior exits.          │
   │   Founder led eng at LogScale (acquired for $200M).  │
   │   Deep domain expertise in distributed systems."     │
   │   [Referenced: Team Q&A, Prior Experience]           │
   │                                                       │
   │  ⭐⭐⭐⭐⭐ (87/98)                                    │
   │  "Clear wedge in underserved SMB market.             │
   │   20% MoM growth shows strong PMF.                   │
   │   Currently no dominant player in this segment."     │
   │   [Referenced: Market Q&A, Traction Metrics]         │
   │                                                       │
   │  Top Contra Arguments:                               │
   │  ⭐⭐⭐⭐ (78/98)                                     │
   │  "Crowded market with 15 competitors including AWS.  │
   │   Lack of moat - easily replicable technology.       │
   │   Team has no enterprise sales experience."          │
   │   [Referenced: Competitive Landscape, Team]          │
   │                                                       │
   │  💡 Recommendation: INVEST                           │
   │     Strong team + growing market outweigh risks      │
   │                                                       │
   │  [View Full Debate] [Export Memo] [Add to Pipeline] │
   └──────────────────────────────────────────────────────┘

7. Optional: Run AutoDS discovery
   "🔍 Discovery found surprising pattern:
    Startups with technical co-founders 3x more likely
    to succeed in infrastructure market (p=0.01)"
```

### **Flow 2: Batch Screening (Multiple Startups)**

```
1. User uploads CSV with 50 startups:
   company_name,description,team,product,market,metrics,funding_round

2. System: "Found 50 startups. Evaluate all?"

3. User clicks "Batch Evaluate"

4. System runs debate for each startup (parallel):
   "Evaluating... 12/50 complete
    Avg time per startup: 90 seconds"

5. After 75 minutes (50 × 90s = 75min):
   ┌──────────────────────────────────────────────────────┐
   │  📊 Batch Evaluation Complete (50 startups)          │
   │  Ranked by Decision Score:                           │
   ├──────────────────────────────────────────────────────┤
   │  Rank  Company         Score  Decision   Confidence  │
   │  ────  ──────────────  ─────  ────────   ──────────  │
   │  1.    CloudQueue      +42    INVEST ✅   85%        │
   │  2.    DataSync        +38    INVEST ✅   82%        │
   │  3.    APIFlow         +12    INVEST ✅   68%        │
   │  4.    LogStream       +8     INVEST ✅   62%        │
   │  5.    QueueMaster     +3     INVEST ✅   58%        │
   │  ...                                                  │
   │  15.   SlowStartup     -5     PASS ❌     71%        │
   │  ...                                                  │
   │  50.   BadIdea         -34    PASS ❌     89%        │
   │                                                       │
   │  [Export Top 10] [View Details] [Compare]            │
   └──────────────────────────────────────────────────────┘

6. User exports top 10 for deeper due diligence
```

---

## Integration with Existing Slices

### **Builds On**:

- **Slice 2 (Context)**: Upload pitch decks, Crunchbase data
- **Slice 4 (AutoDS)**: Question tree decomposition, discovery
- **Slice 5 (Templates)**: Startup screening as official template
- **Slice 6 (AI Assistant)**: "Evaluate this startup" → Config generation

### **Enhances**:

- **Slice 4 (AutoDS)**: Discovery can find patterns across portfolio
  - "Which founder backgrounds correlate with success?"
  - "What markets have highest success rate?"
  - "What traction metrics predict Series A?"

### **Reuses**:

- Context system (fact collection)
- Mastra framework (agent orchestration)
- LLM orchestrator (provider selection)
- Template system (reusable configs)
- Convex (storage)

**New Code Needed**: ~20% (6 agents + debate network + UI)
**Existing Code Reused**: ~80%

---

## Implementation Plan: 2 Weeks

### **Week 1: Agents + Debate Network**

**Day 1-2: Question Decomposer + Fact Answerer**

- [ ] Implement QuestionDecomposerAgent
- [ ] Implement FactAnswererAgent
- [ ] Test: Seed question → Question tree → Answers
- [ ] Integrate web search tool (Perplexity/Tavily)

**Day 3-4: Argument Generation + Critique**

- [ ] Implement ArgumentGeneratorAgent (pro/contra)
- [ ] Implement ArgumentCriticAgent
- [ ] Test: Facts → Arguments → Critiques

**Day 5: Evaluation + Refinement**

- [ ] Implement ArgumentEvaluatorAgent (14 criteria)
- [ ] Implement ArgumentRefinerAgent
- [ ] Test: Argument → Critique → Score → Refined argument

**Day 6-7: Debate Network**

- [ ] Implement DebateNetwork topology
- [ ] Integrate all 6 agents
- [ ] Implement iterative loop (generate → critique → evaluate → refine → select top K)
- [ ] Test end-to-end debate

**Deliverable**: Working debate network

---

### **Week 2: Template + UI + Integration**

**Day 8-9: Startup Screening Template**

- [ ] Create StartupScreeningTemplate
- [ ] Add to official templates library
- [ ] Implement variable substitution for startup data
- [ ] Test template customization

**Day 10-11: UI Components**

- [ ] DebateProgress component (live debate visualization)
- [ ] ArgumentCard component (display argument + score + facts)
- [ ] DecisionScoreCard component (final decision display)
- [ ] StartupRanking component (batch evaluation ranking)

**Day 12-13: Integration + Testing**

- [ ] Integrate with context upload (pitch deck → facts)
- [ ] Integrate with AI Assistant ("Evaluate this startup")
- [ ] Batch evaluation flow (CSV upload → multiple startups)
- [ ] E2E test: Upload startup data → Run debate → See decision

**Day 14: Polish + Documentation**

- [ ] Add to template library UI
- [ ] Update documentation
- [ ] Create demo video
- [ ] Export functionality (investment memo generation)

**Deliverable**: Complete startup screening feature

---

## Success Criteria

### **Functional**

- [ ] User can upload startup data (pitch deck, Crunchbase, website)
- [ ] System generates hierarchical fact base
- [ ] Debate generates pro/contra arguments
- [ ] Arguments are iteratively refined over 3 rounds
- [ ] Arguments scored using 14 criteria
- [ ] Decision score calculated correctly
- [ ] Can evaluate single startup or batch (CSV upload)

### **Quality**

- [ ] Argument quality scores improve with each iteration
- [ ] Top arguments cite specific facts
- [ ] Decision scores separate successful/unsuccessful startups
- [ ] Precision matches or exceeds DIALECTIC paper results (33%)

### **Performance**

- [ ] Single startup evaluation < 2 minutes
- [ ] Batch 50 startups < 90 minutes
- [ ] Argument generation uses fact base efficiently
- [ ] Cost per evaluation < $0.50 (with GPT-4o)

---

## Cost Analysis

### **Per Startup Evaluation**

```
Fact Collection:
- Question decomposition: 4 questions × 1 call = 4 calls
- Fact answering: ~20 sub-questions × 1 call = 20 calls
- Web search: ~5 searches × 1 call = 5 calls
Subtotal: 29 calls × $0.01 = $0.29

Debate (3 rounds):
- Round 1: Generate 20 arguments (10 pro + 10 contra) = 20 calls
- Round 1: Critique 20 arguments = 20 calls
- Round 1: Evaluate 20 arguments = 20 calls
- Round 1: Refine 10 survivors = 10 calls
- Round 2: Similar (fewer arguments) = 30 calls
- Round 3: Similar (even fewer) = 20 calls
Subtotal: 120 calls × $0.005 = $0.60

Total per startup: ~$0.90

With optimization (use GPT-4o-mini for some tasks):
- Fact answering: GPT-4o-mini = $0.05
- Argument generation: GPT-4o-mini = $0.10
- Critical tasks only (evaluate, refine): GPT-4o = $0.30
Total optimized: ~$0.45 per startup
```

### **Batch 50 Startups**

```
Cost: 50 × $0.45 = $22.50
Time: 50 × 90s = 75 minutes (can parallelize to ~10-15 min)

Value:
- Replace 40+ hours of manual screening
- Consistent evaluation (no bias)
- Ranked prioritization (focus on top 10)
- Interpretable arguments (use in memos)

ROI: $22.50 for 40 hours saved = $0.56/hour → 100x+ ROI
```

---

## Enhanced Features (Beyond DIALECTIC)

### **1. Portfolio-Level Discovery**

```
After evaluating 100 startups, run AutoDS on the full dataset:

Questions:
- Which founder backgrounds correlate with success?
- What markets have highest success rate?
- What traction metrics predict Series A?
- Which argument types are most predictive?

Output:
"🎯 Portfolio Insights:
 - Founders with prior exits 4x more likely to succeed
 - Enterprise SaaS has 3x higher success rate than consumer
 - >$10K MRR at seed stage predicts 80% Series A success"
```

### **2. Argument Quality Trends**

```
Track which arguments are most predictive:

High-quality pro arguments for successful companies:
  - "Strong technical team" (avg score: 92, appeared in 80% of successful)
  - "Clear market wedge" (avg score: 88, appeared in 75% of successful)

Low-quality contra arguments (false negatives):
  - "Crowded market" (score: 75, but 60% still succeeded)
  - "No moat yet" (score: 73, but 55% built moats later)

Use this to improve evaluation prompts over time.
```

### **3. Comparison to Portfolio**

```
Compare new startup to existing portfolio:

"CloudQueue is similar to LogScale (prior exit at $200M):
 - Same market (infrastructure)
 - Similar team background (technical founders)
 - Comparable traction ($15K MRR vs $12K at same stage)

 Argument: 'This could be another LogScale' (score: 94)

 Confidence: 85% based on portfolio similarity"
```

---

## Updated Timeline

### **Original Plan**

```
Weeks 1-9: Slices 1-4 (MVP)
Weeks 10-13: Slices 5-6 (V1.0)
Weeks 14-17: Slices 7-8 (V1.5)

Total: 17 weeks
```

### **With SLICE 9**

```
Weeks 1-9: Slices 1-4 (MVP)
Weeks 10-13: Slices 5-6 (V1.0)
Weeks 14-17: Slices 7-8 (V1.5)
Weeks 18-19: SLICE 9 (VC Extension) ← NEW

Total: 19 weeks
```

**OR** (Aggressive):

```
Implement SLICE 9 in parallel with SLICE 7-8:
- One developer: Optimization (Slice 7-8)
- Another developer: Startup Screening (Slice 9)

Total: Still 17 weeks (if you have 2 developers)
```

---

## Market Opportunity

### **New Customer Segment: VCs**

**Market Size**:

- 1,000+ VC firms globally
- Average 5-10 partners per firm
- Each screens 500-1000 startups/year
- Total addressable market: 500K-1M startup evaluations/year

**Pricing Model** (SaaS for VCs):

- Tier 1: $500/month (50 evaluations/month)
- Tier 2: $2,000/month (250 evaluations/month)
- Tier 3: Enterprise (unlimited, API access)

**Revenue Potential**: $500K-2M ARR from 100-500 VC customers

### **Competitive Advantage**

| Feature                | Traditional ML Tools       | DIALECTIC (Paper)    | Unheard SLICE 9                 |
| ---------------------- | -------------------------- | -------------------- | ------------------------------- |
| **Interpretability**   | Feature importance         | Pro/contra arguments | Pro/contra + portfolio insights |
| **Reasoning**          | Black box XGBoost          | Iterative debate     | Debate + Bayesian discovery     |
| **Context**            | Manual feature engineering | Web search           | CRM + documents + RAG           |
| **Batch Screening**    | ✅                         | ✅                   | ✅                              |
| **Portfolio Analysis** | ❌                         | ❌                   | ✅ (AutoDS across portfolio)    |
| **Template Library**   | ❌                         | ❌                   | ✅ (reusable configs)           |
| **UI**                 | ❌ Scripts only            | ❌ Scripts only      | ✅ Beautiful desktop app        |

---

## Summary

### **SLICE 9 Adds**:

1. **6 New Agents** (DIALECTIC methodology)
   - Question Decomposer
   - Fact Answerer
   - Argument Generator (pro/contra)
   - Argument Critic
   - Argument Evaluator (14-criteria)
   - Argument Refiner

2. **Debate Network Topology**
   - Pro vs contra agents
   - Iterative critique-evaluate-refine loop
   - Survival of fittest (keep top K)

3. **Startup Screening Template**
   - Upload startup data
   - Evaluate via debate
   - Get ranked decision scores

4. **Batch Evaluation**
   - Screen 50+ startups
   - Ranked prioritization
   - Export top N for due diligence

5. **Portfolio Discovery** (Unique to Unheard)
   - Pattern analysis across evaluations
   - Predictive insights
   - Continuous learning

### **Effort**: 2 weeks

### **Value**: Opens entire VC market

### **Reuse**: 80% of existing code

**This transforms Unheard from "market research tool" to "market research + investment screening platform"**

Want me to:

1. **Add SLICE 9 to flow-next** (create epic + tasks)?
2. **Write the production code** for the debate network?
3. **Update the main plan** with SLICE 9 integration?
4. **Create UI mockups** for startup evaluation interface?
