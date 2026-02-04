# Vertical Slice Implementation Plan

## Phase-by-Phase Delivery Strategy

**Date**: 2026-02-04
**Version**: 2.0 (Updated for Tauri + Claude SDK + Modal)
**Strategy**: Deliver complete, working features incrementally

---

## Philosophy: Vertical Slices Over Horizontal Layers

### **Traditional Approach** (Horizontal Layers - DON'T DO THIS)

```
Month 1: Build all databases
Month 2: Build all backend logic
Month 3: Build all frontend UI
→ Nothing works until month 3!
```

### **Our Approach** (Vertical Slices - DO THIS)

```
Week 2: Context upload works end-to-end ✓
Week 4: Chat interface works end-to-end ✓
Week 6: Cloud execution works end-to-end ✓
→ Always have working software!
```

**Benefits**:

- Demo progress every 2 weeks
- Get user feedback early
- Can ship anytime (not locked into full timeline)
- Reduces risk (find issues early)

---

## Complete Implementation Plan: 8 Weeks to Production

### **PHASE 1: Context Upload (Weeks 1-2)** ⭐ START HERE

#### **Goal**

User can upload company context (CSV, PDF) and see it stored in the app, ready for use by the agent.

#### **Scope**

- Tauri file dialog integration
- CSV/PDF parsing (Rust)
- Context library UI (React)
- Convex storage
- Git auto-commit

#### **Features Included**

**1. File Upload System**

```rust
// Tauri command for file upload
#[tauri::command]
async fn upload_context_file(path: String) -> Result<ContextDocument, String> {
    // Parse file based on extension
    let content = match path.extension() {
        "csv" => parse_csv(&path)?,
        "pdf" => parse_pdf(&path)?,
        _ => return Err("Unsupported file type".into()),
    };

    // Store in Convex
    let doc = ContextDocument {
        filename: path.file_name(),
        content_type: detect_type(&content),
        rows: content.rows.len(),
        created_at: now(),
    };

    // Auto-commit to Git
    git_commit(&format!("Add context: {}", doc.filename))?;

    Ok(doc)
}
```

**2. Rust Parsers**

```rust
// CSV parser with schema detection
struct CsvParser;
impl CsvParser {
    fn parse(&self, path: &Path) -> Result<ParsedContent> {
        let mut reader = csv::Reader::from_path(path)?;
        let headers = reader.headers()?.clone();

        // Detect schema
        let schema = self.detect_schema(&headers);

        // Parse rows
        let rows: Vec<Record> = reader.deserialize().collect()?;

        Ok(ParsedContent {
            schema,
            rows,
            detected_type: self.infer_type(&schema, &rows),
        })
    }

    fn detect_schema(&self, headers: &Headers) -> Schema {
        // Analyze column names and infer types
        // e.g., "email" -> Email, "company" -> Company
    }

    fn infer_type(&self, schema: &Schema, rows: &[Record]) -> ContextType {
        // Customer data, investor data, product data, etc.
    }
}
```

**3. UI Components**

```tsx
// Context library page
function ContextLibrary() {
  const { data: contextDocs } = useContextDocuments()

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Context Library</h1>
        <Button onClick={() => openFileDialog()}>
          <Upload className="mr-2" />
          Upload Context
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {contextDocs?.map(doc => (
          <ContextCard key={doc._id} doc={doc} />
        ))}
      </div>
    </div>
  )
}

// Context card component
function ContextCard({ doc }: { doc: ContextDocument }) {
  return (
    <Card>
      <CardHeader>
        <FileIcon type={doc.content_type} />
        <CardTitle>{doc.filename}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {doc.rows} rows • {doc.detected_type}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Uploaded {formatDate(doc.created_at)}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm">
          View
        </Button>
        <Button variant="ghost" size="sm">
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
```

**4. Convex Schema**

