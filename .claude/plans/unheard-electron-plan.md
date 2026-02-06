> **LEGACY DOCUMENT** - This references superseded architecture (Electron/Mastra/GPT-4o). See README.md for current architecture.

# Unheard Engine: Complete Requirements & Build Document

## Desktop + Parallelization-First Architecture

**Date**: 2026-01-29
**Version**: 2.0 (Electron Edition)
**Target Architecture**: Electron Desktop App with Parallel LLM Execution

---

## Executive Summary

This document captures the complete requirements for rebuilding Unheard as a desktop application using **Electron** (Node.js + React frontend), with **parallelization-first LLM architecture**, hybrid local/cloud models, config-driven experiment orchestration, and retained Convex backend with Mastra agent framework.

**Key Architectural Decisions**:

- **Desktop Framework**: Electron (Node.js backend + Vite/React frontend)
- **LLM Strategy**: Multi-provider with parallelization (Ollama local, Modal serverless, OpenAI/Anthropic cloud)
- **API Layer**: Node.js main process + optional Express API + Convex cloud
- **Data Storage**: Convex for user data + Better-SQLite3 for local tracing/cache
- **Agent Framework**: Keep Mastra (TypeScript/Node.js) - **runs natively, no bridge needed!**
- **Config System**: JSON configs that translate user intent → executable experiments

**Critical Performance Improvement**: Parallel LLM execution reduces experiment time from **10 minutes to 1 minute** (10x faster)

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

### 1.2 Mastra Agent Framework

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

3. **Experiment Assistant Agent** (`src/mastra/agents/ExperimentAssistantAgent.ts`)
   - Conversational experiment design
   - Generates structured configs from natural language
   - Proposes alternative hypotheses
   - **CRITICAL**: Enhanced to output full `UnheardExperimentConfig`

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
    personaEnrichmentAgent,
    experimentAssistantAgent,
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
- Model selection: Per-use-case configurable

### 1.3 Experiment Management System

**Experiment Workflow**:

```
User Intent → Config → Validation → Persona Loading →
Network Init → Parallel Execution → Response Collection →
Metrics Calculation → Results → Discovery (optional)
```

**Database Schema** (Convex):

```typescript
// Core tables to retain
experiments: {
  userId: Id<"users">,
  name: string,
  type: "focus_group" | "ab_test" | "interview" | "survey",
  status: "draft" | "pending" | "running" | "paused" | "completed" | "failed",
  context: ExperimentContext,
  hypothesis: Hypothesis,
  stimulus: Stimulus,
  networkConfig: NetworkConfig,
  focusGroupId: Id<"focusGroups">,
  sourceConfigId?: Id<"experimentConfigs">,
  extractedDataset?: any,
  executionMetrics?: {                    // NEW: Performance tracking
    totalDuration: number,
    llmCalls: number,
    parallelism: number,
    costUSD: number,
  },
  createdAt: number,
  updatedAt: number,
}

focusGroups: {
  userId: Id<"users">,
  name: string,
  description?: string,
  personaIds: Id<"personas">[],
  tags: string[],
  createdAt: number,
}

personas: {
  userId: Id<"users">,
  name: string,
  demographics: { age, gender, location, income, education },
  company?: { name, url, industry, size },
  jobRole?: { title, department, seniority },
  personality: { openness, conscientiousness, extraversion, agreeableness, neuroticism },
  beliefs: string[],
  preferences: Record<string, unknown>,
  behaviors: string[],
  tags: string[],
}

experimentRounds: {
  experimentId: Id<"experiments">,
  roundNumber: number,
  consensusScore: number,
  avgSentiment: number,
  sentimentVariance: number,
  completedAt: number,
}

experimentResponses: {
  experimentId: Id<"experiments">,
  roundId: Id<"experimentRounds">,
  personaId: Id<"personas">,
  response: string,
  sentiment: number,
  confidence: number,
  reasoning?: string,
  createdAt: number,
}

discoverySessions: {
  experimentId: Id<"experiments">,
  userId: Id<"users">,
  status: "initializing" | "running" | "paused" | "completed" | "failed",
  config: AutoDSConfig,
  progress: DiscoveryProgress,
  results?: DiscoveryResults,
  createdAt: number,
  completedAt?: number,
}

discoveryNodes: {
  sessionId: Id<"discoverySessions">,
  nodeId: string,
  parentId?: string,
  hypothesis: string,
  level: number,
  state: "pending" | "expanding" | "evaluating" | "evaluated",
  beliefs: { prior: BetaParams, posterior: BetaParams },
  surprise: number,
  klDivergence: number,
  visits: number,
  value: number,
  experimentPlan?: string,
  generatedCode?: string,
  executionResult?: any,
}

experimentConfigs: {                      // NEW: Config storage
  userId: Id<"users">,
  name: string,
  description?: string,
  config: UnheardExperimentConfig,
  tags: string[],
  isTemplate: boolean,
  createdAt: number,
  updatedAt: number,
}
```

**API Endpoints** (Current Next.js - to be ported):

- `POST /api/experiments/run` - Execute experiment with SSE streaming
- `POST /api/discovery` - Run AutoDiscovery with SSE streaming
- `POST /api/experiments/assistant` - AI assistant for experiment design
- `POST /api/personas/enrich` - AI persona enrichment
- `POST /api/personas/import` - CSV bulk import

**Frontend Components** (Reusable):

- `ExperimentWizard.tsx` - 6-step experiment creation
- `ExperimentAssistantChat.tsx` - SSE streaming chat
- `AddPersonasSheet.tsx` - Persona selection UI
- `DiscoveryConfig.tsx` - MCTS parameter tuning
- `ResultsDashboard.tsx` - Results visualization
- All shadcn/ui components

### 1.4 Modal Sandbox Integration

**Purpose**: Safe Python code execution for statistical analysis + parallel LLM execution

**Integration Points**:

