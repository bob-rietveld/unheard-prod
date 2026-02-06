> **LEGACY DOCUMENT** - This references superseded architecture (Electron/Mastra/GPT-4o). See README.md for current architecture.

# Unheard Engine: Complete Requirements & Build Document

## Desktop App with Intelligence Layer Architecture

**Date**: 2026-01-29
**Version**: 3.0 (UX-First Edition)
**Target Architecture**: Electron Desktop with Conversational AI + Template System

---

## Executive Summary

This document captures the complete requirements for rebuilding Unheard as a desktop application using **Electron** (Node.js + React frontend), with an **intelligence layer** that eliminates configuration complexity through conversational AI, proven templates, and automatic optimization.

**Key Architectural Innovation**:

```
User Intent (natural language)
    → Intelligence Layer (AI + Templates + Optimizer)
        → Optimal Execution (parallelized, cost-effective)
            → Insights (10x faster)
```

**Key Architectural Decisions**:

- **Desktop Framework**: Electron (Node.js backend + Vite/React frontend)
- **Intelligence Layer**: 3-tier system (Conversation → Templates → Optimizer)
- **LLM Strategy**: Multi-provider with parallelization (Ollama local, Modal serverless, OpenAI/Anthropic cloud)
- **UX Philosophy**: "Describe your goal" → System handles complexity
- **Data Storage**: Convex for user data + Better-SQLite3 for local tracing/cache
- **Agent Framework**: Mastra (TypeScript/Node.js) - runs natively, no bridge needed
- **Template System**: Official + community library, version-controlled configs

**Critical UX Transformation**:

- **Configuration burden**: 50+ parameters → Natural language conversation
- **Execution time**: 10 minutes → 30 seconds (parallelization)
- **Time to first insight**: 40 minutes → 2 minutes (templates + automation)
- **Learning curve**: Steep → Guided (AI assistant)

**Business Impact**:

- Non-technical users can run experiments
- Team knowledge compounds through templates
- Fast iteration enables rapid learning
- Network effects through community templates

---

## Table of Contents