```typescript
// convex/schema.ts
contextDocuments: defineTable({
  userId: v.id('users'),
  filename: v.string(),
  contentType: v.union(
    v.literal('customer_data'),
    v.literal('investor_data'),
    v.literal('product_data'),
    v.literal('general')
  ),
  schema: v.any(), // Column names and types
  rows: v.number(),
  rawData: v.optional(v.any()), // Store data if small
  storagePath: v.optional(v.string()), // For large files

  createdAt: v.number(),
}).index('by_user', ['userId'])
```

**5. Git Integration**

```rust
// src-tauri/src/git.rs
use git2::{Repository, Signature};

pub fn auto_commit(repo_path: &Path, message: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut index = repo.index()?;

    // Add all changes
    index.add_all(["context/*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    // Create commit
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let parent_commit = repo.head()?.peel_to_commit()?;

    let signature = Signature::now("Unheard", "app@unheard.ai")?;
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &[&parent_commit],
    )?;

    Ok(())
}
```

#### **Demo Script**

```
1. User opens app → Sees Context Library (empty)
2. Clicks "Upload Context"
3. Selects "B2B_Customers.csv" (500 rows)
4. File uploads → Progress indicator
5. Parser detects: "Customer data (500 rows, 5 columns)"
6. Card appears in library:
   - Filename: B2B_Customers.csv
   - Type: Customer data
   - 500 rows
   - Uploaded: 2 minutes ago
7. Git commit created: "Add context: B2B_Customers.csv"
8. User clicks "View" → Sees table preview
```

**User can upload and view context! ✅**

#### **Implementation Checklist**

**Week 1**:

- [ ] Tauri file dialog command
- [ ] CSV parser (Rust)
- [ ] PDF parser (Rust)
- [ ] Schema detection logic
- [ ] Convex `contextDocuments` table
- [ ] Basic UI (upload button + empty state)

**Week 2**:

- [ ] Context library UI (grid of cards)
- [ ] Context card component
- [ ] Table preview dialog
- [ ] Git integration (auto-commit)
- [ ] Delete functionality
- [ ] E2E test: Upload → View → Git commit

**Deliverable**: Working context upload ✓

---

### **PHASE 2: Chat Interface + Agent (Weeks 3-4)**

#### **Goal**

User can have a conversation with the agent about a decision, and the agent guides them to select and customize a template, resulting in a decision log.

#### **What Gets Added to Phase 1**

**1. Claude SDK Integration**

```typescript
// src/lib/claude-agent.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
})

export async function chat(message: string, history: Message[]) {
  const systemPrompt = await loadSystemPrompt()
  const contextDocs = await loadContextDocuments()

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      ...history.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
    tools: [
      searchTemplateLibrary,
      getContextDocuments,
      generateDecisionLog,
      estimateExperimentCost,
    ],
  })

  return response
}
```

**2. System Prompt** (1000+ words)

```typescript
// src/lib/system-prompt.ts
export const SYSTEM_PROMPT = `
You are an AI assistant for Unheard, a decision support platform for founders.

Your role is to:
1. Understand the founder's decision context
2. Recommend the best template for their situation
3. Guide them through customization
4. Generate a decision log
5. Help them run experiments and interpret results

Available Templates:
- Investor Evaluation (seed, series A, angels)
- Pricing Strategy (SaaS, usage-based, tiered)
- Product Roadmap (features, prioritization)

When a founder describes a decision:
1. Ask clarifying questions to understand:
   - What decision are they trying to make?
   - What options are they considering?
   - What context is relevant (customers, metrics, market)?
   - What's the timeline?

2. Search template library for relevant templates
3. Recommend 1-2 best fits with explanation
4. Guide them through template customization
5. Preview the experiment configuration
6. Create decision log when ready