- AutoDiscovery engine generates Python code via `pythonCodeGeneratorAgent`
- Code executes in Modal sandbox (serverless, 60s timeout)
- Results parsed and used as evidence for Bayesian belief updates
- Falls back to LLM analysis if code execution fails
- **NEW**: Modal functions for parallel agent execution (50-100 concurrent)

**API**:

- `POST /api/modal/execute` - Python code execution
- `POST /api/modal/agents/invoke` - Parallel agent calls (NEW)

---

## 2. New Architecture: Electron Desktop App with Parallelization

### 2.1 Technology Stack

| Layer                 | Technology           | Rationale                               |
| --------------------- | -------------------- | --------------------------------------- |
| **Desktop Framework** | Electron             | Node.js runtime, Mastra runs natively   |
| **Frontend**          | Vite + React 18      | Fast dev, smaller bundle than Next.js   |
| **Routing**           | React Router v6      | Replace Next.js App Router              |
| **Main Process**      | Node.js + TypeScript | Native Mastra, MCTS, LLM orchestration  |
| **Agent Framework**   | Mastra (native!)     | No bridge needed - runs in main process |
| **LLM Providers**     | Multi-provider       | Ollama, Modal, OpenAI, Anthropic        |
| **Database (Cloud)**  | Convex               | Keep existing schema, real-time sync    |
| **Database (Local)**  | Better-SQLite3       | Tracing, cache, offline data            |
| **Auth**              | Clerk JWT            | Store token in OS keychain (via keytar) |
| **UI Components**     | shadcn/ui            | Keep existing components                |
| **Styling**           | Tailwind CSS         | Keep existing styles                    |

### 2.2 Directory Structure

```
unheard-desktop/
├── src/                           # Electron main process (Node.js)
│   ├── main.ts                    # Electron entry point
│   ├── preload.ts                 # IPC bridge (contextBridge)
│   │
│   ├── config/                    # Config management
│   │   ├── manager.ts             # File I/O, validation
│   │   ├── validator.ts           # Zod schema validation
│   │   └── schema.ts              # TypeScript types
│   │
│   ├── llm/                       # LLM orchestration layer (NEW - CRITICAL)
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
│   ├── mcts/                      # MCTS engine (Keep TypeScript!)
│   │   ├── tree.ts                # Core tree search
│   │   ├── surprise.ts            # KL divergence
│   │   ├── beliefs.ts             # Beta-Bernoulli
│   │   └── parallel-expansion.ts  # NEW: Parallel node expansion
│   │
│   ├── mastra/                    # Mastra integration (Native!)
│   │   ├── index.ts               # Mastra initialization
│   │   ├── agents/                # Copy from existing codebase
│   │   │   ├── TinyPerson.ts
│   │   │   ├── PersonaEnrichmentAgent.ts
│   │   │   ├── ExperimentAssistantAgent.ts
│   │   │   └── discovery/
│   │   └── networks/              # Copy from existing codebase
│   │       ├── BroadcastNetwork.ts
│   │       ├── RoundRobinNetwork.ts
│   │       └── ModeratedNetwork.ts
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
│   │   ├── components/            # Existing components (95% reusable)
│   │   │   ├── experiments/
│   │   │   │   ├── ExperimentWizard.tsx
│   │   │   │   ├── ExperimentAssistantChat.tsx
│   │   │   │   └── ResultsDashboard.tsx
│   │   │   ├── personas/
│   │   │   │   ├── PersonaForm.tsx
│   │   │   │   └── AddPersonasSheet.tsx
│   │   │   ├── focus-groups/
│   │   │   ├── discovery/
│   │   │   │   └── DiscoveryConfig.tsx
│   │   │   └── ui/                # shadcn/ui
│   │   │
│   │   ├── services/              # API layer
│   │   │   ├── electron-api.ts    # IPC wrapper
│   │   │   ├── convex-client.ts   # Convex wrapper
│   │   │   └── config-service.ts  # Config management
│   │   │
│   │   ├── stores/                # State management (Zustand)
│   │   │   ├── auth-store.ts
│   │   │   ├── config-store.ts
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
│       ├── experiment.ts          # Experiment types
│       ├── persona.ts             # Persona types
│       └── llm.ts                 # LLM provider types
│
├── convex/                        # Convex backend (unchanged)
│   ├── schema.ts
│   ├── experiments/
│   ├── personas/
│   ├── focusGroups/
│   └── discovery/
│
├── package.json                   # Root workspace
├── electron-builder.json          # Build config
└── README.md
```

### 2.3 LLM Parallelization Strategy (NEW - CRITICAL)

**Problem**: Sequential LLM calls create 10+ minute waits for experiments

**Current Performance (Sequential)**:

```
10 personas × 3 rounds = 30 LLM calls
30 calls × 2s average = 60 seconds minimum
100-iteration MCTS = 200+ LLM calls
200 calls × 3s average = 600+ seconds (10 minutes)
```

**Solution**: Three-tier parallelization strategy

#### **Tier 1: Local Parallelization (Worker Threads)**

**Technology**: Node.js Worker Threads + Ollama

**Architecture**:

```typescript
// src/llm/worker-pool.ts

import { Worker } from 'worker_threads'
import { OllamaProvider } from './providers/ollama'

export class WorkerPool {
  private workers: Worker[] = []
  private queue: Task[] = []

  constructor(private poolSize = 10) {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(new Worker('./llm-worker.js'))
    }
  }

  async execute(prompts: string[], model = 'qwen2.5:32b'): Promise<string[]> {
    // Distribute prompts across workers
    const chunks = this.chunkArray(prompts, this.poolSize)

    const results = await Promise.all(
      chunks.map((chunk, idx) =>
        this.workers[idx].postMessage({ prompts: chunk, model })
      )
    )

    return results.flat()
  }
}
```

**Models**:

- **Qwen2.5:32b** - Best for personas (high quality, fast)
- **Llama3.3:70b** - Best for discovery (creative)
- **Llama3.2:3b** - Best for sentiment (tiny, fast)

**Performance**:

