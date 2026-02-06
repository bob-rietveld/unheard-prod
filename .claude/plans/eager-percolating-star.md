> **LEGACY DOCUMENT** - This references superseded architecture (Electron/Mastra/GPT-4o). See README.md for current architecture.

# Unheard Engine: Complete Requirements & Build Document

## Desktop + Agent-Based Rebuild

**Date**: 2026-01-29
**Version**: 1.0
**Target Architecture**: Tauri Desktop App with Hybrid API

---

## Executive Summary

This document captures the complete requirements for rebuilding Unheard as a desktop application using Tauri (Rust + web frontend), with a hybrid API architecture (local-first + optional cloud), config-driven experiment orchestration, and retained Convex backend with Mastra agent framework.

**Key Architectural Decisions**:

- **Desktop Framework**: Tauri (Rust backend + Vite/React frontend)
- **API Layer**: Hybrid - Embedded Axum server (local) + Convex (cloud)
- **Data Storage**: Convex for user data + LibSQL for local tracing/cache
- **Agent Framework**: Keep Mastra (TypeScript/Node.js) - proven and working
- **Config System**: JSON/YAML configs that translate user intent → executable experiments

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

**Implementation Files**:

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
   - GPT-4o-mini for cost efficiency

2. **Persona Enrichment Agent** (`src/mastra/agents/PersonaEnrichmentAgent.ts`)
   - AI-driven persona generation from minimal input (company URL + job title)
   - Web scraping (Firecrawl) + search (Tavily) for context
   - Infers realistic traits, beliefs, preferences

3. **Experiment Assistant Agent** (`src/mastra/agents/ExperimentAssistantAgent.ts`)
   - Conversational experiment design
   - Generates structured configs from natural language
   - Proposes alternative hypotheses
   - **CRITICAL**: Enhance to output full `UnheardExperimentConfig`

4. **Discovery Agents** (`src/mastra/agents/discovery/`)
   - `hypothesisGeneratorAgent`: Proposes testable hypotheses
   - `experimentPlannerAgent`: Creates test plans with Python code
   - `experimentAnalystAgent`: Interprets results
   - `beliefElicitorAgent`: Samples boolean beliefs for Bayesian updates
   - `summaryGeneratorAgent`: Creates human-readable summaries

**Network Topologies**:

1. **BroadcastNetwork**: All agents respond simultaneously (parallel)
   - Use case: Quick surveys, time-sensitive feedback

2. **RoundRobinNetwork**: Sequential responses, agents build on prior responses
   - Use case: Focus groups, consensus building

3. **ModeratedNetwork**: AI moderator guides discussion with follow-ups
   - Use case: Deep exploration, guided discussions

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

- OpenAI: GPT-4o, GPT-4o-mini (personas), GPT-5 series (latest)
- Anthropic: Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 3.5
- Model selection: Per-user configurable via settings

### 1.3 Experiment Management System

**Experiment Workflow**:

```
User Intent → Config → Validation → Persona Loading →
Network Init → Round Execution → Response Collection →
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
  sourceConfigId?: Id<"experimentConfigs">, // NEW: Link to config
  extractedDataset?: any,
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

**Purpose**: Safe Python code execution for statistical analysis

**Integration Points**:

- AutoDiscovery engine generates Python code via `pythonCodeGeneratorAgent`
- Code executes in Modal sandbox (serverless, 60s timeout)
- Results parsed and used as evidence for Bayesian belief updates
- Falls back to LLM analysis if code execution fails

**API**: `POST /api/modal/execute` (requires Modal credentials)

---

## 2. New Architecture: Tauri Desktop App

### 2.1 Technology Stack

| Layer                 | Technology       | Rationale                                                  |
| --------------------- | ---------------- | ---------------------------------------------------------- |
| **Desktop Framework** | Tauri 2.0        | Rust security, small binary (~10MB), native OS integration |
| **Frontend**          | Vite + React 18  | Fast dev, smaller bundle than Next.js, CSR optimized       |
| **Routing**           | React Router v6  | Replace Next.js App Router                                 |
| **Backend**           | Rust (Axum)      | Embedded HTTP server for local API                         |
| **Agent Runtime**     | Node.js + Mastra | Keep existing agents, no rewrite needed                    |
| **Database (Cloud)**  | Convex           | Keep existing schema, real-time sync                       |
| **Database (Local)**  | LibSQL           | Tracing, cache, offline data                               |
| **Auth**              | Clerk JWT        | Store token in OS keychain (via Rust)                      |
| **UI Components**     | shadcn/ui        | Keep existing components                                   |
| **Styling**           | Tailwind CSS     | Keep existing styles                                       |

### 2.2 Directory Structure

```
unheard-desktop/
├── src-ui/                       # Frontend (Vite + React)
│   ├── src/
│   │   ├── main.tsx              # Entry point
│   │   ├── App.tsx               # Root with React Router
│   │   ├── router.tsx            # Route definitions
│   │   ├── components/           # Existing components (95% reusable)
│   │   │   ├── experiments/
│   │   │   ├── personas/
│   │   │   ├── focus-groups/
│   │   │   ├── discovery/
│   │   │   └── ui/               # shadcn/ui
│   │   ├── services/             # NEW: API layer
│   │   │   ├── api-client.ts     # Unified API client
│   │   │   ├── convex-client.ts  # Convex wrapper
│   │   │   ├── tauri-commands.ts # Tauri IPC
│   │   │   └── config-service.ts # Config management
│   │   ├── stores/               # NEW: State management (Zustand)
│   │   │   ├── auth-store.ts
│   │   │   ├── config-store.ts
│   │   │   └── experiment-store.ts
│   │   └── lib/                  # Utilities
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # App initialization
│   │   ├── lib.rs
│   │   ├── commands/             # Tauri commands (IPC)
│   │   │   ├── mod.rs
│   │   │   ├── config.rs         # Config CRUD
│   │   │   ├── auth.rs           # Token management
│   │   │   └── system.rs         # File dialogs, system info
│   │   ├── config/               # Config management
│   │   │   ├── mod.rs
│   │   │   ├── manager.rs        # File I/O
│   │   │   ├── validator.rs      # Schema validation
│   │   │   └── schema.rs         # Serde structs
│   │   ├── server/               # Embedded Axum HTTP server
│   │   │   ├── mod.rs
│   │   │   ├── routes.rs         # API endpoints
│   │   │   └── health.rs         # Health check
│   │   ├── orchestration/        # NEW: Experiment orchestration
│   │   │   ├── mod.rs
│   │   │   ├── experiment.rs     # Experiment runner
│   │   │   ├── discovery.rs      # Discovery runner
│   │   │   └── scheduler.rs      # Multi-experiment scheduling
│   │   ├── mastra/               # NEW: Mastra runtime bridge
│   │   │   ├── mod.rs
│   │   │   ├── runtime.rs        # Initialize Mastra
│   │   │   └── agents.rs         # Agent pool management
│   │   ├── storage/              # Local storage
│   │   │   ├── mod.rs
│   │   │   ├── credentials.rs    # OS keychain integration
│   │   │   └── cache.rs          # Local cache (LibSQL)
│   │   └── utils/
│   │       ├── logger.rs
│   │       └── errors.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
│
├── shared/                       # Shared types (TypeScript)
│   ├── types/
│   │   ├── config.ts             # Config schemas
│   │   ├── experiment.ts
│   │   └── persona.ts
│   └── package.json
│
├── convex/                       # Convex backend (unchanged)
│   ├── schema.ts
│   ├── experiments/
│   ├── personas/
│   ├── focusGroups/
│   └── discovery/
│
├── package.json                  # Root workspace
└── README.md
```

### 2.3 Communication Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
└─────────────────────────────────────────────────────────┘
     │                    │                    │
     │ (1) Tauri IPC      │ (2) HTTP          │ (3) Direct
     │ (Config/System)    │ (Experiments)     │ (Convex)
     ▼                    ▼                    ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Rust      │    │ Axum Server  │    │   Convex     │
│  Commands   │    │ (localhost)  │    │   Client     │
└─────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │    Mastra    │
                   │   Runtime    │
                   │  (Node.js)   │
                   └──────────────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
         ┌─────────┐  ┌────────┐  ┌────────┐
         │ OpenAI  │  │Anthropic│ │ Modal  │
         └─────────┘  └────────┘  └────────┘
```