Always be:
- Concise (2-3 sentences per response)
- Founder-focused (solve their problem, don't show off)
- Data-grounded (use their context documents)
- Actionable (always suggest next step)

Available Context:
{{CONTEXT_DOCUMENTS}}
`
```

**3. Chat UI Components**

```tsx
// Chat interface (Claude Desktop style)
function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const handleSend = async () => {
    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    const response = await chat(input, messages)

    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: response.content[0].text,
      },
    ])
    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Context sidebar */}
      <ContextSidebar />

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe your decision..."
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  )
}
```

**4. Template System**

```typescript
// Template library (3 core templates)
const TEMPLATES = [
  {
    id: 'investor-evaluation',
    name: 'Investor Evaluation',
    category: 'investors',
    description: 'Evaluate which investors to approach',
    variables: [
      {
        key: 'stage',
        label: 'Funding stage',
        type: 'select',
        options: ['pre-seed', 'seed', 'series-a'],
      },
      { key: 'target', label: 'Funding target ($)', type: 'number' },
      { key: 'vertical', label: 'Industry vertical', type: 'text' },
    ],
    config: {
      // Full experiment configuration
    },
  },
  {
    id: 'pricing-strategy',
    name: 'Pricing Strategy',
    category: 'product',
    description: 'Test different pricing models',
    variables: [
      { key: 'product', label: 'Product name', type: 'text' },
      { key: 'pricePoint', label: 'Price point ($)', type: 'number' },
      {
        key: 'model',
        label: 'Pricing model',
        type: 'select',
        options: ['saas', 'usage-based', 'tiered'],
      },
    ],
    config: {
      // Full experiment configuration
    },
  },
  {
    id: 'product-roadmap',
    name: 'Product Roadmap',
    category: 'product',
    description: 'Prioritize features and roadmap',
    variables: [
      { key: 'features', label: 'Features to evaluate', type: 'textarea' },
      { key: 'customers', label: 'Customer segment', type: 'text' },
    ],
    config: {
      // Full experiment configuration
    },
  },
]
```

**5. Decision Log**

```markdown
# Decision: Seed vs Bootstrap Funding

**Date**: 2026-02-04
**Status**: Evaluating
**Decision Type**: Investor Evaluation

## Context

We're a B2B SaaS company with:

- $50K MRR
- 30 paying customers
- 2 co-founders
- 12 months runway

## Options

1. **Seed Funding** ($2M)
   - Pros: Accelerate growth, hire team
   - Cons: Dilution, investor pressure

2. **Bootstrap**
   - Pros: Control, profitability focus
   - Cons: Slower growth, resource constraints

## Experiment Configuration

Template: Investor Evaluation
Personas: 10 (5 VCs, 3 angels, 2 advisors)
Context: B2B_Customers.csv, metrics.pdf

## Results

(To be filled after experiment runs)

## Decision

(To be made after analyzing results)
```

#### **Demo Script**

```
1. User opens app → Sees chat interface
2. User types: "I need to decide whether to raise seed funding or bootstrap"
3. Agent responds (3 seconds):
   "Let me help you evaluate that. I found the Investor Evaluation template.

   To customize it, I need:
   - What's your funding target?
   - What stage are you at?"

4. User: "$2M, we're at $50K MRR with 30 customers"
5. Agent: "Perfect. I'll set up an experiment with:
   - 10 personas (5 VCs, 3 angels, 2 advisors)
   - Based on your customer data (B2B_Customers.csv)
   - Estimated cost: $0.50, runtime: 30 seconds

   [Preview Config] [Run Experiment]"

6. User clicks "Run Experiment"
7. Decision log created and committed to Git
8. Experiment starts (Phase 3!)
```

**User can chat and configure experiments! ✅**

#### **Implementation Checklist**

**Week 3**:

- [ ] Claude SDK integration
- [ ] System prompt (1000+ words)
- [ ] Chat UI (Claude Desktop style)
- [ ] Message streaming
- [ ] Context sidebar (shows uploaded docs)
- [ ] Template library (3 templates)

**Week 4**:

- [ ] Template search tool
- [ ] Template customization UI
- [ ] Decision log generation
- [ ] Decision log storage (Git)
- [ ] Conversation history (Convex)
- [ ] E2E test: Chat → Template → Decision log

**Deliverable**: Conversational experiment design ✓

---

### **PHASE 3: Cloud Execution (Weeks 5-6)**

#### **Goal**

Experiments run on Modal with 10+ personas in parallel, results stream back in real-time.

#### **What Gets Added to Phases 1-2**

**1. Persona Generation**

```python
# modal/persona_generator.py
import modal
from anthropic import Anthropic

app = modal.App("unheard-personas")
image = modal.Image.debian_slim().pip_install("anthropic")

@app.function(image=image)
def generate_personas(context_data: dict, count: int = 10) -> list[dict]:
    """Generate realistic personas from company context"""
    client = Anthropic(api_key=modal.Secret.from_name("anthropic-key"))

    prompt = f"""
    Based on this company data:
    {context_data}

    Generate {count} diverse, realistic personas for evaluating decisions.
    Each persona should have:
    - Name, age, role
    - Company context
    - Beliefs and preferences
    - Decision-making style
    """

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )

    personas = parse_personas(response.content[0].text)
    return personas
```

**2. Parallel Execution**

```python
# modal/experiment_runner.py
@app.function(
    image=image,
    concurrency_limit=50,  # Run 50 personas in parallel
    timeout=300
)
async def execute_persona_response(
    persona: dict,
    stimulus: str,
    experiment_id: str
) -> dict:
    """Execute a single persona's response"""
    client = Anthropic(api_key=modal.Secret.from_name("anthropic-key"))

    system_prompt = f"""
    You are {persona['name']}, a {persona['role']} at {persona['company']}.

    Background:
    {persona['background']}

    Beliefs:
    {persona['beliefs']}

    Respond to the following scenario as this persona would.
    """

    response = client.messages.create(
        model="claude-3-5-haiku-20241022",  # Fast model
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": stimulus}]
    )

    # Extract sentiment
    sentiment = analyze_sentiment(response.content[0].text)

    return {
        "persona_id": persona["id"],
        "response": response.content[0].text,
        "sentiment": sentiment,
        "timestamp": time.time(),
    }

@app.function()
async def run_experiment(
    experiment_id: str,
    personas: list[dict],
    stimulus: str
) -> list[dict]:
    """Run experiment with all personas in parallel"""
    # Spawn all persona responses concurrently
    results = await asyncio.gather(*[
        execute_persona_response.remote(persona, stimulus, experiment_id)
        for persona in personas
    ])

    return results
```

**3. Tauri Integration**

```rust
// Call Modal from Tauri
#[tauri::command]
async fn run_experiment(
    experiment_id: String,
    config: ExperimentConfig,
) -> Result<ExperimentResults, String> {
    // Generate personas
    let personas = generate_personas_modal(&config.context).await?;

    // Run experiment on Modal
    let results = run_experiment_modal(
        &experiment_id,
        &personas,
        &config.stimulus,
    ).await?;

    // Stream results back to frontend
    for result in results {
        emit_event("experiment:result", &result)?;
    }

    Ok(ExperimentResults {
        experiment_id,
        persona_responses: results,
        completed_at: now(),
    })
}
```

**4. Real-time UI**

```tsx
// Progress UI with real-time updates
function ExperimentProgress({ experimentId }: { experimentId: string }) {
  const [progress, setProgress] = useState({ completed: 0, total: 10 })
  const [results, setResults] = useState<PersonaResult[]>([])

  useEffect(() => {
    // Listen for real-time results
    const unlisten = listen('experiment:result', event => {
      const result = event.payload as PersonaResult
      setResults(prev => [...prev, result])
      setProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
    })

    return () => {
      unlisten()
    }
  }, [experimentId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experiment Running</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={(progress.completed / progress.total) * 100} />
        <p className="text-sm text-muted-foreground mt-2">
          {progress.completed} / {progress.total} personas responded
        </p>

        <div className="mt-4 space-y-2">
          {results.map(result => (
            <div key={result.persona_id} className="flex items-center gap-2">
              <SentimentIcon sentiment={result.sentiment} />
              <span className="text-sm">{result.persona_name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### **Demo Script**

```
1. User clicks "Run Experiment" (from Phase 2)
2. Progress modal appears:
   "Generating personas from your customer data..."
3. After 5 seconds: "10 personas generated"
4. "Running experiment..." (progress bar)
5. Results stream in real-time:
   - Sarah (CTO) 😊 Positive (0.8)
   - Mike (VP Eng) 😐 Neutral (0.5)
   - ... (8 more in parallel)
6. After 30 seconds: "Experiment complete!"
7. Results dashboard appears (Phase 4)
```

**User can run parallel cloud experiments! ✅**

#### **Implementation Checklist**

**Week 5**:

- [ ] Modal account setup
- [ ] Persona generator (Python + Modal)
- [ ] Experiment runner (async parallel execution)
- [ ] Modal API integration (Rust/TypeScript)
- [ ] Real-time event system (Tauri events)

**Week 6**:

- [ ] Progress UI (real-time updates)
- [ ] Error handling and retries
- [ ] Cost tracking
- [ ] Experiment history (Convex)
- [ ] E2E test: Run experiment → Stream results → Complete

**Deliverable**: Fast parallel cloud execution ✓

---

### **PHASE 4: Results & Visualization (Week 7)**

#### **Goal**

Results are displayed with charts, sentiment analysis, key insights, and export options.

#### **What Gets Added to Phases 1-3**

**1. Results Dashboard**

```tsx
function ResultsDashboard({ experimentId }: { experimentId: string }) {
  const { data: experiment } = useExperiment(experimentId)
  const { data: results } = useExperimentResults(experimentId)

  const sentimentBreakdown = useMemo(
    () => calculateSentimentDistribution(results),
    [results]
  )

  const insights = useMemo(() => extractInsights(results), [results])

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">{experiment.name}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF}>
            Export PDF
          </Button>
          <Button onClick={pushToGitHub}>Push to GitHub</Button>
        </div>
      </div>

      {/* Sentiment overview */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <SentimentChart data={sentimentBreakdown} />
        </CardContent>
      </Card>

      {/* Key insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightsList insights={insights} />
        </CardContent>
      </Card>

      {/* Individual responses */}
      <Card>
        <CardHeader>
          <CardTitle>Persona Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseTable results={results} />
        </CardContent>
      </Card>
    </div>
  )
}
```

**2. Sentiment Analysis**

```typescript
// Sentiment distribution visualization
function SentimentChart({ data }: { data: SentimentData }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-around">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {data.positive}%
          </div>
          <div className="text-sm text-muted-foreground">Positive</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-600">
            {data.neutral}%
          </div>
          <div className="text-sm text-muted-foreground">Neutral</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600">
            {data.negative}%
          </div>
          <div className="text-sm text-muted-foreground">Negative</div>
        </div>
      </div>

      <Progress
        value={data.positive}
        className="h-8"
        indicatorClassName="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
      />
    </div>
  )
}
```

**3. Insight Extraction**

```typescript
// AI-powered insight extraction
async function extractInsights(results: PersonaResult[]) {
  const client = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  })

  const prompt = `
  Analyze these experiment results and extract 3-5 key insights:

  ${results.map(r => `${r.persona_name}: ${r.response}`).join('\n\n')}

  For each insight:
  1. What is the pattern?
  2. What does it mean for the decision?
  3. What should the founder do?
  `

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  return parseInsights(response.content[0].text)
}
```

**4. Export & GitHub Push**

```rust
// Export results to PDF
#[tauri::command]
async fn export_results_pdf(experiment_id: String) -> Result<String, String> {
    let results = load_results(&experiment_id)?;
    let pdf_path = generate_pdf(&results)?;
    Ok(pdf_path)
}