- 10 personas in parallel: **2 seconds** (vs 20s sequential)
- Cost: **$0** (free!)
- Quality: **85-95%** of GPT-4o-mini

**Use Cases**:

- ✅ Persona simulation (bulk of LLM calls)
- ✅ Sentiment analysis
- ✅ Development iteration (fast feedback)

#### **Tier 2: Modal Serverless (Optional)**

**Technology**: Modal.com serverless functions

**Architecture**:

```typescript
// src/llm/providers/modal.ts

import * as modal from '@modal-labs/modal'

export class ModalProvider {
  private app: modal.App

  async initialize() {
    this.app = modal.App.lookup('unheard-agents')
  }

  async batchInvoke(prompts: string[], config: ModalConfig) {
    // Modal handles parallelization automatically
    const fn = this.app.function('persona-agent')

    // 50-100 concurrent executions
    const results = await Promise.all(
      prompts.map(prompt => fn.remote({ prompt, model: config.model }))
    )

    return results
  }
}
```

**Models**:

- **DeepSeek-V3** - Best value (fast + cheap)
- **GPT-4o-mini** - High quality when needed

**Performance**:

- 50 personas in parallel: **3-5 seconds**
- Cost: **$0.001-0.01 per call** (90% cheaper than OpenAI)
- Quality: **90-95%** of GPT-4o

**Use Cases**:

- ✅ Large experiments (50+ personas)
- ✅ Production workloads
- ✅ When local GPU unavailable

#### **Tier 3: Cloud APIs (Premium/Fallback)**

**Technology**: OpenAI, Anthropic direct APIs

**Models**:

- **GPT-4o** - Premium quality for discovery
- **Claude Sonnet 4.5** - Best reasoning
- **GPT-4o-mini** - Fast fallback

**Performance**:

- Rate limited to 50 concurrent
- Cost: **Full API pricing**
- Quality: **Best available**

**Use Cases**:

- ✅ Discovery hypothesis generation
- ✅ Complex reasoning tasks
- ✅ When quality > cost

### **Provider Selection Strategy**

```typescript
// src/llm/orchestrator.ts

export class LLMOrchestrator {
  async selectProvider(task: LLMTask, config: UserSettings): Provider {
    // User preference
    if (config.preferLocal && this.isOllamaAvailable()) {
      return new OllamaProvider()
    }

    // Cost optimization
    if (task.type === 'persona' && task.count > 20) {
      if (this.isModalAvailable()) {
        return new ModalProvider() // Cheaper than OpenAI at scale
      }
    }

    // Quality requirement
    if (task.requiresHighQuality) {
      return new OpenAIProvider({ model: 'gpt-4o' })
    }

    // Default fallback
    return new OpenAIProvider({ model: 'gpt-4o-mini' })
  }

  async executeBatch(prompts: string[], task: LLMTask): Promise<string[]> {
    const provider = this.selectProvider(task, this.userSettings)
    const rateLimiter = this.getRateLimiter(provider)

    // Execute with parallelization
    return rateLimiter.executeBatch(prompts, {
      maxConcurrency: provider.maxConcurrency,
      retryOnError: true,
      timeout: 30000,
    })
  }
}
```

### **Performance Impact**

| Scenario                  | Original (Sequential) | With Parallelization | Improvement         |
| ------------------------- | --------------------- | -------------------- | ------------------- |
| **10 personas, 3 rounds** | 60s                   | 6s                   | **10x faster**      |
| **50 personas, 1 round**  | 100s                  | 5s                   | **20x faster**      |
| **100-iter MCTS**         | 600s (10min)          | 60s (1min)           | **10x faster**      |
| **Cost (10 personas)**    | $0.03                 | $0-0.003             | **10-100x cheaper** |

**User Experience Transformation**:

```
Before: Start experiment → wait 10 min → leave computer
After:  Start experiment → watch live → done in 1 min → immediate iteration
```

### 2.4 Communication Architecture

```
┌─────────────────────────────────────────────────────┐
│          Renderer Process (React + Vite)            │
│          - UI Components                            │
│          - Convex Client (direct WebSocket)         │
└─────────────────────────────────────────────────────┘
                      │
                      │ IPC (contextBridge)
                      ▼
┌─────────────────────────────────────────────────────┐
│          Main Process (Node.js)                     │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      LLM Orchestrator                     │    │
│  │  - Provider selection                     │    │
│  │  - Rate limiting                          │    │
│  │  - Cost tracking                          │    │
│  └───────────────────────────────────────────┘    │
│          │           │            │                │
│  ┌───────┴───┐  ┌───┴────┐  ┌───┴───────┐        │
│  │  Worker   │  │ Modal  │  │  OpenAI   │        │
│  │   Pool    │  │Provider│  │ Provider  │        │
│  │(Ollama)   │  └────────┘  └───────────┘        │
│  └───────────┘                                    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      Mastra (Native!)                     │    │
│  │  - TinyPerson agents                      │    │
│  │  - Discovery agents                       │    │
│  │  - Network topologies                     │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      MCTS Engine (TypeScript)             │    │
│  │  - Parallel node expansion                │    │
│  │  - Bayesian surprise                      │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      Storage                              │    │
│  │  - Better-SQLite3 (local)                 │    │
│  │  - OS Keychain (credentials)              │    │
│  └───────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Convex (Cloud)       │
         │   - Real-time DB       │
         │   - Sync & Auth        │
         └────────────────────────┘
```

**Communication Patterns**:

1. **IPC (contextBridge)** - Fast, type-safe
   - Config CRUD
   - Experiment execution
   - Settings management
   - All main ↔ renderer communication

2. **Direct Convex** (WebSocket) - Real-time, cloud
   - Database queries/mutations
   - Real-time subscriptions
   - Auth

3. **No HTTP server needed** - Electron handles everything natively

### 2.5 Config System

**Purpose**: Translate user intent → executable experiment configuration

**Config Format**: JSON with Zod validation

**Example Config**:

