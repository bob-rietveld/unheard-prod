# Architecture Decision Record

**Date**: 2026-02-04
**Status**: Accepted
**Context**: Rebuilding Unheard V2 decision support platform for founders

---

## Executive Summary

After thorough analysis, we've chosen a **hybrid local+cloud architecture** using:

- **Tauri v2** (desktop framework)
- **Claude Agent SDK** (local conversational agent)
- **Convex** (cloud database & sync)
- **Modal/Daytona** (cloud execution for parallel processing)
- **Git/GitHub** (version control & collaboration)

This provides the best balance of:

- ✅ Responsive UX (local agent)
- ✅ Powerful execution (cloud parallelization)
- ✅ Data ownership (Git-based)
- ✅ Collaboration (GitHub)
- ✅ Security (Rust backend)

---

## Decision 1: Tauri vs Electron

### Options Considered

| Factor             | **Tauri** ✅       | Electron            |
| ------------------ | ------------------ | ------------------- |
| **Bundle size**    | 15MB               | 200MB               |
| **Memory**         | 80MB               | 400MB               |
| **Security**       | Rust (memory-safe) | Node.js (less safe) |
| **Performance**    | Native             | Good                |
| **Development**    | Rust + Web         | JavaScript only     |
| **Maturity**       | v2.0 (stable)      | Very mature         |
| **Ecosystem**      | Growing            | Huge                |
| **Node.js access** | Via Rust bridge    | Native              |

### Decision: **Tauri** ✅

**Rationale**:

1. **Already invested**: Foundation already built (Convex integration done)
2. **Security**: Rust backend prevents entire categories of vulnerabilities
3. **Performance**: 15MB bundle vs 200MB matters for distribution
4. **Modern**: Tauri v2 is production-ready, active development
5. **Git integration**: git2 Rust crate works great with Tauri

**Trade-offs Accepted**:

- ❌ Can't run Node.js agents (Mastra) directly → Use Claude SDK or cloud execution
- ❌ Rust learning curve for backend → Mitigated by good docs and copilot
- ❌ Smaller ecosystem → Mitigated by active community

**What We Gain**:

- ✅ Better security (Rust)
- ✅ Smaller bundle (faster download)
- ✅ Lower memory usage
- ✅ Native Git integration
- ✅ Foundation already built

---

## Decision 2: Local Agent (Claude SDK) vs Cloud Agents

### Options Considered

| Factor            | **Claude SDK (Local)** ✅ | Cloud Only     | Hybrid (Both)  |
| ----------------- | ------------------------- | -------------- | -------------- |
| **Response time** | <200ms                    | 500-1000ms     | <200ms (local) |
| **Offline**       | Yes (chat only)           | No             | Partial        |
| **Cost**          | Pay per use               | Pay per use    | Both           |
| **Complexity**    | Medium                    | Low            | High           |
| **Scalability**   | Limited                   | Unlimited      | Best of both   |
| **Data privacy**  | High (local)              | Medium (cloud) | High (local)   |

### Decision: **Hybrid - Claude SDK Local + Cloud Execution** ✅

**Rationale**:

1. **UX is critical**: Chat needs to feel instant (<200ms)
2. **Execution needs scale**: 10+ personas require parallel cloud execution
3. **Best of both worlds**: Local for responsiveness, cloud for power
4. **Data privacy**: Context stays local until explicitly sent to cloud

**Architecture**:

```
┌─────────────────────────────┐
│  LOCAL (Tauri + Claude SDK) │
│  - Chat interface           │
│  - Template selection       │
│  - Configuration            │
│  - Context management       │
└─────────────────────────────┘
            ↓
    (sends config only)
            ↓
┌─────────────────────────────┐
│  CLOUD (Modal/Daytona)      │
│  - Persona generation       │
│  - Parallel execution       │
│  - Results aggregation      │
└─────────────────────────────┘
            ↓
    (returns results)
            ↓
┌─────────────────────────────┐
│  LOCAL (Display)            │
│  - Results visualization    │
│  - Insights extraction      │
│  - Follow-up questions      │
└─────────────────────────────┘
```

