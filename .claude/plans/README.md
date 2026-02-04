# Unheard V2: Complete Planning Documents

**Created**: 2026-01-29
**Updated**: 2026-02-04 (Revised for Tauri + Claude SDK)
**Status**: Ready for Implementation
**Strategy**: Vertical slices - Complete working features, shipped incrementally

---

## 🚀 START HERE

**Read this first**: `IMPLEMENTATION-PRIORITY.md` ⭐

This document explains:

- **Vertical slice strategy** (function-by-function delivery)
- **5 implementation phases** (8 weeks total)
- **Complete tech stack** (Tauri + React + Claude SDK + Convex + Modal)
- **Template-driven architecture** (investors, product, operations)
- **Git/GitHub integration** (decision logging & collaboration)
- **Week-by-week checklist**

**Then read**: This README for complete document index.

---

## 🎯 What You're Building

**Unheard V2** is an **AI-powered decision support platform for founders** with:

1. **Template-Driven System** - Pre-configured workflows (Investors, Product, Operations)
2. **Conversational Interface** - Claude Desktop-style chat (no complex configuration)
3. **Context-Grounded** - Company data, metrics, docs always inform decisions
4. **Cloud Execution** - Parallel processing via Modal/Daytona (10+ personas simultaneously)
5. **Git Integration** - Every decision versioned, collaborative, shareable
6. **Local-First Agent** - Claude Agent SDK runs locally for responsive UX
7. **Founder-Focused** - Solves real founder problems (fundraising, pricing, hiring)

---

## 📊 Architecture Overview

### Tech Stack

```
Desktop:        Tauri v2 (Rust + React)
Frontend:       React 19 + Vite + TypeScript
UI:             shadcn/ui v4 (Radix + Tailwind CSS v4)
State:          Zustand v5 + TanStack Query
Local Agent:    Claude Agent SDK (conversational UI)
Cloud Backend:  Convex (templates, context, results)
Execution:      Modal + Daytona (parallel processing, OSS models)
Versioning:     Git + GitHub (decision logging)
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│              TAURI APP (Local Desktop)              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────┐     │
│  │  Chat Interface (Claude Desktop style)   │     │
│  │  - Conversational decision-making        │     │
│  │  - Context sidebar always visible        │     │
│  │  - Real-time streaming results           │     │
│  └──────────────────────────────────────────┘     │
│                      ↕                              │
│  ┌──────────────────────────────────────────┐     │
│  │  Local Agent (Claude SDK)                │     │
│  │  - Understands decision domain           │     │
│  │  - Selects/customizes template           │     │
│  │  - Guides configuration                  │     │
│  │  - Explains results                      │     │
│  └──────────────────────────────────────────┘     │
│                      ↕                              │
│  ┌──────────────────────────────────────────┐     │
│  │  Git Manager (Rust)                      │     │
│  │  - Auto-commit decisions/experiments     │     │
│  │  - GitHub sync & collaboration           │     │
│  │  - Version control & history             │     │
│  └──────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
                         ↕
         ┌───────────────────────────────┐
         │   CONVEX (Cloud Backend)      │
         ├───────────────────────────────┤
         │ • Template library            │
         │ • Context storage (CSV, PDF)  │
         │ • Experiment configs          │
         │ • Results database            │
         │ • User authentication         │
         └───────────────────────────────┘
                         ↕
         ┌───────────────────────────────┐
         │   EXECUTION LAYER (Cloud)     │
         ├───────────────────────────────┤
         │ • Modal (OSS models)          │
         │ • Daytona (compute)           │
         │ • Parallel processing         │
         │ • 10+ concurrent personas     │
         └───────────────────────────────┘
```

---

## 📚 Document Index

### **1. Implementation Priority** ⭐ READ FIRST

**File**: `IMPLEMENTATION-PRIORITY.md`
**Purpose**: Master implementation guide with priorities and next steps
**Includes**:

- Vertical slice strategy explanation
- 5-phase implementation plan (8 weeks)
- Detailed Phase 1 checklist (Week 1-2)
- Tech stack decisions (Tauri + Claude SDK)
- Design system guide (shadcn/ui)
- Next actions checklist

### **2. Architecture Decision**

**File**: `architecture-decision.md` ✅ NEW
**Purpose**: Document why we chose this architecture
**Includes**:

- Tauri vs Electron comparison
- Claude SDK local vs cloud agents
- Modal/Daytona execution strategy
- Git integration rationale
- Trade-off analysis

### **3. Template System Specification**