```json
{
  "version": "1.0",
  "intent": {
    "userGoal": "Test if B2B customers will pay $99/mo for our tool",
    "keywords": ["pricing", "b2b", "saas"],
    "source": "assistant"
  },
  "experiment": {
    "name": "Pricing Validation - $99/mo",
    "type": "focus_group",
    "context": {
      "companyName": "Unheard",
      "productOrService": "AI Market Feedback Simulator",
      "productDescription": "LLM-powered focus group simulation",
      "targetMarket": "B2B SaaS companies"
    },
    "hypothesis": {
      "statement": "B2B product managers will find $99/mo acceptable",
      "category": "pricing",
      "expectedOutcome": "Majority positive sentiment"
    },
    "stimulus": {
      "type": "scenario",
      "content": "Imagine a tool that simulates customer feedback..."
    }
  },
  "agents": {
    "focusGroupId": "conv_abc123",
    "network": {
      "topology": "broadcast",
      "maxRounds": 3
    }
  },
  "execution": {
    "llmStrategy": "local-first",
    "models": {
      "persona": "qwen2.5:32b",
      "discovery": "gpt-4o",
      "sentiment": "llama3.2:3b"
    },
    "parallelism": {
      "maxConcurrent": 10,
      "provider": "ollama"
    },
    "costLimit": 1.0
  },
  "discovery": {
    "enabled": true,
    "trigger": "after_experiment",
    "config": {
      "maxIterations": 100,
      "explorationConstant": 1.414,
      "maxDepth": 5,
      "surprisalThreshold": 0.5,
      "parallelExpansion": 10
    }
  }
}
```

**Config Storage**:

- **Local**: `~/.config/unheard/configs/*.json` (user templates)
- **Cloud**: Convex table `experimentConfigs`
- **Version Control**: Git-friendly

**Translation Paths**:

1. **AI Assistant** → Full config
2. **Wizard** → Config (export wizard state)
3. **Template** → Config (pre-built templates)
4. **Manual** → Config (JSON editor)

---

## 3. API Layer Design

### 3.1 Electron IPC (Main Communication)

**No HTTP server needed** - Use Electron's native IPC

**Architecture**:

```typescript
// src/preload.ts

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  loadConfig: (path: string) => ipcRenderer.invoke('config:load', path),
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
  validateConfig: (config: any) =>
    ipcRenderer.invoke('config:validate', config),

  // Experiments
  runExperiment: (config: any) => ipcRenderer.invoke('experiment:run', config),
  pauseExperiment: (id: string) => ipcRenderer.invoke('experiment:pause', id),
  getExperimentStatus: (id: string) =>
    ipcRenderer.invoke('experiment:status', id),

  // Streaming (SSE-like)
  onExperimentProgress: (callback: Function) => {
    ipcRenderer.on('experiment:progress', (_, data) => callback(data))
  },

  // Discovery
  runDiscovery: (config: any) => ipcRenderer.invoke('discovery:run', config),
  onDiscoveryProgress: (callback: Function) => {
    ipcRenderer.on('discovery:progress', (_, data) => callback(data))
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) =>
    ipcRenderer.invoke('settings:update', settings),
})
```

```typescript
// src/ipc/experiments.ts

import { ipcMain } from 'electron'
import { ExperimentRunner } from '../orchestration/experiment-runner'

export function registerExperimentHandlers(runner: ExperimentRunner) {
  ipcMain.handle('experiment:run', async (event, config) => {
    const experimentId = await runner.start(config)

    // Stream progress
    runner.on('progress', data => {
      event.sender.send('experiment:progress', data)
    })

    return experimentId
  })

  ipcMain.handle('experiment:pause', async (event, id) => {
    await runner.pause(id)
  })

  ipcMain.handle('experiment:status', async (event, id) => {
    return runner.getStatus(id)
  })
}
```

### 3.2 Optional Express API (for testing/debugging)

**Only if you want REST endpoints for development**

```typescript
// src/server/api.ts (optional)

import express from 'express'

export function createDevAPI(orchestrator: LLMOrchestrator) {
  const app = express()

  app.post('/api/v1/experiments/run', async (req, res) => {
    const result = await orchestrator.runExperiment(req.body)
    res.json(result)
  })

  app.listen(4111, () => {
    console.log('Dev API running on http://localhost:4111')
  })
}
```

### 3.3 Hybrid Cloud Features

**Cloud vs Local Decision Matrix**:

| Feature              | Primary       | Backup | Notes                   |
| -------------------- | ------------- | ------ | ----------------------- |
| Experiment Execution | Local         | Cloud  | Low latency, privacy    |
| Persona Storage      | Local + Cloud | -      | Offline access + sync   |
| Config Management    | Local         | -      | Offline editing         |
| Discovery (MCTS)     | Local         | -      | Parallelized locally    |
| LLM Calls            | Local-first   | Cloud  | Ollama → Modal → OpenAI |
| Modal Sandbox        | Cloud         | -      | Python execution        |
| Results Storage      | Local + Cloud | -      | Dual storage            |

**Sync Strategy**: Offline-first with background sync

- Local SQLite for immediate writes
- Background sync to Convex when online
- Conflict resolution: last-write-wins

### 3.4 Mastra Integration (Native - No Bridge!)

**Advantage**: Electron includes Node.js - Mastra runs directly in main process

```typescript
// src/main.ts

import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/storage'
import { TinyPersonAgent } from './mastra/agents/TinyPerson'

// Initialize Mastra directly
const mastra = new Mastra({
  agents: {
    tinyPerson: TinyPersonAgent,
    personaEnrichment: PersonaEnrichmentAgent,
    experimentAssistant: ExperimentAssistantAgent,
  },
  storage: new LibSQLStore({
    url: 'file:./data/mastra.db',
  }),
})

// Use directly - no IPC needed
const agent = mastra.getAgent('tinyPerson')
const result = await agent.generate(prompt)
```

**No subprocess, no HTTP bridge, no complexity!**

---

## 4. Implementation Roadmap (12 Weeks)

### **Phase 1: Foundation (Weeks 1-2)** ⏱️ 2 weeks