**Communication Patterns**:

1. **Tauri Commands** (Rust IPC) - Fast, synchronous
   - Config CRUD
   - Auth token storage/retrieval
   - File system operations
   - System info

2. **HTTP to Axum** (localhost) - Streaming, asynchronous
   - Experiment execution (SSE)
   - Discovery analysis (SSE)
   - AI agent interactions

3. **Direct Convex** (WebSocket) - Real-time, cloud
   - Database queries/mutations
   - Real-time subscriptions
   - Auth

### 2.4 Config System (NEW)

**Purpose**: Translate user intent → executable experiment configuration

**Config Format**: JSON/YAML with Zod validation

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
      "topology": "round_robin",
      "maxRounds": 3
    }
  },
  "discovery": {
    "enabled": true,
    "trigger": "after_experiment",
    "config": {
      "maxIterations": 100,
      "explorationConstant": 1.414,
      "maxDepth": 5,
      "surprisalThreshold": 0.5
    }
  },
  "execution": {
    "autoStart": false,
    "metrics": ["sentiment", "consensus"]
  }
}
```

**Config Storage**:

- **Local**: `~/.config/unheard/configs/*.json` (user templates)
- **Cloud**: New Convex table `experimentConfigs`
- **Version Control**: Git-friendly, team collaboration

**Translation Paths**:

1. **AI Assistant** → Full config (enhanced ExperimentAssistantAgent)
2. **Wizard** → Config (export wizard state)
3. **Template** → Config (pre-built templates)
4. **Manual** → Config (JSON editor)

---

## 3. API Layer Design

### 3.1 Local API (Axum - Rust)

**Embedded in Tauri process** - No separate Node server needed for basic operations

**Core Endpoints**:

```rust
// Config Management
POST   /api/v1/config/validate
POST   /api/v1/config/load
POST   /api/v1/config/save

// Experiment Control
POST   /api/v1/experiments/start
POST   /api/v1/experiments/{id}/pause
POST   /api/v1/experiments/{id}/resume
POST   /api/v1/experiments/{id}/stop
GET    /api/v1/experiments/{id}/status
GET    /api/v1/experiments/{id}/stream       // SSE

// Discovery Control
POST   /api/v1/discovery/start
POST   /api/v1/discovery/{session_id}/pause
POST   /api/v1/discovery/{session_id}/resume
GET    /api/v1/discovery/{session_id}/status
GET    /api/v1/discovery/{session_id}/stream  // SSE

// Results Retrieval
GET    /api/v1/experiments/{id}/results
GET    /api/v1/experiments/{id}/export?format=json|csv
GET    /api/v1/discovery/{session_id}/results
```

**Port Selection**: Try 4111-4120, find first available

**Lifecycle**:

- Start on app launch
- Graceful shutdown on app close
- Health check endpoint: `GET /api/v1/health`

### 3.2 Hybrid Cloud Features

**Cloud vs Local Decision Matrix**:

| Feature              | Primary | Backup | Notes                             |
| -------------------- | ------- | ------ | --------------------------------- |
| Experiment Execution | Local   | Cloud  | Low latency, privacy              |
| Persona Storage      | Local   | Cloud  | Offline access                    |
| Config Management    | Local   | Cloud  | Offline editing                   |
| Discovery (MCTS)     | Local   | Cloud  | Compute-intensive but local-first |
| Modal Sandbox        | Cloud   | -      | Requires cloud service            |
| AI Model Calls       | Cloud   | -      | OpenAI/Anthropic APIs             |
| Results Storage      | Local   | Cloud  | User owns data                    |
| Collaboration        | Cloud   | -      | Multi-user features               |

**Sync Strategy**: Offline-first with background sync

- Local SQLite for immediate writes
- Background sync to Convex when online
- Conflict resolution: last-write-wins (personas), merge (results)

### 3.3 Mastra Bridge (Rust ↔ Node.js)

**Challenge**: Mastra is TypeScript-only, no Rust equivalent

**Solution**: Rust spawns Node.js process for AI workloads

```rust
// src-tauri/src/mastra/runtime.rs

pub struct MastraRuntime {
    node_process: Option<Child>,
    port: u16,
}

impl MastraRuntime {
    pub async fn start(&mut self) -> Result<()> {
        // Start Node.js server with Mastra
        let child = Command::new("node")
            .arg("mastra-server/dist/index.js")
            .env("PORT", self.port.to_string())
            .spawn()?;

        self.node_process = Some(child);
        Ok(())
    }

    pub async fn call_agent(&self, agent_id: &str, prompt: &str) -> Result<String> {
        // HTTP call to Node.js Mastra server
        let response = reqwest::post(format!("http://localhost:{}/agents/{}/generate", self.port, agent_id))
            .json(&json!({ "prompt": prompt }))
            .send()
            .await?;

        Ok(response.text().await?)
    }
}
```

**Alternative** (for V2): Port Mastra agents to Rust using `langchain-rust` or custom implementation

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goals**: Set up Tauri project, migrate frontend, establish config system

**Tasks**:

1. Initialize Tauri project (`npm create tauri-app`)
2. Set up Vite + React frontend
3. Migrate shadcn/ui components (no changes needed)
4. Replace Next.js Link → React Router Link
5. Create config schema (`src/lib/config/schema.ts`) with Zod
6. Implement Rust config management (`src-tauri/src/config/`)
7. Implement Tauri commands for config CRUD
8. Test: Load/save configs via Tauri IPC

**Deliverables**:

- Working Tauri app with React UI
- Config management working (local file storage)
- Basic routing functional

### Phase 2: Local API (Weeks 3-4)

**Goals**: Embed Axum server, port experiment execution logic

**Tasks**:

1. Implement Axum server (`src-tauri/src/server/`)
2. Port `/api/experiments/run` logic to Rust
3. Implement SSE streaming for experiment progress
4. Port experiment orchestration (`src-tauri/src/orchestration/experiment.rs`)
5. Integrate Convex client in frontend (`services/convex-client.ts`)
6. Implement auth token storage (OS keychain)
7. Test: Create and run experiment end-to-end

**Deliverables**:

- Embedded Axum server running on localhost
- Experiment execution working with SSE streaming
- Convex integration functional

### Phase 3: Mastra Integration (Weeks 5-6)

**Goals**: Integrate Mastra agents, establish Node.js bridge

**Tasks**:

1. Create Mastra Node.js server (`src-tauri/mastra-server/`)
2. Port existing Mastra agents (copy from current codebase)
3. Implement Rust → Node.js bridge (`src-tauri/src/mastra/runtime.rs`)
4. Port network topologies (Broadcast, RoundRobin, Moderated)
5. Test persona simulation with all topologies
6. Implement agent pool management for concurrency control
7. Test: Multi-round experiment with 10+ personas

**Deliverables**:

- Mastra agents working via Node.js bridge
- All network topologies functional
- Agent pool concurrency limits enforced

### Phase 4: Discovery System (Weeks 7-8)

**Goals**: Port AutoDiscovery engine, implement streaming

**Tasks**:

1. Port MCTS engine to Rust (`src-tauri/src/discovery/mcts.rs`)
2. Port Bayesian surprise calculations
3. Implement discovery orchestration (`src-tauri/src/orchestration/discovery.rs`)
4. Port discovery agents (hypothesis generation, analysis, etc.)
5. Implement Modal sandbox integration
6. Port SSE streaming for discovery progress
7. Test: Full discovery session with 100+ iterations

**Deliverables**:

- AutoDiscovery working end-to-end
- MCTS tree exploration functional
- Modal sandbox integration working

### Phase 5: Config-Driven Execution (Weeks 9-10)

**Goals**: Implement config validation, API endpoints, templates

**Tasks**:

1. Implement config validator (`src/lib/config/validator.ts`)
2. Create API endpoint `POST /api/v1/experiments/from-config`
3. Create API endpoint `POST /api/v1/discovery/from-config`
4. Enhance ExperimentAssistantAgent to output full configs
5. Create 5-10 experiment templates
6. Implement config editor UI with Monaco (JSON/YAML syntax highlighting)
7. Test: Create experiment from config, run, get results

**Deliverables**:

- Config-driven experiment creation working
- Template library available
- AI assistant generates full configs

### Phase 6: UI/UX Polish (Weeks 11-12)

**Goals**: Desktop-specific features, onboarding, polish

**Tasks**:

1. System tray integration
2. Desktop notifications for experiment completion
3. File system integration (save/load from disk)
4. Onboarding wizard (first launch)
5. Settings page (model selection, resource limits)
6. Dark mode support
7. Keyboard shortcuts (⌘K command palette)
8. Test: Full user journey from onboarding to results

**Deliverables**:

- Polished desktop app experience
- Onboarding complete
- Settings functional

### Phase 7: Testing & Packaging (Weeks 13-14)

**Goals**: Testing, packaging, distribution

**Tasks**:

1. Unit tests for core modules
2. Integration tests for API endpoints
3. E2E tests with Playwright
4. Create app icons and assets
5. Code signing setup (macOS, Windows)
6. Auto-update integration
7. Package for macOS, Windows, Linux
8. Test installation on fresh machines

**Deliverables**:

- Tested and packaged desktop app
- Installers for all platforms
- Auto-update working

---

## 5. Critical Files Reference

### Files to Port/Reuse

**MCTS Engine**:

- `src/lib/mcts/tree.ts` → Rust `src-tauri/src/discovery/mcts/tree.rs`
- `src/lib/mcts/surprise.ts` → Rust `src-tauri/src/discovery/mcts/surprise.rs`
- `src/lib/autodiscovery/engine.ts` → Rust `src-tauri/src/discovery/engine.rs`
- `src/lib/autodiscovery/beliefs.ts` → Rust `src-tauri/src/discovery/beliefs.rs`

**API Routes** (Next.js → Axum):

- `src/app/api/experiments/run/route.ts` → `src-tauri/src/server/routes/experiments.rs`
- `src/app/api/discovery/route.ts` → `src-tauri/src/server/routes/discovery.rs`
- `src/app/api/experiments/assistant/route.ts` → Keep in Mastra Node server

**Mastra Agents** (Copy as-is):

- `src/mastra/agents/TinyPerson.ts` → `src-tauri/mastra-server/agents/TinyPerson.ts`
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
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment

# Clerk (Auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Modal (Optional - for Python sandbox)
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...

# Tavily (Web search)
TAVILY_API_KEY=tvly-...

# Firecrawl (Web scraping)
FIRECRAWL_API_KEY=fc-...

# Mastra (Optional cloud tracing)
MASTRA_CLOUD_ACCESS_TOKEN=...
MASTRA_DB_URL=file:./mastra.db  # Local LibSQL

# App Config
RUST_LOG=info  # Logging level
```

**Storage**: Store in OS-specific secure location via Rust config manager

---

## 7. Success Criteria

### Functional Requirements ✓

- [ ] User can create experiments via wizard, assistant, or config
- [ ] User can select personas from focus groups
- [ ] Experiments run with all 3 network topologies (Broadcast, RoundRobin, Moderated)
- [ ] Real-time progress streaming during execution
- [ ] Results stored in Convex with sentiment/consensus metrics
- [ ] AutoDiscovery runs after experiments with MCTS exploration
- [ ] Surprising hypotheses identified and displayed
- [ ] Configs can be saved, loaded, and shared
- [ ] Offline mode: experiments run without internet (except AI API calls)
- [ ] App auto-updates

### Performance Requirements ✓

- [ ] App startup < 3 seconds
- [ ] Experiment with 10 personas, 3 rounds: < 5 minutes
- [ ] Discovery with 100 iterations: < 10 minutes
- [ ] UI remains responsive during long-running tasks
- [ ] Memory usage < 500MB under normal load

### Quality Requirements ✓

- [ ] Zero data loss (local + cloud redundancy)
- [ ] Graceful error handling with user-friendly messages
- [ ] Comprehensive logging for debugging
- [ ] Secure credential storage (OS keychain)
- [ ] Code coverage > 70%

---

## 8. Key Architectural Principles

1. **Local-First**: All core features work offline (except AI API calls)
2. **User Data Sovereignty**: Data stored locally by default, cloud optional
3. **Config-as-Code**: Experiments defined in version-controllable configs
4. **Streaming by Default**: Real-time progress via SSE for long operations
5. **Graceful Degradation**: App continues working if cloud services unavailable
6. **Backward Compatible**: Can read experiments created in old web app
7. **Resource Aware**: Respect system limits, don't overwhelm with concurrent experiments

---

## 9. Migration Path from Current Web App

### Data Migration

1. **Export from Convex**: Use Convex dashboard to export all data
2. **Import to New App**: First launch imports existing experiments/personas
3. **Backward Compatibility**: Read old experiment format, auto-convert to new config

### User Transition

1. **Phase 1**: Web app continues running (no disruption)
2. **Phase 2**: Desktop beta available for testing
3. **Phase 3**: Desktop becomes primary, web deprecated (with notice)
4. **Phase 4**: Web app shut down, redirect to desktop download

### Feature Parity Checklist

- [ ] All experiment types supported
- [ ] All network topologies working
- [ ] Discovery analysis equivalent or better
- [ ] Persona management (CRUD, import, enrichment)
- [ ] Focus group management
- [ ] Results export (JSON, CSV)
- [ ] Settings and preferences
- [ ] User authentication

---

## 10. Questions & Decisions Needed

### Before Starting Implementation

1. **Authentication**: Keep Clerk or switch to Convex auth?
   - **Recommendation**: Keep Clerk, store JWT in OS keychain

2. **Mastra Bridge**: Node.js subprocess or port to Rust?
   - **Recommendation**: Node.js subprocess for V1, consider Rust port for V2

3. **Config Format**: JSON, YAML, or both?
   - **Recommendation**: JSON primary, YAML optional for readability

4. **Discovery Math**: Keep TypeScript or port to Rust?
   - **Recommendation**: Port to Rust for performance (numerical computations)

5. **Cloud Sync**: Required or optional?
   - **Recommendation**: Optional, but enable by default

6. **Distribution**: App Store, direct download, or both?
   - **Recommendation**: Direct download first, App Store later

---

## Conclusion

This document captures the complete architecture for rebuilding Unheard as a Tauri desktop application with a hybrid local/cloud approach. The design:

- **Retains all core functionality** (MCTS, Mastra agents, experiments, discovery)
- **Introduces config-driven execution** for flexibility and automation
- **Prioritizes local-first operation** for speed and data sovereignty
- **Maintains Convex integration** for cloud features when available
- **Provides clear implementation roadmap** (14 weeks)

**Next Steps**:

1. Review and approve this architecture
2. Set up development environment
3. Begin Phase 1: Foundation (Tauri + React + Config system)

---

_Document Version: 1.0_
_Last Updated: 2026-01-29_