**What We Gain**:

- ✅ Instant chat responses (local)
- ✅ Scalable execution (cloud)
- ✅ Offline capability (chat works, experiments queue)
- ✅ Cost-efficient (only pay for execution)
- ✅ Privacy (context doesn't leave device unless needed)

---

## Decision 3: Convex vs Supabase vs Firebase

### Options Considered

| Factor             | **Convex** ✅      | Supabase       | Firebase        |
| ------------------ | ------------------ | -------------- | --------------- |
| **Real-time**      | Built-in           | Built-in       | Built-in        |
| **TypeScript**     | Native             | Good           | Good            |
| **Dev experience** | Excellent          | Good           | Good            |
| **Queries**        | JS functions       | SQL            | NoSQL           |
| **Pricing**        | Free tier generous | Free tier good | Free tier good  |
| **Actions**        | Built-in (Node.js) | Edge functions | Cloud functions |
| **Already setup**  | YES ✅             | No             | No              |

### Decision: **Convex** ✅

**Rationale**:

1. **Already integrated**: Foundation complete (just implemented Phase 1!)
2. **Real-time**: Perfect for collaborative features
3. **Actions**: Built-in serverless Node.js for backend logic
4. **TypeScript-first**: Full type safety
5. **Developer experience**: Best in class

**Use Cases**:

- Template library storage
- Context file metadata
- Experiment configurations
- Results database
- User authentication
- Real-time collaboration

---

## Decision 4: Modal vs AWS Lambda vs Daytona

### Options Considered for Cloud Execution

| Factor          | **Modal** ✅      | AWS Lambda     | Daytona       |
| --------------- | ----------------- | -------------- | ------------- |
| **Python**      | Native            | Yes            | Yes           |
| **Concurrency** | 100s              | 1000s          | Configurable  |
| **Cost**        | Pay-per-second    | Pay-per-invoke | GPU-optimized |
| **Cold start**  | <1s               | <1s            | Varies        |
| **GPU**         | Easy              | Complex        | Native        |
| **Dev exp**     | Excellent         | Good           | Good          |
| **OSS models**  | Easy (containers) | Harder         | Native        |

### Decision: **Modal Primary, Daytona Optional** ✅

**Rationale**:

1. **Developer experience**: Modal has the best DX for Python functions
2. **Concurrency**: Built for parallel workloads (perfect for persona execution)
3. **Container support**: Easy to run OSS models (Qwen2.5, Llama, etc.)
4. **Cost**: Pay-per-second is cost-effective for our use case
5. **Flexibility**: Can add Daytona later for GPU workloads

**Architecture**:

```python
# Modal function for persona execution
@app.function(
    image=Image.debian_slim().pip_install("anthropic", "openai"),
    concurrency_limit=50
)
async def execute_persona(persona_config, stimulus):
    # Run persona simulation
    # Returns response + sentiment
    pass

# Called from Tauri via Convex action
# Runs 10+ personas in parallel
```

**What We Gain**:

- ✅ True parallelization (10+ personas at once)
- ✅ Cost-effective ($0.01-0.05 per experiment)
- ✅ OSS model support (Qwen2.5:32b, Llama 3.1)
- ✅ Fast execution (30 seconds vs 10 minutes)
- ✅ Easy to scale

---

## Decision 5: Git/GitHub vs Cloud Storage

### Options Considered for Decision Logging

| Factor              | **Git/GitHub** ✅           | Convex Only | S3/Cloud        |
| ------------------- | --------------------------- | ----------- | --------------- |
| **Version control** | Native                      | Manual      | Manual          |
| **Collaboration**   | Native (PRs, issues)        | Custom      | Custom          |
| **Diffs**           | Native                      | Manual      | Manual          |
| **Branching**       | Native                      | No          | No              |
| **Sharing**         | Read-only URLs              | Custom      | Pre-signed URLs |
| **Offline**         | Full support                | No          | No              |
| **Export**          | Native (flat files)         | API         | Downloads       |
| **Ecosystem**       | Huge (GitHub Actions, etc.) | N/A         | Limited         |

### Decision: **Git (local) + GitHub (remote)** ✅

**Rationale**:

1. **Natural versioning**: Every decision is a commit (full history)
2. **Collaboration**: GitHub's UX for review/comments is unbeatable
3. **Branching**: Try scenarios without losing work
4. **Diffs**: See exactly what changed between experiments
5. **Ecosystem**: GitHub Actions, integrations, etc. come for free
6. **Data ownership**: Founders own their decision log (Git repo)
7. **Export-friendly**: Everything is already flat files

**File Structure**:

```
company-decisions/
├── .unheard/
│   └── config.yaml
├── context/
│   ├── company-profile.yaml
│   └── customers.csv
├── decisions/
│   └── 2026-02-04-raise-seed-or-bootstrap.md
├── experiments/
│   └── exp-001-investor-pitch/
│       ├── config.yaml
│       ├── results.json
│       └── summary.md
└── templates/
    └── custom-investor-eval.yaml
```

**Implementation**:

- Rust git2 crate for Git operations
- GitHub OAuth for authentication
- Auto-commit on major actions
- Smart conflict resolution

**What We Gain**:

- ✅ Full decision history
- ✅ Team collaboration via GitHub
- ✅ Share with advisors (read-only)
- ✅ Branch for "what-if" scenarios
- ✅ Export = just clone the repo
- ✅ GitHub Actions for automation

---

## Decision 6: Template-Driven vs Fully Flexible

### Options Considered

| Factor             | **Template-Driven** ✅ | Fully Flexible | Hybrid  |
| ------------------ | ---------------------- | -------------- | ------- |
| **Onboarding**     | Fast (select template) | Slow (learn)   | Medium  |
| **Customization**  | Medium                 | Full           | Full    |
| **Best practices** | Encoded                | User learns    | Encoded |
| **Reusability**    | High                   | Low            | High    |
| **Complexity**     | Low (hidden)           | High (visible) | Medium  |

### Decision: **Template-Driven with Customization** ✅

**Rationale**:

1. **User insight**: Founders don't know what parameters to configure
2. **Chat interface**: Agent can recommend template based on conversation
3. **Best practices**: Templates encode expert knowledge
4. **Reusability**: "Run pricing test" → 2 minutes vs 30 minutes manual setup
5. **Customization**: Users can fork and modify templates

**Core Templates**:

1. **Investor Evaluation** (seed, series A, angels, strategic)
2. **Pricing Strategy** (SaaS, usage-based, tiered, freemium)
3. **Product Decisions** (features, roadmap, prioritization)
4. **Hiring** (engineering, sales, leadership, first hire)
5. **Operations** (processes, tools, outsourcing)

**Template Format**:

```yaml
id: investor-pitch-test
name: 'Investor Pitch Evaluation'
category: investors

# What questions to ask
configurationFlow:
  - question: 'What stage are you at?'
    options: [pre-seed, seed, series-a]
  - question: "What's your funding target?"
    type: number

# What personas to use
personas:
  type: standard
  archetypes:
    - seed_vc_partner
    - angel_investor
    - corporate_vc

# How to run experiment
experiment:
  type: scenario
  stimulusTemplate: "You're evaluating {company}..."
```

**What We Gain**:

- ✅ 2-minute setup vs 30-minute manual
- ✅ Best practices encoded
- ✅ Consistent results
- ✅ Easy to share templates
- ✅ Marketplace potential (community templates)

---

## Decision 7: Claude Desktop Style UI vs Custom Design

### Options Considered

| Factor              | **Claude Desktop Style** ✅ | Custom Design      | Notion-like    |
| ------------------- | --------------------------- | ------------------ | -------------- |
| **Familiarity**     | High (users know Claude)    | Low (learn)        | Medium         |
| **Chat UX**         | Excellent                   | Build from scratch | Not chat-first |
| **Development**     | Fast (copy patterns)        | Slow (design)      | Medium         |
| **Context sidebar** | Natural                     | Custom             | Natural        |
| **Streaming**       | Built-in pattern            | Build              | Not typical    |

### Decision: **Claude Desktop Style** ✅

**Rationale**:

1. **Familiarity**: Users already know Claude's UX (no learning curve)
2. **Chat-first**: Perfect for conversational decision-making
3. **Proven**: Claude Desktop has excellent UX patterns
4. **Context sidebar**: Natural place for company context
5. **Fast development**: Don't reinvent, copy what works

**Key UI Patterns to Copy**:

1. **Chat interface**: Center stage, streaming responses
2. **Context sidebar**: Always visible, shows relevant info
3. **Projects**: Each company = a project
4. **Artifacts**: Experiment results as artifacts
5. **Keyboard shortcuts**: Familiar to Claude users

**Customizations**:

- Add template selector
- Add experiment status
- Add results visualization
- Add Git status indicator

---

## Summary: Architectural Principles

### 1. **Hybrid Local+Cloud**

- Local for responsive UX (chat, context browsing)
- Cloud for heavy lifting (parallel execution)

### 2. **Data Ownership**

- Git-based storage (founders own their data)
- GitHub for collaboration (standard workflow)
- Export-friendly (flat files, not proprietary)

### 3. **Template-Driven**

- Hide complexity behind templates
- Encode best practices
- Enable rapid experimentation

### 4. **Security-First**

- Rust backend (memory safety)
- Local context storage
- Minimal cloud data transfer

### 5. **Founder-Focused**

- Solve real problems (fundraising, pricing, hiring)
- Chat interface (no parameter hell)
- 2-minute setup (vs 30-minute traditional)

---

## Risk Analysis

### Identified Risks

**1. Claude API Cost**

- **Risk**: High usage → high cost
- **Mitigation**: Use Claude Agent SDK locally (lower cost), rate limiting, cost tracking

**2. Modal Cold Starts**

- **Risk**: First request slow (<1s cold start)
- **Mitigation**: Keep functions warm, show progress clearly

**3. Git Merge Conflicts**

- **Risk**: Team members conflict on decision files
- **Mitigation**: Auto-merge strategy, clear conflict resolution UI

**4. Rust Learning Curve**

- **Risk**: Team unfamiliar with Rust
- **Mitigation**: Use AI assistance (Copilot), focus on small surface area (Git + file ops)

**5. Template Rigidity**

- **Risk**: Templates too rigid for edge cases
- **Mitigation**: Allow full customization, fork templates, community contributions

---

## Success Metrics

### Technical Metrics

- Chat response time: <200ms (p95)
- Experiment execution: <60s for 10 personas
- Bundle size: <20MB
- Memory usage: <150MB
- Cold start (app launch): <2s

### User Metrics

- Time to first experiment: <5 minutes
- Setup time (template-based): <2 minutes
- Template usage rate: >70%
- Team collaboration rate: >40% (multi-user projects)
- Git commits per project: >20 (high usage indicator)

### Business Metrics

- Cost per experiment: <$0.10
- Monthly cost per user: <$50 (at scale)
- Churn rate: <5% (monthly)
- NPS: >50

---

## Conclusion

This architecture provides:

1. ✅ **Best UX**: Local agent (instant), cloud execution (powerful)
2. ✅ **Best Security**: Rust backend, local data
3. ✅ **Best Collaboration**: Git/GitHub native
4. ✅ **Best Scalability**: Cloud execution (Modal)
5. ✅ **Best Cost**: Efficient use of LLMs
6. ✅ **Best DX**: Modern stack, good tooling

**We're ready to build.**

Start with Phase 1: Context Upload (Week 1-2)

See `vertical-slice-implementation.md` for detailed implementation plan.