**Goals**: Electron setup, component migration, basic IPC

**Tasks**:

1. Initialize Electron project
   - Use `electron-forge` with Vite + TypeScript template
   - Set up hot reload and dev tools
2. Migrate React components from Next.js
   - Move components to `renderer/src/components/`
   - Replace `next/link` with `react-router-dom`
   - Update imports (no Next.js APIs in renderer)
3. Set up IPC bridge
   - Create `preload.ts` with contextBridge
   - Define IPC handlers in main process
   - Create typed API in renderer
4. Integrate Convex client
   - Copy Convex client setup to renderer
   - Test real-time subscriptions
5. Port config system
   - Create Zod schemas (`shared/types/config.ts`)
   - Implement config manager (`src/config/manager.ts`)
   - Add IPC handlers for config CRUD
6. Set up Better-SQLite3
   - Install and configure for local storage
   - Create migration system
   - Test basic CRUD

**Deliverables**:

- ✅ Working Electron app with React UI
- ✅ Config CRUD working via IPC
- ✅ Convex integration functional
- ✅ Local SQLite storage working

**Tests**:

- [ ] App launches successfully
- [ ] Can load/save configs
- [ ] Convex queries work from renderer
- [ ] Local DB persists data

---

### **Phase 2: LLM Orchestration (Weeks 3-4)** ⏱️ 2 weeks **← CRITICAL**

**Goals**: Multi-provider LLM system with parallelization

**Tasks**:

**Week 3: Provider Infrastructure**

1. Create LLM provider interface
   ```typescript
   interface LLMProvider {
     generate(prompt: string, config: GenerateConfig): Promise<string>
     batch(prompts: string[], config: GenerateConfig): Promise<string[]>
     isAvailable(): Promise<boolean>
     maxConcurrency: number
   }
   ```
2. Implement OpenAI provider
   - Use official OpenAI SDK
   - Add retry logic
   - Add rate limiting
3. Implement Anthropic provider
   - Use official Anthropic SDK
   - Add retry logic
4. Implement Ollama provider
   - HTTP client to Ollama API (localhost:11434)
   - Model detection (list available models)
   - Health check endpoint
5. Set up worker pool
   - Node.js Worker Threads
   - Task queue system
   - Worker lifecycle management

**Week 4: Orchestration & Testing** 6. Implement LLM orchestrator

- Provider selection logic
- Cost tracking
- Performance metrics

7. Add rate limiter
   - Per-provider concurrency limits
   - Queue management
   - Backpressure handling
8. Add cost tracker
   - Token counting
   - Cost estimation
   - Budget warnings
9. Add provider health checks
   - Ollama availability detection
   - Modal credentials validation
   - API key validation
10. Test parallelization
    - 10 concurrent Ollama calls
    - 50 concurrent OpenAI calls
    - Measure latency and throughput

**Deliverables**:

- ✅ Multi-provider LLM system working
- ✅ Parallel execution functional (10-50 concurrent)
- ✅ Fallback logic working (Ollama → Modal → OpenAI)
- ✅ Cost tracking functional

**Tests**:

- [ ] Can call Ollama model successfully
- [ ] Can call OpenAI model successfully
- [ ] 10 parallel calls complete in <5s
- [ ] Fallback triggers when primary unavailable
- [ ] Cost tracking accurate to $0.01

---

### **Phase 3: Mastra Integration (Week 5)** ⏱️ 1 week

**Goals**: Port Mastra agents, wire to LLM orchestrator

**Tasks**:

1. Copy Mastra agents from existing codebase
   - `src/mastra/agents/TinyPerson.ts`
   - `src/mastra/agents/PersonaEnrichmentAgent.ts`
   - `src/mastra/agents/ExperimentAssistantAgent.ts`
   - `src/mastra/agents/discovery/*`
2. Initialize Mastra in main process
   - Set up LibSQL storage
   - Register agents
   - Configure observability
3. Wire agents to LLM orchestrator
   - Replace direct OpenAI calls with orchestrator
   - Add model selection per agent type
4. Port network topologies
   - `src/mastra/networks/BroadcastNetwork.ts`
   - `src/mastra/networks/RoundRobinNetwork.ts`
   - `src/mastra/networks/ModeratedNetwork.ts`
5. Test persona simulation
   - Single persona response
   - 10 personas parallel (Broadcast)
   - 10 personas sequential (RoundRobin)

**Deliverables**:

- ✅ Mastra agents working natively in main process
- ✅ All network topologies functional
- ✅ Parallelization integrated with agents
- ✅ Can simulate 10 personas in <10s

**Tests**:

- [ ] TinyPerson agent generates response
- [ ] Broadcast network runs 10 personas in parallel
- [ ] RoundRobin network runs 3 rounds sequentially
- [ ] Agent uses correct model (Ollama for personas)

---

### **Phase 4: Experiment Execution (Week 6)** ⏱️ 1 week

**Goals**: Config-driven experiments with streaming

**Tasks**:

1. Implement experiment runner
   - Load config
   - Initialize personas and network
   - Execute rounds with parallelization
   - Calculate metrics (sentiment, consensus)
2. Add SSE-like streaming
   - Emit progress events via IPC
   - Round completion updates
   - Real-time response display
3. Port experiment wizard UI
   - 6-step wizard from Next.js version
   - Connect to IPC handlers
   - Test end-to-end flow
4. Implement results storage
   - Save to local SQLite immediately
   - Background sync to Convex
   - Results dashboard display
5. Add experiment pause/resume
   - Checkpoint state
   - Resume from checkpoint
   - Clean cancellation

**Deliverables**:

- ✅ Experiments run from config
- ✅ Real-time progress streaming
- ✅ Results stored locally and in Convex
- ✅ Can pause/resume experiments

**Tests**:

- [ ] 10-persona experiment completes
- [ ] Progress events stream to UI in real-time
- [ ] Results match expected schema
- [ ] Can pause and resume mid-experiment

---

### **Phase 5: MCTS Discovery (Weeks 7-8)** ⏱️ 2 weeks

