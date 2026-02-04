# Context Management System - Addendum to UX-First Plan

**Date**: 2026-01-29
**Version**: 1.0
**Purpose**: Add Context Management System to main architecture

---

## Context System Overview

### The Missing Piece: Grounded Personas

**Problem**: Current plan assumes manually-created personas, which are synthetic and disconnected from reality.

**Solution**: Context Management System that ingests real customer data, strategy docs, and business intelligence to generate realistic, grounded personas.

### Value Proposition

**Before (No Context)**:

- User creates fake personas: "John, 35, CTO"
- Experiments test hypotheses in a vacuum
- Results are purely synthetic
- No validation against reality

**After (With Context)**:

- User uploads Attio CRM data (500 contacts)
- System generates 20 realistic personas from real customers
- Experiments grounded in actual customer behavior
- Results validated against real feedback

---

## 1. System Architecture

### 1.1 Five-Layer Pipeline

```
┌─────────────────────────────────────────────────────┐
│         LAYER 1: DATA SOURCES                       │
│  Files, CRMs, Analytics, Support Tickets, Surveys  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│         LAYER 2: INGESTION                          │
│  File parsers (PDF, Excel, CSV, Word, Text)        │
│  CRM connectors (Attio, Salesforce, HubSpot)       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│         LAYER 3: PROCESSING                         │
│  Chunking (1000 tokens, 200 overlap)               │
│  Embedding (OpenAI text-embedding-3-small)          │
│  Entity extraction (people, companies, insights)    │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│         LAYER 4: STORAGE                            │
│  Pinecone (vector search)                           │
│  Convex (document metadata)                         │
│  SQLite (local cache)                               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│         LAYER 5: CONTEXT LAYER                      │
│  RAG queries                                        │
│  Persona generation from real data                  │
│  Insight extraction & validation                    │
└─────────────────────────────────────────────────────┘
```

### 1.2 Supported Data Sources (V1)

| Source Type      | Priority | Examples                   | What It Provides                       |
| ---------------- | -------- | -------------------------- | -------------------------------------- |
| **Documents**    | HIGH     | PDF, Word, Markdown        | Strategy docs, research, meeting notes |
| **Spreadsheets** | HIGH     | Excel, CSV                 | Customer lists, survey data, metrics   |
| **CRM**          | HIGH     | Attio, Salesforce, HubSpot | Contact data, deal history, notes      |
| **Support**      | MEDIUM   | Intercom, Zendesk          | Tickets, conversations, feedback       |
| **Surveys**      | MEDIUM   | Typeform, Google Forms     | Response data, NPS scores              |

### 1.3 Updated Directory Structure

```
src/
├── context/                      # NEW: Context Management System
│   ├── manager.ts                # Main orchestrator
│   ├── types.ts                  # TypeScript types
│   │
│   ├── upload/
│   │   ├── file-handler.ts       # File upload handling
│   │   ├── validators.ts         # File validation
│   │   └── storage.ts            # Temp storage
│   │
│   ├── parsers/
│   │   ├── pdf-parser.ts         # PDF extraction
│   │   ├── excel-parser.ts       # Excel/XLSX parsing
│   │   ├── csv-parser.ts         # CSV parsing
│   │   ├── docx-parser.ts        # Word documents
│   │   └── parser-factory.ts     # Factory pattern
│   │
│   ├── processing/
│   │   ├── chunker.ts            # Text chunking
│   │   ├── embedder.ts           # Generate embeddings
│   │   └── entity-extractor.ts   # Extract entities
│   │
│   ├── storage/
│   │   ├── vector-store.ts       # Pinecone wrapper
│   │   ├── document-store.ts     # Convex wrapper
│   │   └── local-cache.ts        # SQLite cache
│   │
│   ├── connectors/
│   │   ├── base-connector.ts     # Connector interface
│   │   ├── attio-connector.ts    # Attio CRM (PRIORITY)
│   │   ├── salesforce-connector.ts
│   │   └── hubspot-connector.ts
│   │
│   ├── search/
│   │   ├── searcher.ts           # Semantic search
│   │   └── result-ranker.ts      # Re-rank results
│   │
│   └── generation/
│       ├── persona-generator.ts   # Generate personas from context
│       └── insight-extractor.ts   # Extract insights
```

---

## 2. Updated Intelligence Layer (with Context)

### 2.1 Enhanced Flow