// Push to GitHub
#[tauri::command]
async fn push_to_github(experiment_id: String) -> Result<(), String> {
    let results = load_results(&experiment_id)?;

    // Update decision log
    update_decision_log(&experiment_id, &results)?;

    // Commit and push
    git_commit(&format!("Update decision: {} - Results added", experiment_id))?;
    git_push()?;

    Ok(())
}
```

#### **Demo Script**

```
1. Experiment completes (from Phase 3)
2. Results dashboard loads
3. User sees:
   - Sentiment: 60% positive, 30% neutral, 10% negative
   - Key Insights:
     * VCs prefer seed funding (8/10)
     * Angels concerned about valuation
     * Advisors recommend bootstrapping first
   - Individual responses (table)
4. User clicks "Push to GitHub"
5. Git commit created: "Update decision: seed-vs-bootstrap - Results added"
6. Decision log updated with results
7. User can share GitHub link with co-founder
```

**User gets actionable insights! ✅**

#### **Implementation Checklist**

**Week 7**:

- [ ] Results dashboard UI
- [ ] Sentiment analysis visualization
- [ ] AI insight extraction
- [ ] Response table with filtering
- [ ] PDF export
- [ ] GitHub push integration
- [ ] E2E test: Results → Insights → Export → GitHub

**Deliverable**: Beautiful, actionable results ✓

---

### **PHASE 5: Iteration & Polish (Week 8)**

#### **Goal**

Follow-up questions work, team collaboration enabled, polish complete.

#### **What Gets Added to Phases 1-4**

**1. Follow-up Questions**

```tsx
// Follow-up chat after results
function FollowUpChat({ experimentId }: { experimentId: string }) {
  const { data: experiment } = useExperiment(experimentId)
  const { data: results } = useExperimentResults(experimentId)

  const handleFollowUp = async (question: string) => {
    // Agent has context of experiment + results
    const response = await chat(question, {
      experimentId,
      results,
      context: experiment.context,
    })

    // Agent might suggest new experiment
    if (response.suggestedExperiment) {
      showNewExperimentDialog(response.suggestedExperiment)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-up Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <ChatInput onSend={handleFollowUp} />
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Try asking:</p>
          <ul className="text-sm space-y-1 mt-2">
            <li>"Why did VCs prefer seed funding?"</li>
            <li>"What if we increased the funding target to $3M?"</li>
            <li>"Should I test different investor types?"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
```

**2. Experiment Comparison**

```tsx
// Compare multiple experiments
function ExperimentComparison({ experimentIds }: { experimentIds: string[] }) {
  const experiments = useExperiments(experimentIds)

  return (
    <div className="grid grid-cols-2 gap-6">
      {experiments.map(exp => (
        <Card key={exp._id}>
          <CardHeader>
            <CardTitle>{exp.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentComparison data={exp.results} />
            <InsightsComparison insights={exp.insights} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**3. Template Customization**

```tsx
// Customize templates (fork and modify)
function TemplateCustomizer({ templateId }: { templateId: string }) {
  const { data: template } = useTemplate(templateId)
  const [customized, setCustomized] = useState(template)

  const handleSave = async () => {
    await saveCustomTemplate({
      ...customized,
      parentTemplateId: templateId,
      authorId: currentUserId,
    })
  }

  return (
    <div className="space-y-4">
      <Input
        label="Template Name"
        value={customized.name}
        onChange={e => setCustomized({ ...customized, name: e.target.value })}
      />

      <VariableEditor
        variables={customized.variables}
        onChange={vars => setCustomized({ ...customized, variables: vars })}
      />

      <Button onClick={handleSave}>Save Custom Template</Button>
    </div>
  )
}
```

**4. Team Collaboration**

```tsx
// GitHub collaboration view
function CollaborationView({ experimentId }: { experimentId: string }) {
  const { data: gitStatus } = useGitStatus(experimentId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaboration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span className="text-sm">Branch: {gitStatus.branch}</span>
          </div>

          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4" />
            <span className="text-sm">
              Last commit: {gitStatus.lastCommit.message}
            </span>
          </div>

          <Button variant="outline" onClick={viewOnGitHub}>
            View on GitHub
          </Button>

          <Button variant="outline" onClick={shareWithTeam}>
            Share with Team
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**5. Polish**

- Dark mode toggle
- Keyboard shortcuts (⌘K command palette)
- Onboarding wizard
- Empty states with helpful tips
- Error messages with recovery suggestions
- Loading states and skeletons
- Animations and transitions
- Help documentation

#### **Demo Script**

```
1. User views experiment results
2. User asks: "Why did VCs prefer seed funding?"
3. Agent explains: "VCs saw strong traction ($50K MRR) and team experience..."
4. Agent suggests: "Want to test with a higher funding target ($3M)?"
5. User clicks "Yes"
6. New experiment runs with modified config
7. User compares both experiments side-by-side
8. User customizes template for future use
9. User shares GitHub link with co-founder
10. Co-founder adds comments on GitHub
```

**Complete collaborative workflow! ✅**

#### **Implementation Checklist**

**Week 8**:

- [ ] Follow-up chat integration
- [ ] Experiment comparison view
- [ ] Template customization UI
- [ ] GitHub collaboration features
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Onboarding wizard
- [ ] Polish (animations, empty states, error handling)
- [ ] E2E test: Complete workflow from start to finish

**Deliverable**: Production-ready platform ✓

---

## Complete Timeline Summary

```
┌──────────────────────────────────────────────────────────┐
│  MONTH 1: Foundation                                      │
├──────────────────────────────────────────────────────────┤
│  Week 1-2: PHASE 1 - Context Upload                      │
│    → Demo: Upload CSV → View library → Git commit        │
│                                                           │
│  Week 3-4: PHASE 2 - Chat Interface + Agent              │
│    → Demo: Chat → Template → Decision log                │
│                                                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  MONTH 2: Execution & Polish                              │
├──────────────────────────────────────────────────────────┤
│  Week 5-6: PHASE 3 - Cloud Execution                     │
│    → Demo: 10 personas → 30 seconds → Results            │
│                                                           │
│  Week 7: PHASE 4 - Results & Visualization               │
│    → Demo: Charts → Insights → Export → GitHub           │
│                                                           │
│  Week 8: PHASE 5 - Iteration & Polish                    │
│    → Demo: Follow-up → Compare → Collaborate             │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Total: 8 weeks (2 months)**

---

## Success Criteria

### **Phase 1 Complete When**:

- [ ] User can upload CSV/PDF
- [ ] Context displays in library
- [ ] Files stored in Convex
- [ ] Auto-committed to Git
- [ ] **Demo: Upload → View → Git commit** ✓

### **Phase 2 Complete When**:

- [ ] Chat interface works
- [ ] Agent understands decision intent
- [ ] Template selection works
- [ ] Decision log created
- [ ] **Demo: Chat → Template → Decision log** ✓

### **Phase 3 Complete When**:

- [ ] Personas generated from context
- [ ] Experiments run on Modal
- [ ] 10+ personas execute in parallel
- [ ] Results stream in real-time
- [ ] **Demo: Experiment → 10 personas → 30 seconds** ✓

### **Phase 4 Complete When**:

- [ ] Results visualized clearly
- [ ] Sentiment analysis works
- [ ] Insights extracted
- [ ] Export to PDF/GitHub
- [ ] **Demo: Results → Charts → Export** ✓

### **Phase 5 Complete When**:

- [ ] Follow-up questions work
- [ ] Team collaboration via GitHub
- [ ] Template customization
- [ ] Polish complete
- [ ] **Demo: Follow-up → New experiment → Team review** ✓

---

## 🎉 You're Ready to Build!

**Planning**: COMPLETE ✅
**Architecture**: COMPLETE ✅
**Phase Breakdown**: COMPLETE ✅

**Next Action**: Start Phase 1, Day 1

**Follow**: `IMPLEMENTATION-PRIORITY.md` for detailed day-by-day tasks

**Let's ship!** 🚀