**Goals**: Parallel MCTS with hybrid models

**Tasks**:

**Week 7: MCTS Core**

1. Keep MCTS in TypeScript (no Rust port!)
   - Copy from `src/lib/mcts/` (existing codebase)
   - `tree.ts`, `surprise.ts`, `beliefs.ts`
2. Add parallel node expansion
   - Expand N nodes concurrently
   - Batch LLM calls
   - Queue management
3. Wire MCTS to LLM orchestrator
   - Replace direct model calls
   - Add provider selection per phase

**Week 8: Discovery Agents & Integration** 4. Integrate discovery agents

- `hypothesisGeneratorAgent` → parallel hypotheses
- `beliefElicitorAgent` → batch belief sampling
- `experimentPlannerAgent` → code generation

5. Add Modal integration for code execution
   - Deploy Python sandbox function
   - Execute generated code
   - Parse results
6. Implement streaming discovery progress
   - Node expansion events
   - Surprise score updates
   - Best hypothesis updates
7. Test full discovery
   - 100-iteration session
   - Parallel node expansion (10 concurrent)
   - Verify results quality

**Deliverables**:

- ✅ MCTS working with parallelization
- ✅ Discovery completes in <2 minutes (was 10+ min)
- ✅ Modal sandbox working for code execution
- ✅ Discovery streaming to UI

**Tests**:

- [ ] 100-iteration MCTS completes
- [ ] Parallel expansion works (10 nodes at once)
- [ ] Surprising hypotheses identified
- [ ] Modal code execution works

---

### **Phase 6: Modal Integration (Week 9)** ⏱️ 1 week **← NEW**

**Goals**: Optional Modal for extreme parallelization

**Tasks**:

1. Create Modal functions for agents

   ```python
   # modal_agents.py
   import modal

   app = modal.App("unheard-agents")

   @app.function(
       image=modal.Image.debian_slim().pip_install("openai"),
       timeout=30,
       memory=512
   )
   def persona_agent(prompt: str, model: str = "gpt-4o-mini"):
       # Agent logic
       return response
   ```

2. Add Modal provider to orchestrator
   - Deploy functions on startup (or pre-deploy)
   - Invoke via Modal SDK
   - Handle timeouts and retries
3. Implement cost estimation
   - Calculate before running
   - Show to user for approval
   - Track actual spend
4. Test massive parallelization
   - 50 concurrent personas via Modal
   - Compare cost vs OpenAI direct
   - Compare latency vs local
5. Add graceful fallback
   - When Modal unavailable → use OpenAI
   - When Modal credentials missing → use Ollama
   - User-configurable preference

**Deliverables**:

- ✅ Modal provider working
- ✅ Can run 50+ personas in parallel
- ✅ Cost estimation before experiments
- ✅ Graceful fallback to other providers

**Tests**:

- [ ] Modal function deploys successfully
- [ ] 50 personas complete in <10s
- [ ] Cost estimate within 10% of actual
- [ ] Fallback works when Modal unavailable

---

### **Phase 7: Polish & Optimization (Week 10)** ⏱️ 1 week

**Goals**: Desktop UX, settings, optimization

**Tasks**:

1. Settings page
   - Model selection (per use case)
   - Concurrency limits (worker pool size)
   - Cost budgets (warn/block thresholds)
   - Provider preferences (local-first, cost-first, quality-first)
2. System tray integration
   - Background experiments
   - Quick actions
   - Status indicator
3. Desktop notifications
   - Experiment completion
   - Discovery complete
   - Budget warnings
4. Keyboard shortcuts
   - ⌘K command palette (cmdk)
   - Quick experiment start
   - Settings access
5. Dark mode support
   - System preference detection
   - Manual toggle
   - Persist preference
6. Onboarding wizard
   - First launch setup
   - Ollama installation guide
   - API key configuration
   - Sample experiment
7. Performance monitoring dashboard
   - LLM call latency
   - Cost per experiment
   - Parallelization efficiency

**Deliverables**:

- ✅ Polished desktop UX
- ✅ User can configure execution strategy
- ✅ Cost tracking visible and actionable
- ✅ Dark mode working
- ✅ Onboarding complete

**Tests**:

- [ ] Settings persist across restarts
- [ ] System tray works
- [ ] Notifications appear
- [ ] Dark mode toggles correctly
- [ ] Command palette opens with ⌘K

---

### **Phase 8: Testing & Packaging (Weeks 11-12)** ⏱️ 2 weeks

**Goals**: Testing, packaging, distribution

**Tasks**:

**Week 11: Testing**

1. Unit tests
   - LLM orchestrator (provider selection)
   - MCTS engine (surprise calculation)
   - Config validator
   - Cost tracker
2. Integration tests
   - Full experiment flow
   - Discovery flow
   - Config load/save
   - Convex sync
3. E2E tests with Playwright
   - User creates experiment via wizard
   - User runs experiment
   - User views results
   - User runs discovery

**Week 12: Packaging** 4. Create app icons and assets

- macOS .icns (1024x1024)
- Windows .ico (256x256)
- Linux .png (512x512)

5. Code signing setup
   - macOS: Apple Developer certificate
   - Windows: Code signing certificate
6. Configure electron-builder
   - Build targets: macOS (dmg), Windows (exe), Linux (AppImage)
   - Auto-update configuration (electron-updater)
7. Package for all platforms
   - `npm run build:mac`
   - `npm run build:win`
   - `npm run build:linux`
8. Test installation
   - Fresh macOS installation
   - Fresh Windows installation
   - Fresh Linux installation

**Deliverables**:

- ✅ Tested app with >70% code coverage
- ✅ Installers for macOS, Windows, Linux
- ✅ Auto-update working
- ✅ Code signed binaries

**Tests**:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass on all platforms
- [ ] Fresh install works
- [ ] Auto-update triggers correctly

---

## 5. Critical Files Reference

### Files to Port/Reuse

**MCTS Engine** (Keep TypeScript):