```
User describes goal
    ↓
[NEW] Intelligence Layer searches user's context
    ↓
AI Assistant:
  - Finds relevant strategy docs
  - Identifies customer data
  - Grounds suggestions in real data
    ↓
Config generated with context-aware personas
    ↓
Experiment executes
    ↓
[NEW] Results compared to real customer feedback
    ↓
Insights with confidence scores
```

### 2.2 Context-Aware Conversation Example

```
User: "Test our new $99/mo pricing"

[System searches context in background]

AI: "I found relevant context:

📄 From 'Q4_Strategy.pdf':
   'Premium tier targeting enterprise, $99/mo with managed services'

📊 From Attio CRM:
   You have 127 enterprise customers (avg deal: $15k/year)

💬 From 'Support_Tickets.csv':
   23 requests for 'managed services' and 'white-glove support'

Based on this, I suggest:
**Enterprise Premium Tier Validation**
- Using your real enterprise customers as personas
- Testing $99/mo with managed services
- Comparing to current $49/mo self-service

The personas already know your product from support data.

[Run Experiment]"
```

---

## 3. Data Models (Additions to Convex Schema)

### 3.1 New Context Tables

```typescript
// convex/schema.ts - ADD THESE TABLES

contextDocuments: defineTable({
  userId: v.id("users"),
  name: v.string(),
  type: v.union(
    v.literal("strategy"),
    v.literal("research"),
    v.literal("customer_data"),
    v.literal("feedback"),
    v.literal("competitor"),
    v.literal("other")
  ),

  // File info
  fileUrl: v.optional(v.string()),
  fileType: v.string(),           // pdf, xlsx, csv, etc.
  fileSize: v.number(),

  // Processed content
  content: v.string(),            // Full text
  summary: v.optional(v.string()), // AI-generated summary

  // Chunks (references to Pinecone)
  chunks: v.array(v.object({
    id: v.string(),
    content: v.string(),
    embeddingId: v.string(),     // Pinecone ID
  })),

  // Extracted entities
  entities: v.optional(v.any()),  // People, companies, insights

  // Metadata
  metadata: v.any(),
  tags: v.array(v.string()),
  workspaceId: v.optional(v.id("workspaces")),

  // Status
  status: v.union(
    v.literal("uploading"),
    v.literal("processing"),
    v.literal("indexed"),
    v.literal("failed")
  ),
  processingError: v.optional(v.string()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_type", ["type"])
.index("by_status", ["status"]),

contextConnections: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("attio"),
    v.literal("salesforce"),
    v.literal("hubspot"),
    v.literal("intercom"),
    v.literal("zendesk")
  ),

  // Connection details
  credentials: v.any(),           // Encrypted
  config: v.any(),                // Filters, mappings

  // Sync status
  lastSyncAt: v.optional(v.number()),
  syncFrequency: v.string(),      // "hourly", "daily", "manual"
  autoSync: v.boolean(),

  // Stats
  totalRecords: v.number(),
  lastSyncRecords: v.number(),

  status: v.union(
    v.literal("connected"),
    v.literal("syncing"),
    v.literal("error"),
    v.literal("disconnected")
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_type", ["type"]),

contextPersonas: defineTable({
  userId: v.id("users"),
  personaId: v.id("personas"),

  // Source data
  sourceType: v.union(
    v.literal("document"),
    v.literal("crm"),
    v.literal("generated"),
    v.literal("manual")
  ),
  sourceId: v.optional(v.string()),

  // What context was used
  contextDocuments: v.array(v.id("contextDocuments")),
  contextSnippets: v.array(v.string()),  // Attribution

  createdAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_persona", ["personaId"])
.index("by_source", ["sourceType"]),
```

### 3.2 Updated Personas Table

```typescript
// ADD to existing personas table

personas: defineTable({
  // ... existing fields

  // NEW: Source attribution
  source: v.union(
    v.literal('manual'),
    v.literal('crm'),
    v.literal('document'),
    v.literal('generated')
  ),
  sourceId: v.optional(v.string()),

  // NEW: Real data grounding
  realDataSnippets: v.optional(v.array(v.string())),
  realQuote: v.optional(v.string()),

  // ... rest of existing fields
})
```

---

## 4. User Experience Flows

### 4.1 Onboarding with Context