**File**: `template-system-spec.md` ✅ NEW
**Purpose**: Template-driven architecture details
**Includes**:

- Template structure and format
- 3 core templates (Investors, Product, Operations)
- Configuration schema
- Customization system
- Template marketplace vision

### **4. Git Integration Specification**

**File**: `git-integration-spec.md` ✅ NEW
**Purpose**: Version control and collaboration system
**Includes**:

- File structure and formats
- Auto-commit strategy
- GitHub OAuth and sync
- Collaboration workflows
- Rust Git2 implementation

### **5. Vertical Slice Implementation**

**File**: `vertical-slice-implementation.md` ✅ Updated
**Purpose**: Phase-by-phase breakdown (8 weeks)
**Includes**:

- Phase 1: Context Upload (Week 1-2)
- Phase 2: Chat Interface (Week 3-4)
- Phase 3: Cloud Execution (Week 5-6)
- Phase 4: Results & Visualization (Week 7)
- Phase 5: Iteration & Follow-up (Week 8)
- Demo scripts for each phase

### **6. Data Models Specification**

**File**: `data-models-spec.md` ✅ Updated
**Purpose**: Complete database schemas
**Includes**:

- Convex schema (templates, context, experiments)
- Git file formats (decisions, configs, results)
- TypeScript type definitions
- Relationships and indexes
- Migration strategy

### **7. Enhanced Assistant Specification**

**File**: `enhanced-assistant-spec.md` ✅ Updated
**Purpose**: Claude SDK agent implementation
**Includes**:

- Claude SDK setup and configuration
- Agent tools and capabilities
- 1000+ word system prompt
- Conversation flow patterns
- Testing strategy

### **8. Final Summary**

**File**: `FINAL-SUMMARY.md` ✅ Updated
**Purpose**: Executive summary and metrics
**Includes**:

- What you get after 8 weeks
- Performance improvements
- ROI calculations
- Market opportunity

### **9. Context Pipeline** (Reference - needs update)

**File**: `context-pipeline-implementation.md`
**Status**: Legacy document from Electron version
**Note**: Core concepts still valid, implementation details need Tauri adaptation

### **10. Dataset Extraction** (Reference - needs update)

**File**: `dataset-extraction-spec.md`
**Status**: Legacy document
**Note**: SSR extraction methodology still relevant, will adapt in Phase 4

---

## 🗓️ Implementation Timeline: 8 Weeks

### **PHASE 1: Context Upload (Weeks 1-2)**

**Goal**: User can upload company context and see it in the app

- Context upload UI (CSV, PDF)
- File parsing (Rust)
- Context library view
- Convex storage
- Git auto-commit

**Demo**: Upload customer CSV → See in context library → Auto-committed to Git

---

### **PHASE 2: Chat Interface + Agent (Weeks 3-4)**

**Goal**: Conversational decision-making works end-to-end

- Claude Desktop-style chat UI
- Claude SDK agent integration
- Template library (3 templates)
- Guided configuration flow
- Decision logging

**Demo**: Chat "I need to decide on seed vs bootstrap" → Agent guides through template → Creates decision log

---

### **PHASE 3: Cloud Execution (Weeks 5-6)**

**Goal**: Experiments run in parallel on cloud with real personas

- Persona generation from context
- Modal integration
- Parallel execution (10+ personas)
- Real-time result streaming
- Progress UI

**Demo**: Run investor pitch test → 10 personas respond in parallel → Results stream in 30 seconds

---

### **PHASE 4: Results & Visualization (Week 7)**

**Goal**: Results are easy to understand and actionable

- Results dashboard with charts
- Sentiment analysis
- Key insights extraction
- Export functionality
- GitHub push with summary

**Demo**: View experiment results → See sentiment breakdown → Export report → Committed to Git

---

### **PHASE 5: Iteration & Polish (Week 8)**

**Goal**: Follow-up questions work, collaboration enabled

- Follow-up questions
- Experiment comparison
- Template customization
- GitHub collaboration
- Team sharing

**Demo**: Ask follow-up question → Agent suggests new experiment → Team member reviews on GitHub

---

## 💡 Key Innovations

### 1. Template-Driven Approach

**Problem**: Founders don't know what parameters to configure
**Solution**: Pre-built templates for common decisions

```
Templates:
- Investor Evaluation (seed, series A, angels)
- Pricing Strategy (SaaS, usage-based, tiered)
- Product Roadmap (features, prioritization)
- Hiring Decisions (eng, sales, leadership)
- Operations (processes, tools, outsourcing)
```

Each template encodes expert knowledge about:

- What questions to ask
- What context is relevant
- What personas to use
- How to analyze results

### 2. Git-Based Collaboration

**Problem**: Decisions live in scattered docs, hard to collaborate
**Solution**: Every decision is a Git commit

**Benefits**:

- Full history of all decisions
- Team collaboration via GitHub
- Share with advisors (read-only)
- Branch for scenarios
- Export-friendly (flat files)

### 3. Local + Cloud Hybrid

**Problem**: Need responsive UI + powerful execution
**Solution**: Local agent for chat, cloud for experiments

**Benefits**:

- Instant chat responses (local Claude SDK)
- Fast parallel execution (cloud Modal)
- Offline chat capability
- Scalable to 50+ personas

### 4. Context-Grounded Personas

**Problem**: Synthetic personas feel fake
**Solution**: Generate from real company data

**Before**: "Generic tech executive persona"
**After**: "Based on your customer data: 5 CTOs at Series B SaaS companies, $2M ARR, 10-50 employees"

---

## 🎁 What You Get After 8 Weeks

### Fully Functional Platform

- ✅ Upload context (CSV, PDF, docs)
- ✅ Chat interface for decision-making
- ✅ 3 core templates (Investors, Product, Operations)
- ✅ Cloud execution with 10+ personas
- ✅ Results visualization
- ✅ Git versioning + GitHub sync
- ✅ Team collaboration
- ✅ Export & sharing

### Performance Metrics

| Metric                 | Traditional Approach | Unheard V2   | Improvement |
| ---------------------- | -------------------- | ------------ | ----------- |
| Time to first insight  | 40 minutes           | 2 minutes    | **20x**     |
| Configuration time     | 30 minutes (manual)  | 2 min (chat) | **15x**     |
| Experiment execution   | 10 min (sequential)  | 30 sec       | **20x**     |
| Persona quality        | Made-up (unreliable) | Real data    | **∞**       |
| Collaboration overhead | Email, docs          | Git/GitHub   | **10x**     |

---

## 🚀 Getting Started

### Immediate Next Steps

1. **Review Documents** (1 hour)
   - Read `IMPLEMENTATION-PRIORITY.md`
   - Read `architecture-decision.md`
   - Review `template-system-spec.md`

2. **Validate Current Setup** (30 min)
   - Confirm Tauri + Convex working (we just set this up!)
   - Test Claude API key
   - Sign up for Modal account

3. **Week 1 Kickoff** (Day 1)
   - Follow Phase 1 checklist
   - Implement context upload UI
   - Set up Git integration (Rust)

### Key Decisions Made

✅ **Framework**: Tauri (Rust + React)
✅ **Local Agent**: Claude Agent SDK
✅ **Cloud Execution**: Modal + Daytona
✅ **Versioning**: Git + GitHub
✅ **UI Style**: Claude Desktop inspired
✅ **Timeline**: 8 weeks to MVP

---

## 📊 Success Criteria

### Phase 1 Complete When:

- [ ] User can upload CSV/PDF
- [ ] Context displays in library
- [ ] Files stored in Convex
- [ ] Auto-committed to Git

### Phase 2 Complete When:

- [ ] Chat interface works
- [ ] Agent understands decision intent
- [ ] Template selection works
- [ ] Decision log created

### Phase 3 Complete When:

- [ ] Personas generated from context
- [ ] Experiments run on Modal
- [ ] 10+ personas execute in parallel
- [ ] Results stream in real-time

### Phase 4 Complete When:

- [ ] Results visualized clearly
- [ ] Sentiment analysis works
- [ ] Insights extracted
- [ ] Export to PDF/GitHub

### Phase 5 Complete When:

- [ ] Follow-up questions work
- [ ] Team collaboration via GitHub
- [ ] Template customization
- [ ] Polish complete

---

## 🎉 You're Ready!

**Planning**: COMPLETE ✅
**Architecture**: COMPLETE ✅
**Priorities**: COMPLETE ✅
**Tech Stack**: COMPLETE ✅
**Foundation**: COMPLETE ✅ (Tauri + Convex already set up!)

**Next Action**: Start Phase 1 (Context Upload)

Read `IMPLEMENTATION-PRIORITY.md` for the detailed Week 1-2 checklist.

---

## 💬 Questions?

- Architecture unclear? → Read `architecture-decision.md`
- Templates unclear? → Read `template-system-spec.md`
- Git unclear? → Read `git-integration-spec.md`
- Implementation unclear? → Read `vertical-slice-implementation.md`

**Let's build! 🚀**