- `src/lib/mcts/tree.ts` → `src/mcts/tree.ts`
- `src/lib/mcts/surprise.ts` → `src/mcts/surprise.ts`
- `src/lib/autodiscovery/engine.ts` → `src/mcts/engine.ts`
- `src/lib/autodiscovery/beliefs.ts` → `src/mcts/beliefs.ts`

**Mastra Agents** (Copy as-is):

- `src/mastra/agents/TinyPerson.ts` → `src/mastra/agents/TinyPerson.ts`
- `src/mastra/agents/PersonaEnrichmentAgent.ts` → Copy
- `src/mastra/agents/ExperimentAssistantAgent.ts` → Copy + enhance
- `src/mastra/agents/discovery/` → Copy entire directory
- `src/mastra/networks/` → Copy entire directory

**React Components** (Minimal changes):

- `src/components/experiments/ExperimentWizard.tsx` → Reuse
- `src/components/experiments/ExperimentAssistantChat.tsx` → Reuse
- `src/components/personas/PersonaForm.tsx` → Reuse
- `src/components/discovery/DiscoveryConfig.tsx` → Reuse
- `src/components/discovery/ResultsDashboard.tsx` → Reuse
- `src/components/ui/*` → Reuse all shadcn/ui components

**Database Schema**:

- `convex/schema.ts` → Keep unchanged
- Add new table: `experimentConfigs` for config storage

---

## 6. Environment Variables

```bash
# Convex
VITE_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment

# Clerk (Auth)
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Modal (Optional - for Python sandbox + serverless)
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...

# Tavily (Web search)
TAVILY_API_KEY=tvly-...

# Firecrawl (Web scraping)
FIRECRAWL_API_KEY=fc-...

# Mastra (Optional cloud tracing)
MASTRA_CLOUD_ACCESS_TOKEN=...
MASTRA_DB_URL=file:./mastra.db

# Ollama (Local models)
OLLAMA_BASE_URL=http://localhost:11434

# App Config
NODE_ENV=production
LOG_LEVEL=info
```

**Storage**: Store in OS-specific secure location

- macOS: Keychain Access
- Windows: Credential Manager
- Linux: Secret Service API

Use `keytar` npm package for cross-platform credential storage.

---

## 7. Success Criteria

### Functional Requirements ✓

- [ ] User can create experiments via wizard, assistant, or config
- [ ] User can select personas from focus groups
- [ ] Experiments run with all 3 network topologies (Broadcast, RoundRobin, Moderated)
- [ ] Real-time progress streaming during execution
- [ ] Results stored in Convex + local cache
- [ ] AutoDiscovery runs after experiments with MCTS exploration
- [ ] Surprising hypotheses identified and displayed
- [ ] Configs can be saved, loaded, and shared
- [ ] Offline mode: experiments run without internet (with Ollama)
- [ ] App auto-updates

### Performance Requirements ✓

- [ ] App startup < 3 seconds
- [ ] **10-persona experiment < 10 seconds** (was: 60s in sequential version)
- [ ] **100-iteration MCTS < 2 minutes** (was: 10+ minutes in sequential version)
- [ ] UI remains responsive during long-running tasks
- [ ] Memory usage < 500MB under normal load
- [ ] **Can run 50+ personas concurrently with Modal**

### Quality Requirements ✓

- [ ] Zero data loss (local + cloud redundancy)
- [ ] Graceful error handling with user-friendly messages
- [ ] Comprehensive logging for debugging
- [ ] Secure credential storage (OS keychain)
- [ ] Code coverage > 70%

### Cost Efficiency ✓

- [ ] **10-persona experiment < $0.01** (with Ollama: $0)
- [ ] Cost estimation before running expensive experiments
- [ ] Budget warnings when approaching limits
- [ ] Cost tracking visible in UI

---

## 8. Key Architectural Principles

1. **Parallelization-First**: All LLM calls parallelized by default (10x faster)
2. **Local-First**: Ollama for 90% of LLM calls (free + fast)
3. **User Data Sovereignty**: Data stored locally by default, cloud optional
4. **Config-as-Code**: Experiments defined in version-controllable configs
5. **Streaming by Default**: Real-time progress via IPC for long operations
6. **Graceful Degradation**: Fallback chain (Ollama → Modal → OpenAI)
7. **Resource Aware**: Respect system limits, configurable concurrency
8. **Cost Transparent**: Always show estimated and actual costs

---

## 9. Migration Path from Current Web App

### Data Migration

1. **Export from Convex**: Use Convex dashboard to export all data
2. **Import to Desktop App**: First launch imports existing experiments/personas
3. **Backward Compatibility**: Read old experiment format, auto-convert to new config

### User Transition

1. **Phase 1**: Web app continues running (no disruption)
2. **Phase 2**: Desktop beta available for testing
3. **Phase 3**: Desktop becomes primary, web deprecated (with notice)
4. **Phase 4**: Web app shut down, redirect to desktop download

### Feature Parity Checklist

- [ ] All experiment types supported
- [ ] All network topologies working
- [ ] Discovery analysis equivalent or better (10x faster!)
- [ ] Persona management (CRUD, import, enrichment)
- [ ] Focus group management
- [ ] Results export (JSON, CSV)
- [ ] Settings and preferences
- [ ] User authentication

---

## 10. Questions & Decisions

### Critical Decisions Needed Before Starting

1. **LLM Strategy: Local-first or Modal-first?**
   - **Recommendation**: Local-first (Ollama) for development, Modal optional for scale
   - **Rationale**: Zero cost, fast iteration, better UX for most users
   - **Trade-off**: Requires Ollama installation, ~5GB model downloads

2. **Model Selection: Which open-source models to bundle/recommend?**
   - **Recommendation**:
     - Qwen2.5:32b (personas) - Best quality/speed balance
     - Llama3.3:70b (discovery) - Best reasoning
     - Llama3.2:3b (sentiment) - Tiny and fast
   - **Rationale**: Tested quality, active development, good documentation
   - **Trade-off**: Large downloads (7B: 4GB, 32B: 18GB, 70B: 40GB)