```
App: "Welcome! Let's start with your real customer data.

Choose one:

1. 📊 Upload customer data (CSV, Excel)
   → I'll generate realistic personas

2. 🔌 Connect Attio CRM
   → I'll sync contacts automatically

3. 📄 Upload strategy docs (PDF)
   → I'll align experiments with your goals

4. ⏭️  Skip (use example personas)"

User: Connects Attio

App: [OAuth flow]

App: "✓ Connected to Attio!

Found 347 contacts. I can create:
- 20 diverse personas covering all segments
- Focus groups by: Company Size, Industry, Deal Size

[Create Personas]"

User: Creates personas

App: "✓ Created 20 personas from your real customers!

Organized into 4 focus groups:
- Enterprise (8 personas)
- Mid-Market (7 personas)
- Startups (3 personas)
- Technical Evaluators (2 personas)

Ready! What do you want to learn?"
```

### 4.2 Context-Aware Experiment Design

```
User: "Test pricing"

[System searches: strategy docs + CRM data + feedback]

AI: "I see from your context:

📄 Q4_Strategy.pdf: '$99 premium tier targeting enterprise'
📊 Attio CRM: 127 enterprise customers
💬 Support tickets: 23 requests for managed services

I'll test: **$99/mo Premium vs $49/mo Self-Service**

Using your real enterprise customer personas who already know your product.

Estimated: 10 seconds, $0

[Run]"
```

### 4.3 Results with Real Data Validation

```
[Experiment completes]

App: "✅ Results:

**Experiment**: 75% positive toward $99/mo

**Compared to Real Data**:
✓ Matches: 23 support tickets requesting managed services
✓ Confirms: Enterprise segment is price-insensitive for value
⚠️ New: Personas want 24/7 support (not in tickets yet)

**Confidence: 85%** - Results align with real customer behavior

What's next?
- Test 24/7 support add-on
- Reach out to top 20 enterprise customers
"
```

---

## 5. Implementation Updates

### 5.1 Updated Phase 1 (Weeks 1-2): Foundation + Context

**OLD**: Foundation + Template System
**NEW**: Foundation + Template System + **Basic Context Upload**

**New Tasks**:

1. File upload UI component
2. Basic PDF/CSV/Excel parsers
3. Store in Convex
4. Generate personas from CSV

**Deliverable**: User can upload customer CSV → generate 10 personas

### 5.2 New Phase 1.5 (Weeks 2.5-3): Attio Integration

**Goals**: Connect Attio CRM, sync contacts, generate personas

**Tasks**:

1. Implement Attio connector (OAuth + sync)
2. IPC handlers for CRM connection
3. UI flow for Attio authentication
4. Map Attio contacts → personas
5. Test end-to-end: Connect Attio → Sync → Generate personas

**Deliverable**: User connects Attio → 20 personas generated automatically

### 5.3 Updated Phase 2 (Weeks 4-5): Enhanced Assistant + Context

**OLD**: Enhanced Assistant only
**NEW**: Enhanced Assistant + **Context Search Tools**

**New Tasks**:

1. Implement vector storage (Pinecone)
2. Add context search tool to assistant
3. Ground responses in user's uploaded data
4. Show source attribution

**Deliverable**: Assistant uses uploaded docs to inform experiments

### 5.4 New Phase 6.5 (Week 9.5): Advanced Context Features

**Goals**: Full context pipeline with validation

**Tasks**:

1. Complete document chunking + embedding
2. Entity extraction
3. Compare experiment results to real feedback
4. Confidence scoring
5. Advanced persona generation with attribution

**Deliverable**: Results validated against real customer data

---

## 6. Updated Success Criteria

### 6.1 Context System Metrics

**Functional**:

- [ ] User can upload PDF/Excel/CSV documents
- [ ] User can connect Attio CRM
- [ ] Personas generated from real customer data (not manual)
- [ ] AI Assistant searches user's context
- [ ] Experiment results compared to real feedback
- [ ] Source attribution visible (which doc informed this persona)

**Quality**:

- [ ] > 80% of users upload context within first session
- [ ] > 70% of personas generated from real data (not manual)
- [ ] Context search returns relevant results (>0.7 similarity score)
- [ ] Confidence scores accurate (±10% of actual alignment)

**Performance**:

- [ ] File upload + processing < 1 minute for 10MB file
- [ ] Attio sync < 30 seconds for 100 contacts
- [ ] Context search < 2 seconds
- [ ] Persona generation from 100 contacts < 10 seconds

---

## 7. Technical Dependencies

### 7.1 New Dependencies