1. [Core Functionalities to Retain](#1-core-functionalities-to-retain)
2. [Intelligence Layer Architecture](#2-intelligence-layer-architecture)
3. [Technical Architecture](#3-technical-architecture)
4. [Template System Design](#4-template-system-design)
5. [Enhanced Experiment Assistant](#5-enhanced-experiment-assistant)
6. [Execution Optimization](#6-execution-optimization)
7. [Implementation Roadmap (12 Weeks)](#7-implementation-roadmap-12-weeks)
8. [Data Models](#8-data-models)
9. [Success Criteria](#9-success-criteria)
10. [Questions & Decisions](#10-questions--decisions)

---

## 1. Core Functionalities to Retain

### 1.1 MCTS Engine (Monte Carlo Tree Search)

**Purpose**: Discovery of surprising market insights using Bayesian reasoning

**Key Components**:

- **Algorithm**: Four-phase MCTS (Selection, Expansion, Simulation, Backpropagation)
- **Node Selection**: UCB1 (Upper Confidence Bound) with exploration constant √2
- **Reward Function**: Bayesian Surprise via KL divergence
- **Belief Model**: Beta-Bernoulli conjugate prior (α=0.5, β=0.5)
- **Progressive Widening**: Adaptive tree expansion (k × visits^α)

**Implementation Files** (Keep in TypeScript):

- `src/lib/mcts/tree.ts` - Core tree search algorithm
- `src/lib/mcts/surprise.ts` - KL divergence and surprise calculation
- `src/lib/mcts/belief-model.ts` - Beta-Bernoulli belief updates
- `src/lib/autodiscovery/engine.ts` - Enhanced AutoDiscovery engine
- `src/lib/autodiscovery/beliefs.ts` - Advanced belief mathematics

**Mathematical Functions** (implemented locally, no jstat dependency):

- Log-gamma (Lanczos approximation)
- Beta function
- Digamma function (asymptotic expansion)
- Incomplete Beta function (continued fraction)
- Beta CDF/PDF
- Beta distribution sampling

**Input Interface**:

```typescript
interface MCTSConfig {
  maxIterations: number // Default: 500
  explorationConstant: number // Default: 1.414 (√2)
  maxDepth: number // Default: 10
  surprisalThreshold: number // Default: 0.5
  progressiveWideningK: number // Default: 1.0
  progressiveWideningAlpha: number // Default: 0.5
  beliefSamples?: number // LLM samples for belief elicitation
  rewardMode?: 'belief' | 'kl' | 'belief_and_kl'
  parallelExpansion?: number // NEW: Parallel node expansion (default: 10)
  useModal?: boolean // Python sandbox execution
}
```

**Output Interface**:

```typescript
interface MCTSResult {
  totalNodes: number
  bestHypothesis?: string
  bestSurpriseScore?: number
  bestPath: string[]
  hypotheses: HypothesisSummary[]
  stats: ExplorationStats
}
```

### 1.2 Dataset Extraction System (NEW - CRITICAL)

**Purpose**: Transform unstructured experiment responses into structured, validated datasets for AutoDS analysis

**The Critical Gap**: Experiment responses are conversational text (_"I'd pay $50 if it included analytics"_). AutoDS expects structured data (CSV/DataFrame). The Dataset Extraction System bridges this gap.

**Three Extractor Types**:

1. **Survey Extractor** (Semantic Similarity Rating Method)
   - **Use case**: Rating/scale questions, Likert responses, NPS
   - **Method**: SSR (Semantic Similarity Rating) from arxiv:2510.08338v3
   - **Process**:
     1. Embed responses using text-embedding-3-small
     2. Compare to reference statements for each Likert point
     3. Calculate probability distribution via cosine similarity
     4. Extract rating with confidence score
   - **Validation**: KS distance <0.2, correlation attainment >85%
   - **Quality**: >90% correlation with human responses
   - **Best for**: Survey-type experiments with quantitative outputs

2. **Conversation Extractor** (LLM Structured Extraction)
   - **Use case**: Focus groups, interviews, open-ended discussions
   - **Method**: LLM-based extraction with field-level confidence tracking
   - **Process**:
     1. Infer extraction schema from conversation content
     2. Extract structured fields using GPT-4o-mini
     3. Calculate per-field confidence (mentioned in text = 0.9, inferred = 0.3)
     4. Flag low-confidence records for human review
   - **Validation**: >80% field extraction rate, >70% avg confidence
   - **Quality**: Field-level confidence scores, human review workflow
   - **Best for**: Qualitative experiments with thematic analysis

3. **Hybrid Extractor**
   - **Use case**: Mixed quantitative + qualitative experiments
   - **Method**: Combines SSR + LLM extraction
   - **Output**: Merged dataset with both ratings and themes
   - **Best for**: Complex multi-part experiments

**Observability Features** (Full transparency):

- Real-time extraction progress monitoring (UI updates per record)
- Field-level confidence scores (track which fields extracted well)
- Quality dashboard with warnings (flag issues before AutoDS)
- Low-confidence record review UI (human-in-the-loop correction)
- Extraction metrics logging (LLM calls, cost, time, success rate)
- Validation reports with improvement suggestions

**Dataset Output**:

```typescript
interface Dataset {
  experimentId: string
  records: ExtractedRecord[] // Structured rows
  csv: string // CSV format for export
  json: string // JSON format
  dataframeCode: string // Python DataFrame code (ready for AutoDS)
  schema: ExtractionSchema // Field definitions
  stats: DatasetStats // Row/column counts, types, variance
  validation: ValidationResult // Quality checks (errors, warnings, suggestions)
  extractionMethod: 'ssr' | 'llm_structured' | 'hybrid'
  extractionMetrics: ExtractionMetrics // Observability data
  createdAt: number
}
```

**Implementation Files**:

- `src/extraction/ssr-extractor.ts` - Semantic Similarity Rating implementation
- `src/extraction/conversation-extractor.ts` - LLM-based extraction
- `src/extraction/hybrid-extractor.ts` - Combined approach
- `src/extraction/observability.ts` - Monitoring, metrics, validation
- `renderer/src/components/extraction/QualityDashboard.tsx` - Real-time quality UI
- `renderer/src/components/extraction/ReviewWorkflow.tsx` - Human review for low-confidence

**Integration with AutoDS**:

- Runs automatically after experiment completion
- User reviews extraction quality dashboard
- Can re-extract with improved prompts if quality poor
- Only datasets with validation.valid === true can trigger AutoDS
- Dataset saved with full provenance (method, confidence, source)

**Quality Metrics** (Research-Backed):

- **Confidence Score**: Avg probability of extracted values (expect >80%)
- **Extraction Rate**: % of fields successfully extracted (expect >90%)
- **Distributional KS**: Kolmogorov-Smirnov distance from expected (expect <0.2)
- **Correlation Attainment**: % of max achievable correlation (expect >85%)
- **Variance Check**: Numeric fields must have variance (0 = not informative)

### 1.3 Mastra Agent Framework

**Purpose**: Multi-agent persona simulation with realistic human behavior

**Agent Types**:

1. **TinyPerson Agents** (`src/mastra/agents/TinyPerson.ts`)
   - Simulated personas with demographics, personality (Big5), beliefs, behaviors
   - Response simulation with sentiment analysis
   - Configurable model (GPT-4o-mini, Qwen2.5, DeepSeek-V3)

2. **Persona Enrichment Agent** (`src/mastra/agents/PersonaEnrichmentAgent.ts`)
   - AI-driven persona generation from minimal input (company URL + job title)
   - Web scraping (Firecrawl) + search (Tavily) for context
   - Infers realistic traits, beliefs, preferences

3. **Enhanced Experiment Assistant Agent** (`src/mastra/agents/EnhancedExperimentAssistant.ts`) **← NEW**
   - Conversational experiment design (natural language → config)
   - Generates complete `UnheardExperimentConfig` from user intent
   - Asks clarifying questions intelligently
   - Suggests templates from library
   - Explains optimization choices in plain English
   - Iterative refinement through conversation

4. **Discovery Agents** (`src/mastra/agents/discovery/`)
   - `hypothesisGeneratorAgent`: Proposes testable hypotheses
   - `experimentPlannerAgent`: Creates test plans with Python code
   - `experimentAnalystAgent`: Interprets results
   - `beliefElicitorAgent`: Samples boolean beliefs for Bayesian updates
   - `summaryGeneratorAgent`: Creates human-readable summaries

**Network Topologies**:

1. **BroadcastNetwork**: All agents respond simultaneously (parallel) ← **DEFAULT**
   - Use case: Quick surveys, time-sensitive feedback
   - **Performance**: 10 personas in 2s (parallel) vs 20s (sequential)

2. **RoundRobinNetwork**: Sequential responses, agents build on prior responses
   - Use case: Focus groups, consensus building
   - **Performance**: Still benefits from batch processing per round

3. **ModeratedNetwork**: AI moderator guides discussion with follow-ups
   - Use case: Deep exploration, guided discussions
   - **Performance**: Moderator + batch persona responses

**Mastra Configuration** (`src/mastra/index.ts`):

```typescript
const mastra = new Mastra({
  agents: {
    enhancedExperimentAssistant, // NEW
    personaEnrichmentAgent,
    // Discovery agents...
  },
  storage: new LibSQLStore({
    url: process.env.MASTRA_DB_URL || 'file:./mastra.db',
  }),
  observability: {
    default: { enabled: true },
  },
})
```

**AI Provider Integration**:

- OpenAI: GPT-4o, GPT-4o-mini
- Anthropic: Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 3.5
- Ollama: Qwen2.5 (7B/32B/72B), Llama3.3 (70B), DeepSeek-V3
- Modal: Any model via serverless deployment
- Model selection: Auto-selected by optimizer based on user intent

### 1.4 Experiment Management System

**Experiment Workflow** (Complete with Dataset Extraction):

```
User Describes Intent
    ↓
Intelligence Layer (AI Assistant + Template Matcher + Optimizer)
    ↓
Generated Config
    ↓
[User Reviews & Approves]
    ↓
Parallel Execution (10 personas × 3 rounds = 30 responses)
    ↓
Dataset Extraction (NEW - CRITICAL STEP)
  - Select extractor type (Survey/Conversation/Hybrid)
  - Extract structured fields from text responses
  - Calculate field-level confidence scores
  - Validate quality (>80% confidence, >90% extraction rate)
  - Generate observability dashboard
  - Flag low-confidence records for review
  - User reviews & approves extraction
    ↓
Validated Dataset (CSV + JSON + DataFrame code)
    ↓
[Optional] AutoDS Discovery (MCTS with validated dataset)
    ↓
Real-Time Results + AI-Generated Insights
    ↓
Follow-Up Suggestions
```

**Database Schema** (Convex) - See [Section 8: Data Models](#8-data-models)

---

## 2. Intelligence Layer Architecture

### 2.1 Overview: Three-Tier System

The intelligence layer sits between the user and the execution engine, eliminating configuration complexity.

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 1: CONVERSATION                     │
│   Enhanced Experiment Assistant (Mastra Agent)              │
│   - Takes natural language input                            │
│   - Asks clarifying questions                               │
│   - Generates complete configs                              │
│   - Suggests templates                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    TIER 2: TEMPLATES                        │
│   Template Library (Official + Community)                   │
│   - Pre-optimized configs                                   │
│   - Version controlled                                      │
│   - Shareable                                               │
│   - Forkable                                                │
└─────────────────────────────────────────────────────────────┐
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    TIER 3: OPTIMIZER                        │
│   Execution Optimizer                                       │
│   - Selects best LLM provider                               │
│   - Sets parallelism limits                                 │
│   - Estimates cost/time                                     │
│   - Explains choices                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTION ENGINE                         │
│   Parallel LLM calls + MCTS + Mastra agents                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Design Principles

1. **Conversation Over Configuration**
   - User describes goal in natural language
   - System asks questions, not for parameters
   - Technical details hidden by default, accessible if needed

2. **Templates as Starting Points**
   - Official templates for common use cases
   - Community templates for specific industries
   - Every experiment becomes a potential template

3. **Intelligent Defaults**
   - System picks optimal execution strategy
   - User can override with simple intent ("fast", "quality", "cheap")
   - Transparent explanations for all choices

4. **Progressive Disclosure**
   - Simple flow for 80% of users
   - Advanced options available but not required
   - Power users can edit configs directly

### 2.3 User Flows

#### **Flow 1: First-Time User (Template-First)**

```
1. User opens app → "What do you want to learn?"
   Search bar + template categories

2. User types: "pricing" or clicks "Pricing" category
   → Shows "B2B SaaS Pricing Validation" template

3. Template customizer: 3 simple fields
   "Product Name: [____]"
   "Price Point: [$___]"
   "Target Personas: [Select from library]"

4. System shows preview:
   "I'll test your $50 pricing with 10 B2B CTOs
    Using local AI (free, 10 seconds)
    [Run Experiment]"

5. User clicks Run → Experiment executes
   Live progress: "Sarah: '$50 seems reasonable but...'"

6. Results appear in 30 seconds:
   "60% positive sentiment
    Key insight: Bootstrapped founders want $35"

7. AI suggests next step:
   "Want to test tiered pricing? ($35 basic, $50 premium)"

8. User clicks "Yes" → New experiment queued with updated config
```

**Time to first insight: 2 minutes** (was: 40 minutes)

#### **Flow 2: Power User (Conversation-First)**

```
1. User clicks "Start Conversation with AI"

2. User: "I want to explore why churn is high in Q3"

3. AI: "Let me help you design a discovery experiment.
   Do you have specific hypotheses, or want open-ended exploration?"

4. User: "Open-ended"

5. AI: "I'll run MCTS discovery with your churned customer personas.
   Found your 'Q3 Churned Users' persona group (23 personas)
   Using GPT-4o for quality discovery.

   Estimated: 2 minutes, $0.50

   [Show Config] [Adjust] [Run]"

6. User clicks Run → Discovery executes

7. Discovery finds: "Churn spikes when billing exceeds $500/mo"

8. AI: "Want to test:
   A) Payment plans?
   B) Billing caps?
   C) Usage alerts?"

9. User: "B - billing caps"

10. AI generates new config → Experiment runs
```

**Time to insight: 5 minutes** (including deep discovery)

#### **Flow 3: Team Collaboration (Template Sharing)**

```
1. User A creates successful pricing experiment
   Results show clear insights

2. User A: "Save as template"
   → Name: "DevTools Pricing Test"
   → Share: Team only / Public

3. User B (same company) opens app
   → Sees "Recent team templates"
   → "DevTools Pricing Test" by User A (⭐ 5.0, used 23x)

4. User B: Click template
   → Pre-filled with company personas
   → Changes product name
   → Runs in 10 seconds

5. Results saved to team workspace
   → Both can compare pricing tests over time
   → Template improves with usage data
```

**Benefit: Institutional knowledge compounds**

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Layer                  | Technology            | Rationale                               |
| ---------------------- | --------------------- | --------------------------------------- |
| **Desktop Framework**  | Electron              | Node.js runtime, Mastra runs natively   |
| **Frontend**           | Vite + React 18       | Fast dev, smaller bundle than Next.js   |
| **Routing**            | React Router v6       | Replace Next.js App Router              |
| **Main Process**       | Node.js + TypeScript  | Native Mastra, MCTS, LLM orchestration  |
| **Intelligence Layer** | Mastra Agent (GPT-4o) | Conversational config generation        |
| **Agent Framework**    | Mastra (native!)      | No bridge needed - runs in main process |
| **LLM Providers**      | Multi-provider        | Ollama, Modal, OpenAI, Anthropic        |
| **Database (Cloud)**   | Convex                | Real-time sync, templates, experiments  |
| **Database (Local)**   | Better-SQLite3        | Tracing, cache, offline data            |
| **Auth**               | Clerk JWT             | Store token in OS keychain (via keytar) |
| **UI Components**      | shadcn/ui             | Keep existing components                |
| **Styling**            | Tailwind CSS          | Keep existing styles                    |

### 3.2 Directory Structure

```
unheard-desktop/
├── src/                           # Electron main process (Node.js)
│   ├── main.ts                    # Electron entry point
│   ├── preload.ts                 # IPC bridge (contextBridge)
│   │
│   ├── intelligence/              # NEW: Intelligence Layer
│   │   ├── conversation-manager.ts  # Conversation state management
│   │   ├── template-matcher.ts      # Template recommendation
│   │   ├── execution-optimizer.ts   # Auto-optimization
│   │   └── intent-parser.ts         # Parse user intent
│   │
│   ├── config/                    # Config management
│   │   ├── manager.ts             # File I/O, validation
│   │   ├── validator.ts           # Zod schema validation
│   │   └── schema.ts              # TypeScript types
│   │
│   ├── llm/                       # LLM orchestration layer
│   │   ├── orchestrator.ts        # Provider selection, routing
│   │   ├── worker-pool.ts         # Local parallel execution
│   │   ├── rate-limiter.ts        # Concurrency control
│   │   ├── cost-tracker.ts        # Usage & cost tracking
│   │   └── providers/
│   │       ├── base.ts            # Provider interface
│   │       ├── openai.ts          # OpenAI provider
│   │       ├── anthropic.ts       # Anthropic provider
│   │       ├── ollama.ts          # Ollama local models
│   │       └── modal.ts           # Modal serverless
│   │
│   ├── orchestration/             # Experiment execution
│   │   ├── experiment-runner.ts   # Parallel experiment execution
│   │   ├── discovery-runner.ts    # Parallel MCTS
│   │   └── scheduler.ts           # Multi-experiment scheduling
│   │
│   ├── extraction/                # NEW: Dataset Extraction System
│   │   ├── extractor-factory.ts   # Select appropriate extractor
│   │   ├── ssr-extractor.ts       # Semantic Similarity Rating
│   │   ├── conversation-extractor.ts  # LLM structured extraction
│   │   ├── hybrid-extractor.ts    # Combined approach
│   │   ├── observability.ts       # Metrics, monitoring, validation
│   │   ├── schema-inference.ts    # Infer extraction schema
│   │   └── validation.ts          # Quality validation
│   │
│   ├── mcts/                      # MCTS engine (Keep TypeScript!)
│   │   ├── tree.ts                # Core tree search
│   │   ├── surprise.ts            # KL divergence
│   │   ├── beliefs.ts             # Beta-Bernoulli
│   │   └── parallel-expansion.ts  # Parallel node expansion
│   │
│   ├── mastra/                    # Mastra integration (Native!)
│   │   ├── index.ts               # Mastra initialization
│   │   ├── agents/
│   │   │   ├── EnhancedExperimentAssistant.ts  # NEW
│   │   │   ├── TinyPerson.ts
│   │   │   ├── PersonaEnrichmentAgent.ts
│   │   │   └── discovery/
│   │   └── networks/
│   │       ├── BroadcastNetwork.ts
│   │       ├── RoundRobinNetwork.ts
│   │       └── ModeratedNetwork.ts
│   │
│   ├── templates/                 # NEW: Template system
│   │   ├── manager.ts             # Template CRUD
│   │   ├── official-templates.ts  # Bundled templates
│   │   ├── validator.ts           # Template validation
│   │   └── versioning.ts          # Version control
│   │
│   ├── storage/                   # Local storage
│   │   ├── local-db.ts            # Better-SQLite3 wrapper
│   │   ├── keychain.ts            # OS keychain (keytar)
│   │   └── cache.ts               # Results cache
│   │
│   ├── ipc/                       # IPC handlers
│   │   ├── experiments.ts         # Experiment IPC
│   │   ├── discovery.ts           # Discovery IPC
│   │   ├── config.ts              # Config IPC
│   │   ├── templates.ts           # NEW: Template IPC
│   │   ├── conversation.ts        # NEW: AI conversation IPC
│   │   └── personas.ts            # Persona IPC
│   │
│   └── utils/
│       ├── logger.ts
│       └── errors.ts
│
├── renderer/                      # Frontend (Vite + React)
│   ├── src/
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Root with React Router
│   │   ├── router.tsx             # Route definitions
│   │   │
│   │   ├── pages/                 # NEW: Page-level routes
│   │   │   ├── Home.tsx           # Template library + quick start
│   │   │   ├── ConversationPage.tsx  # AI assistant chat
│   │   │   ├── TemplateLibrary.tsx   # Browse/search templates
│   │   │   ├── ExperimentPage.tsx    # Run experiment
│   │   │   ├── ResultsPage.tsx       # View results
│   │   │   └── SettingsPage.tsx      # Settings
│   │   │
│   │   ├── components/            # Existing + new components
│   │   │   ├── intelligence/      # NEW
│   │   │   │   ├── ConversationChat.tsx
│   │   │   │   ├── TemplateCard.tsx
│   │   │   │   ├── TemplateCustomizer.tsx
│   │   │   │   ├── IntentSelector.tsx
│   │   │   │   └── OptimizationPreview.tsx
│   │   │   ├── extraction/       # NEW: Dataset Extraction UI
│   │   │   │   ├── ExtractionMonitor.tsx    # Real-time progress
│   │   │   │   ├── QualityDashboard.tsx     # Quality metrics display
│   │   │   │   ├── ReviewWorkflow.tsx       # Review low-confidence
│   │   │   │   ├── DatasetPreview.tsx       # Preview extracted data
│   │   │   │   └── FieldConfidenceTable.tsx # Per-field quality
│   │   │   ├── experiments/
│   │   │   │   ├── ExperimentWizard.tsx
│   │   │   │   ├── ExperimentProgress.tsx
│   │   │   │   └── ResultsDashboard.tsx
│   │   │   ├── personas/
│   │   │   │   ├── PersonaForm.tsx
│   │   │   │   └── PersonaSelector.tsx
│   │   │   ├── focus-groups/
│   │   │   ├── discovery/
│   │   │   │   └── DiscoveryProgress.tsx
│   │   │   └── ui/                # shadcn/ui
│   │   │
│   │   ├── services/              # API layer
│   │   │   ├── electron-api.ts    # IPC wrapper
│   │   │   ├── convex-client.ts   # Convex wrapper
│   │   │   ├── template-service.ts  # NEW
│   │   │   └── conversation-service.ts  # NEW
│   │   │
│   │   ├── stores/                # State management (Zustand)
│   │   │   ├── auth-store.ts
│   │   │   ├── template-store.ts  # NEW
│   │   │   ├── conversation-store.ts  # NEW
│   │   │   ├── experiment-store.ts
│   │   │   └── settings-store.ts
│   │   │
│   │   └── lib/                   # Utilities
│   │       ├── utils.ts
│   │       └── cn.ts
│   │
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── shared/                        # Shared types (TypeScript)
│   └── types/
│       ├── config.ts              # Config schemas
│       ├── template.ts            # NEW: Template types
│       ├── conversation.ts        # NEW: Conversation types
│       ├── experiment.ts          # Experiment types
│       ├── persona.ts             # Persona types
│       └── llm.ts                 # LLM provider types
│
├── convex/                        # Convex backend
│   ├── schema.ts                  # Updated with template tables
│   ├── experiments/
│   ├── templates/                 # NEW
│   ├── conversations/             # NEW
│   ├── personas/
│   ├── focusGroups/
│   └── discovery/
│
├── package.json                   # Root workspace
├── electron-builder.json          # Build config
└── README.md
```

### 3.3 LLM Parallelization Strategy

**Problem**: Sequential LLM calls create 10+ minute waits

**Solution**: Three-tier parallelization (see original plan for details)

**Performance Impact**:

| Scenario              | Sequential   | Parallelized | Improvement    |
| --------------------- | ------------ | ------------ | -------------- |
| 10 personas, 3 rounds | 60s          | 6s           | **10x faster** |
| 50 personas, 1 round  | 100s         | 5s           | **20x faster** |
| 100-iter MCTS         | 600s (10min) | 60s (1min)   | **10x faster** |

### 3.4 Communication Architecture

```
┌─────────────────────────────────────────────────────┐
│          Renderer Process (React + Vite)            │
│          - Template Library UI                      │
│          - Conversation Chat                        │
│          - Experiment Progress                      │
│          - Convex Client (direct WebSocket)         │
└─────────────────────────────────────────────────────┘
                      │
                      │ IPC (contextBridge)
                      ▼
┌─────────────────────────────────────────────────────┐
│          Main Process (Node.js)                     │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      Intelligence Layer                   │    │
│  │  - Enhanced Assistant Agent               │    │
│  │  - Template Matcher                       │    │
│  │  - Execution Optimizer                    │    │
│  └───────────────────────────────────────────┘    │
│          │           │            │                │
│  ┌───────┴───────────┴────────────┴──────┐        │
│  │      LLM Orchestrator                 │        │
│  │  - Provider selection                 │        │
│  │  - Rate limiting                      │        │
│  │  - Cost tracking                      │        │
│  └───────────────────────────────────────┘        │
│          │           │            │                │
│  ┌───────┴───┐  ┌───┴────┐  ┌───┴───────┐        │
│  │  Worker   │  │ Modal  │  │  OpenAI   │        │
│  │   Pool    │  │Provider│  │ Provider  │        │
│  │(Ollama)   │  └────────┘  └───────────┘        │
│  └───────────┘                                    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      Mastra (Native!)                     │    │
│  │  - Enhanced Assistant                     │    │
│  │  - TinyPerson agents                      │    │
│  │  - Discovery agents                       │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      MCTS Engine (TypeScript)             │    │
│  │  - Parallel node expansion                │    │
│  └───────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Convex (Cloud)       │
         │   - Templates          │
         │   - Experiments        │
         │   - Conversations      │
         └────────────────────────┘
```

---

## 4. Template System Design

### 4.1 Template Architecture

See [Detailed Data Models Document](#task-2) for complete schemas.

**Core Concept**: Every experiment is a config. Successful configs become templates.

**Template Lifecycle**:

```
1. User creates experiment (via assistant or wizard)
2. Experiment succeeds → Results validated
3. User saves as template
4. Template added to personal library
5. User shares template (team/public)
6. Other users discover and fork template
7. Fork becomes new template → Cycle continues
```

**Template Types**:

1. **Official Templates** (Verified ✓)
   - Created by Unheard team
   - Pre-optimized for common use cases
   - Guaranteed to work
   - Shipped with app

2. **Team Templates** (Internal 👥)
   - Created by team members
   - Shared within workspace
   - Can be private or team-visible
   - Build institutional knowledge

3. **Community Templates** (Public 🌐)
   - Shared by users publicly
   - Rated and reviewed
   - Can be forked and modified
   - Network effects

### 4.2 Official Templates (Starter Set)

**Ship with V1: 5 Core Templates**

1. **B2B SaaS Pricing Validation**
   - Category: Pricing
   - Use case: Test price point acceptance
   - Variables: Product name, price, competitors
   - Optimized for: Speed + Cost (Ollama local)
   - Estimated: 10 seconds, $0

2. **Feature Prioritization Survey**
   - Category: Feature Validation
   - Use case: Rank features by customer value
   - Variables: Feature list, criteria
   - Optimized for: Broad feedback (Broadcast network)
   - Estimated: 15 seconds, $0

3. **Marketing Message Testing**
   - Category: Messaging
   - Use case: A/B test value propositions
   - Variables: Message variants (2-5)
   - Optimized for: Quick comparison
   - Estimated: 10 seconds, $0

4. **Competitive Positioning Analysis**
   - Category: Competitive Analysis
   - Use case: Compare vs competitors
   - Variables: Competitor list, differentiators
   - Optimized for: Quality (RoundRobin discussion)
   - Estimated: 30 seconds, $0.05

5. **Open-Ended Market Discovery**
   - Category: Discovery
   - Use case: Explore market with MCTS
   - Variables: Market area, initial hypotheses
   - Optimized for: Deep insights (MCTS + GPT-4o)
   - Estimated: 2 minutes, $0.50

### 4.3 Template Variables

**Purpose**: Make templates reusable by parameterizing key values

**Example**: Pricing Template

```typescript
{
  name: "B2B SaaS Pricing Validation",
  config: {
    experiment: {
      name: "{{productName}} Pricing Test",  // Variable
      context: {
        productName: "{{productName}}",      // Variable
        pricing: "{{pricePoint}}",           // Variable
        competitors: "{{competitors}}",      // Variable
      },
      stimulus: {
        content: "Imagine {{productName}} costs {{pricePoint}}/month..."
      }
    },
    agents: {
      focusGroupId: "{{targetPersonas}}"     // Variable
    }
  },
  variables: [
    {
      key: "productName",
      label: "Product Name",
      type: "text",
      required: true,
      placeholder: "e.g., Slack, Notion, Figma"
    },
    {
      key: "pricePoint",
      label: "Price Point",
      type: "number",
      required: true,
      placeholder: "e.g., 50, 99, 199"
    },
    {
      key: "competitors",
      label: "Competitors (comma-separated)",
      type: "text",
      required: false,
      placeholder: "e.g., Microsoft Teams, Discord"
    },
    {
      key: "targetPersonas",
      label: "Target Personas",
      type: "focusGroup",  // Special type: dropdown of user's focus groups
      required: true
    }
  ]
}
```

### 4.4 Template Discovery & Search

**Search Strategy**:

1. **Semantic Search** (primary)
   - User types: "test messaging"
   - System searches: name, description, solves[], tags[]
   - Returns: "Marketing Message Testing" template

2. **Category Browse**
   - User clicks: "Pricing" category
   - Shows all pricing templates sorted by usage

3. **AI Recommendation** (via Enhanced Assistant)
   - User describes goal
   - Assistant suggests best matching template
   - "Based on your goal, try 'B2B SaaS Pricing Validation'"

4. **Trending/Popular**
   - Most used this week
   - Highest rated
   - Recently added

### 4.5 Template Versioning & Forking

**Version Control**:

```typescript
{
  templateId: "abc123",
  version: "1.2.0",
  parentTemplateId: "xyz789",  // If forked
  changelog: [
    {
      version: "1.2.0",
      changes: "Added competitor comparison",
      author: "user456",
      date: "2026-01-15"
    },
    {
      version: "1.1.0",
      changes: "Optimized for Ollama",
      author: "user123",
      date: "2026-01-10"
    }
  ]
}
```

**Forking Flow**:

```
1. User finds template they like
2. Clicks "Fork" or "Customize"
3. Template copied with parentTemplateId reference
4. User modifies variables/config
5. User saves as new template
6. New template appears in their library
7. Optionally share back to community
```

**Benefits**:

- Templates improve over time
- Attribution preserved
- Users build on each other's work
- Network effects

---

## 5. Enhanced Experiment Assistant

See [Detailed Agent Spec Document](#task-3) for complete implementation.

### 5.1 Core Capabilities

**What it does**:

1. Understands user intent from natural language
2. Asks clarifying questions intelligently
3. Searches template library for matches
4. Generates complete, valid configs
5. Explains optimization choices
6. Iterates based on user feedback
7. Suggests follow-up experiments

**What makes it "enhanced"**:

- **Context-aware**: Knows user's personas, past experiments, templates
- **Template-first**: Always tries to match/fork existing template
- **Optimizer-integrated**: Uses Execution Optimizer for smart defaults
- **Cost-conscious**: Shows cost estimates, suggests cheaper alternatives
- **Iterative**: Multi-turn conversations, not single-shot generation

### 5.2 Agent Architecture

```typescript
const EnhancedExperimentAssistant = new Agent({
  name: 'enhanced-experiment-assistant',
  instructions: `[See detailed spec document]`,
  model: { provider: 'openai', model: 'gpt-4o' },
  tools: [
    searchTemplateLibraryTool,
    getUserPersonasTool,
    getUserFocusGroupsTool,
    validateConfigTool,
    estimateCostTool,
    optimizeExecutionTool,
    getTemplateDetailsTool,
    forkTemplateTool,
  ],
})
```

### 5.3 Conversation Flow Example

```
User: "I want to test if developers will pay $50/mo for my API"
```