3. **Concurrency Limits: How many parallel calls by default?**
   - **Recommendation**:
     - Local (Ollama): 10 workers (adjustable 1-20)
     - Cloud (OpenAI): 50 concurrent (API limit)
     - Modal: 100 concurrent (cost-dependent)
   - **Rationale**: Balance speed vs resource usage
   - **Trade-off**: More concurrency = more memory/GPU usage

4. **Cost Budgets: Should we add spend limits?**
   - **Recommendation**: Yes
     - Warn at $1/experiment
     - Block at $10/experiment (user override)
     - Monthly budget tracking
   - **Rationale**: Prevent accidental API bills
   - **Trade-off**: Adds friction for advanced users

5. **Ollama Bundling: Bundle with app or require separate install?**
   - **Recommendation**: Optional bundled installer
     - App works without Ollama (uses cloud fallback)
     - Onboarding wizard offers Ollama installation
     - One-click install script included
   - **Rationale**: Don't force 5GB download, but make it easy
   - **Trade-off**: Extra packaging complexity

6. **Modal Requirement: Required or optional?**
   - **Recommendation**: Optional
     - App works without Modal
     - Modal unlocks 50+ persona experiments
     - Clear messaging when Modal would help
   - **Rationale**: Lower barrier to entry
   - **Trade-off**: Users might not discover Modal benefits

7. **Discovery Default: Run automatically or require opt-in?**
   - **Recommendation**: Opt-in with suggestion
     - Checkbox in experiment config (default: off)
     - After experiment, suggest running discovery
     - Save preference
   - **Rationale**: Discovery adds 1-2 minutes, not always needed
   - **Trade-off**: Users might miss discovery feature

### Authentication

- **Decision**: Keep Clerk
- **Rationale**: Already integrated, works well, store JWT in keychain

### Config Format

- **Decision**: JSON primary, YAML optional
- **Rationale**: JSON is standard, YAML is more readable

### Cloud Sync

- **Decision**: Optional, enabled by default
- **Rationale**: Best of both worlds (offline + collaboration)

### Distribution

- **Decision**: Direct download first, App Store later
- **Rationale**: Faster iteration, no review delays

---

## 11. Model Quality & Cost Comparison

### Recommended Models by Use Case

| Use Case                 | Model             | Provider  | Speed            | Cost/1M tokens | Quality    |
| ------------------------ | ----------------- | --------- | ---------------- | -------------- | ---------- |
| **Persona Simulation**   | Qwen2.5:32b       | Ollama    | Fast (0.5s)      | $0             | ⭐⭐⭐⭐   |
| **Persona Simulation**   | DeepSeek-V3       | Modal/API | Fast (1s)        | $0.27          | ⭐⭐⭐⭐⭐ |
| **Persona Simulation**   | GPT-4o-mini       | OpenAI    | Medium (2s)      | $0.15          | ⭐⭐⭐⭐   |
| **Discovery Hypothesis** | GPT-4o            | OpenAI    | Slow (4s)        | $2.50          | ⭐⭐⭐⭐⭐ |
| **Discovery Hypothesis** | Llama3.3:70b      | Ollama    | Medium (2s)      | $0             | ⭐⭐⭐⭐   |
| **Sentiment Analysis**   | Llama3.2:3b       | Ollama    | Very Fast (0.2s) | $0             | ⭐⭐⭐     |
| **Code Generation**      | GPT-4o            | OpenAI    | Slow (5s)        | $2.50          | ⭐⭐⭐⭐⭐ |
| **Code Generation**      | DeepSeek-Coder-V2 | Ollama    | Medium (2s)      | $0             | ⭐⭐⭐⭐   |

### Cost Comparison: 10-Persona Experiment

| Strategy                 | Time | Cost   | Notes                             |
| ------------------------ | ---- | ------ | --------------------------------- |
| OpenAI Sequential        | 60s  | $0.03  | Original (slow + expensive)       |
| OpenAI Parallel          | 12s  | $0.03  | 5x faster, same cost              |
| Modal DeepSeek-V3        | 3s   | $0.003 | 20x faster, 10x cheaper           |
| Ollama Qwen2.5:32b       | 6s   | $0     | 10x faster, free                  |
| **Hybrid (Recommended)** | 6s   | $0     | Ollama personas, GPT-4o discovery |

### Cost Comparison: 100-Iteration MCTS

| Strategy                  | Time  | Cost  | Notes                   |
| ------------------------- | ----- | ----- | ----------------------- |
| OpenAI Sequential         | 10min | $1.50 | Unusable UX             |
| OpenAI Parallel           | 2min  | $1.50 | 5x faster, same cost    |
| Modal Hybrid              | 45s   | $0.30 | 13x faster, 80% cheaper |
| **Ollama + GPT Critical** | 60s   | $0.50 | 10x faster, 66% cheaper |

---

## Conclusion

This document captures the complete architecture for rebuilding Unheard as an **Electron desktop application with parallelization-first LLM architecture**. The design:

- **Eliminates Rust complexity** - Pure TypeScript/Node.js stack
- **Achieves 10x faster experiments** - Parallel LLM execution (60s → 6s)
- **Reduces costs 90%** - Open-source models via Ollama
- **Retains all core functionality** - MCTS, Mastra agents, experiments, discovery
- **Introduces config-driven execution** - Version-controllable experiments
- **Maintains Convex integration** - Cloud features when available
- **Provides clear 12-week roadmap** - Faster than original 14-week Tauri plan

**Key Innovation**: Parallelization transforms UX from "start and leave" to "watch live results"

**Next Steps**:

1. Review and approve this architecture
2. Install Ollama and test Qwen2.5:32b quality
3. Set up development environment
4. Begin Phase 1: Foundation (Electron + React + Config)

---

_Document Version: 2.0 (Electron Edition)_
_Last Updated: 2026-01-29_
_Previous Version: 1.0 (Tauri Edition) - superseded_