```json
{
  "dependencies": {
    // File parsing
    "pdf-parse": "^1.1.1",
    "xlsx": "^0.18.5",
    "csv-parse": "^5.5.0",
    "mammoth": "^1.6.0",

    // Embeddings & Vector Search
    "@pinecone-database/pinecone": "^1.1.0",
    "tiktoken": "^1.0.10",

    // CRM Connectors
    "axios": "^1.6.0",

    // Utilities
    "crypto": "built-in",
    "fs/promises": "built-in"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.1"
  }
}
```

### 7.2 External Services

| Service      | Purpose                 | Cost (V1)                         | Required?     |
| ------------ | ----------------------- | --------------------------------- | ------------- |
| **Pinecone** | Vector storage & search | Free (100k vectors)               | Yes           |
| **OpenAI**   | Text embeddings         | $0.02/1M tokens (~$0.20/100 docs) | Yes           |
| **Attio**    | CRM integration         | Free (personal use)               | No (optional) |

### 7.3 Environment Variables

```bash
# NEW: Context System

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=unheard-context

# OpenAI (for embeddings)
OPENAI_API_KEY=...  # Already have this

# Attio CRM
ATTIO_CLIENT_ID=...
ATTIO_CLIENT_SECRET=...
ATTIO_WEBHOOK_SECRET=...
```

---

## 8. Cost Analysis

### 8.1 Context System Costs (per user/month)

**Storage**:

- Pinecone free tier: 100k vectors (≈100 documents)
- Convex: Covered by existing plan
- Local SQLite: Free

**Processing**:

- Embeddings: $0.02/1M tokens
  - 100 documents × 5k tokens avg = 500k tokens
  - Cost: $0.01 one-time
- Ongoing: ~$0.10/month for incremental docs

**CRM Sync**:

- Attio: Free API usage
- Network: Negligible

**Total**: ~$0.10-0.20/user/month (mostly one-time setup)

### 8.2 Value Justification

**Without context**: User creates 10 fake personas manually = 30 minutes
**With context**: Upload CSV → 10 realistic personas in 30 seconds = **60x faster**

**ROI**: $0.20/month for 60x faster persona creation = **massive win**

---

## 9. Security & Privacy

### 9.1 Data Handling

**Uploads**:

- Files stored temporarily in OS temp dir
- Processed and deleted after indexing
- Never sent to external services (except embeddings API)

**CRM Credentials**:

- Encrypted at rest in Convex
- Access tokens refreshed automatically
- User can revoke anytime

**Embeddings**:

- Sent to OpenAI for embedding generation
- Not used for model training (per OpenAI policy)
- User can opt for local embeddings (future)

### 9.2 User Control

**Transparency**:

- User sees which docs were used for each persona
- Attribution shown: "Based on Q4_Strategy.pdf, page 3"
- User can delete any context anytime

**Privacy Options**:

- Exclude sensitive fields from CRM sync
- Don't upload certain document types
- Use local embeddings (future)

---

## 10. Migration from Current Plan

### 10.1 What Changes

**Updated Phases**:

- Phase 1: +Basic Context Upload
- Phase 1.5: +Attio Integration (NEW)
- Phase 2: +Context Search Tools
- Phase 6.5: +Advanced Context Features (NEW)

**Updated Components**:

- Enhanced Assistant: +Context search tools
- Persona Manager: +Generate from context
- UI: +Context Library, +CRM connection flow

**Added Dependencies**:

- Pinecone, pdf-parse, xlsx, csv-parse, mammoth

### 10.2 Timeline Impact

**Original**: 12 weeks
**Updated**: 13 weeks (added Attio integration + advanced context)

Still faster than original 14-week Tauri plan.

---

## Summary

The Context Management System transforms Unheard from a "synthetic experiment tool" to a "grounded research platform" by:

1. **Real Customer Data**: Personas generated from actual CRM contacts
2. **Strategy Alignment**: AI knows user's business goals from uploaded docs
3. **Validated Insights**: Results compared to real customer feedback
4. **Source Attribution**: Every persona/insight linked to source data
5. **Fast Setup**: 30 seconds to generate 20 personas (was: 30 minutes manual)

**Key Integrations**:

- Attio CRM (priority connector)
- Pinecone (vector search)
- OpenAI (embeddings)

**Implementation Priority**:

- Week 1-2: Basic file upload + CSV parsing
- Week 2.5-3: Attio connector + persona generation
- Week 4-5: Context-aware AI Assistant
- Week 9.5: Advanced validation & confidence scoring

**Result**: Users go from manual persona creation to automated, realistic personas grounded in their actual customer data.

This is the **missing foundation** that makes all experiments meaningful and actionable.
