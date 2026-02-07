# Unheard V2: Implementation Priority & Implementation Guide

**Date**: 2026-02-04
**Strategy**: Vertical slices - Complete working features, shipped incrementally
**Timeline**: 8 weeks to MVP
**Tech Stack**: Tauri + React + Claude SDK + Convex + Modal

---

## 🎯 Implementation Strategy

### Vertical Slices (Not Horizontal Layers)

```
❌ WRONG (Horizontal):
Month 1: All databases
Month 2: All backend
Month 3: All frontend
→ Nothing works until month 3

✅ RIGHT (Vertical):
Week 2: Context upload works end-to-end
Week 4: Chat interface works end-to-end
Week 6: Experiments run end-to-end
→ Always have demo-able software
```

---

## 📋 5 Implementation Phases (8 Weeks)

### Overview

```
PHASE 1: Context Upload (Weeks 1-2)
  ↓ Enables context management
PHASE 2: Chat Interface + Agent (Weeks 3-4)
  ↓ Enables conversational setup
PHASE 3: Cloud Execution (Weeks 5-6)
  ↓ Enables parallel experiments
PHASE 4: Results & Visualization (Week 7)
  ↓ Enables insight extraction
PHASE 5: Iteration & Polish (Week 8)
  ↓ Enables collaboration

→ MVP COMPLETE (8 weeks)
```

---

## 🚀 PHASE 1: Context Upload (Weeks 1-2)

### Goal

User can upload company context (CSV, PDF) and see it in the app.

### What to Build

#### Day 1-2: File Upload UI

```tsx
// src/components/context/ContextUploader.tsx

export function ContextUploader() {
  const uploadContext = useUploadContext()

  const handleDrop = async (files: File[]) => {
    for (const file of files) {
      const result = await commands.uploadContextFile(
        file.path,
        file.name,
        file.type
      )

      if (result.status === 'ok') {
        await uploadContext.mutate({
          filename: file.name,
          type: file.type,
          metadata: result.data,
        })
      }
    }
  }

  return (
    <DropZone onDrop={handleDrop}>
      <div className="text-center p-8">
        <Upload className="w-12 h-12 mx-auto mb-4" />
        <h3>Upload Context</h3>
        <p>CSV, PDF, or Excel files</p>
      </div>
    </DropZone>
  )
}
```

#### Day 3-4: File Parsing (Rust)

```rust
// src-tauri/src/commands/context.rs

#[command]
pub async fn upload_context_file(
    file_path: String,
    filename: String,
    file_type: String,
) -> Result<FileMetadata, String> {
    // Parse file based on type
    let metadata = match file_type.as_str() {
        "text/csv" => parse_csv(&file_path)?,
        "application/pdf" => parse_pdf(&file_path)?,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => {
            parse_xlsx(&file_path)?
        }
        _ => return Err("Unsupported file type".to_string()),
    };

    // Copy to project context directory
    let project_path = get_current_project_path()?;
    let dest_path = project_path.join("context").join(&filename);
    std::fs::copy(&file_path, &dest_path)?;

    Ok(metadata)
}

fn parse_csv(path: &str) -> Result<FileMetadata, String> {
    let mut reader = csv::Reader::from_path(path)?;

    let headers: Vec<String> = reader.headers()?.iter()
        .map(|h| h.to_string())
        .collect();

    let row_count = reader.records().count();

    Ok(FileMetadata {
        filename: path.to_string(),
        file_type: "csv".to_string(),
        rows: Some(row_count),
        columns: Some(headers),
        detected_type: detect_data_type(&headers),
    })
}
```

#### Day 5-7: Context Library UI

```tsx
// src/components/context/ContextLibrary.tsx

export function ContextLibrary() {
  const { data: contextFiles } = useContextFiles()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {contextFiles?.map(file => (
        <ContextFileCard key={file._id} file={file} />
      ))}

      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center h-40">
          <ContextUploader />
        </CardContent>
      </Card>
    </div>
  )
}

function ContextFileCard({ file }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileIcon type={file.type} />
          <div>
            <CardTitle className="text-base">{file.filename}</CardTitle>
            <CardDescription>
              {file.rows} rows • {file.columns?.length} columns
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{file.detected_type}</Badge>
          <span className="text-sm text-muted-foreground">
            {formatDate(file.uploaded_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Day 8-10: Git Integration

```rust
// src-tauri/src/commands/git.rs

#[command]
pub async fn git_init_project(
    project_name: String,
    project_path: PathBuf,
) -> Result<String, String> {
    // Initialize Git repo
    let repo = Repository::init(&project_path)?;

    // Create directory structure
    std::fs::create_dir_all(project_path.join("context"))?;
    std::fs::create_dir_all(project_path.join("decisions"))?;
    std::fs::create_dir_all(project_path.join("experiments"))?;

    // Initial commit
    commit_all(&repo, &format!("Initial commit: {}", project_name))?;

    Ok(project_path.to_string_lossy().to_string())
}

#[command]
pub async fn git_auto_commit(
    project_path: PathBuf,
    files: Vec<String>,
    message: String,
) -> Result<String, String> {
    let repo = Repository::open(&project_path)?;

    // Stage files
    let mut index = repo.index()?;
    for file in &files {
        index.add_path(Path::new(file))?;
    }
    index.write()?;

    // Commit
    let sig = Signature::now("Unheard", "noreply@unheard.app")?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let parent = repo.head()?.peel_to_commit()?;

    let commit_id = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&parent],
    )?;

    Ok(commit_id.to_string())
}
```

#### Day 11-14: Convex Integration

```typescript
// convex/schema.ts

export default defineSchema({
  // ... existing tables ...

  contextFiles: defineTable({
    userId: v.id('users'),
    filename: v.string(),
    fileType: v.string(),
    detectedType: v.optional(v.string()),
    rows: v.optional(v.number()),
    columns: v.optional(v.array(v.string())),
    uploadedAt: v.number(),
  }).index('by_user', ['userId']),
})

// convex/context.ts

export const uploadContextFile = mutation({
  args: {
    filename: v.string(),
    fileType: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx)

    const fileId = await ctx.db.insert('contextFiles', {
      userId,
      filename: args.filename,
      fileType: args.fileType,
      detectedType: args.metadata.detected_type,
      rows: args.metadata.rows,
      columns: args.metadata.columns,
      uploadedAt: Date.now(),
    })

    return fileId
  },
})

export const listContextFiles = query({
  args: {},
  handler: async ctx => {
    const userId = await getUserId(ctx)

    return await ctx.db
      .query('contextFiles')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
  },
})
```

### Phase 1 Success Criteria

- [ ] User can drag-and-drop CSV/PDF files
- [ ] Files are parsed and metadata extracted
- [ ] Files are stored in `context/` directory
- [ ] Files are listed in context library UI
- [ ] Files are auto-committed to Git
- [ ] Metadata is stored in Convex

### Phase 1 Demo Script

```
1. Open Unheard app
2. Create new project "ACME Corp Decisions"
3. Upload customers.csv (500 rows)
4. See file in context library:
   - "customers.csv"
   - "500 rows • 7 columns"
   - "Detected: customer_data"
5. Check Git: File committed automatically
6. Upload pitch-deck.pdf
7. See both files in library
```

**Demo this to stakeholders before proceeding to Phase 2!**

---

## 🚀 PHASE 2: Chat Interface + Agent (Weeks 3-4)

### Goal

Conversational decision-making works end-to-end.

### What to Build

#### Week 3 Day 1-2: Chat UI (Claude Desktop Style)

```tsx
// src/components/chat/ChatInterface.tsx

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  const sendMessage = async (content: string) => {
    // Add user message
    const userMessage = { role: 'user', content }
    setMessages([...messages, userMessage])

    // Stream agent response
    const stream = await agent.chat(content, messages)

    for await (const chunk of stream) {
      // Update assistant message in real-time
      setMessages(prev => updateLastMessage(prev, chunk))
    }
  }

  return (
    <div className="flex h-screen">
      {/* Context Sidebar */}
      <ContextSidebar />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatMessages messages={messages} />
        <ChatInput value={input} onChange={setInput} onSend={sendMessage} />
      </div>
    </div>
  )
}
```

#### Week 3 Day 3-5: Claude SDK Integration

```typescript
// src/lib/claude-agent.ts

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
})

export async function* chatStream(content: string, history: Message[]) {
  const stream = await anthropic.messages.stream({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [...history, { role: 'user', content }],
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      yield chunk.delta.text
    }
  }
}

const SYSTEM_PROMPT = `You are a decision support assistant for founders.

Your role is to help founders make better decisions by:
1. Understanding their decision context
2. Selecting the right template for their situation
3. Guiding them through configuration
4. Running experiments with realistic personas
5. Explaining results clearly

Available templates:
- Investor Evaluation (test investor interest)
- Pricing Strategy (test pricing with customers)
- Product Roadmap (prioritize features)
- Hiring Decision (evaluate candidates)
- Operations Decision (process/tool choices)

Be conversational, ask clarifying questions, and guide them step-by-step.`
```

#### Week 3 Day 6-7: Template Selection

```typescript
// src/lib/template-selection.ts

export async function selectTemplate(
  userInput: string,
  conversationHistory: Message[]
): Promise<Template | null> {
  // Use Claude to classify intent and recommend template
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Based on this conversation, which template best fits?

User: "${userInput}"

Templates:
1. investor-evaluation - For fundraising decisions
2. pricing-strategy - For pricing decisions
3. product-roadmap - For feature prioritization
4. hiring-decision - For hiring decisions
5. operations-decision - For operational decisions

Respond with just the template ID or "none" if unclear.`,
      },
    ],
  })

  const templateId = response.content[0].text.trim()

  if (templateId === 'none') return null

  // Load template from Convex
  return await convex.query(api.templates.getById, { id: templateId })
}
```

#### Week 4 Day 1-3: Configuration Flow

```typescript
// src/components/chat/ConfigurationWizard.tsx

export function ConfigurationWizard({ template, onComplete }) {
  const [config, setConfig] = useState({})
  const [currentStep, setCurrentStep] = useState(0)

  const step = template.configurationFlow[currentStep]

  const handleAnswer = async (answer: any) => {
    setConfig({ ...config, [step.id]: answer })

    // Agent validates and asks follow-up if needed
    const validation = await agent.validateAnswer(step, answer)

    if (validation.needsClarification) {
      // Agent asks follow-up question
      await agent.ask(validation.clarifyingQuestion)
    } else {
      // Move to next step
      setCurrentStep(currentStep + 1)
    }
  }

  if (currentStep >= template.configurationFlow.length) {
    onComplete(config)
    return null
  }

  return (
    <div className="space-y-4">
      <ChatMessage
        role="assistant"
        content={step.question}
      />

      {step.type === 'select' && (
        <SelectInput
          options={step.options}
          onChange={handleAnswer}
        />
      )}

      {step.type === 'text' && (
        <TextInput
          placeholder={step.placeholder}
          onChange={handleAnswer}
        />
      )}
    </div>
  )
}
```

#### Week 4 Day 4-7: Decision Logging

```typescript
// Auto-create decision log when configuration complete

export async function createDecisionLog(
  template: Template,
  config: Record<string, any>
) {
  // Generate decision log file
  const decisionId = generateId()
  const date = formatDate(new Date())

  const markdown = `# ${config.decision_title || 'Untitled Decision'}

**Date:** ${date}
**Category:** ${template.category}
**Template:** ${template.name}
**Status:** Exploring

## Context

${config.context || 'No context provided'}

## Configuration

${Object.entries(config)
  .map(
    ([key, value]) => `
- **${key}**: ${value}
`
  )
  .join('\n')}

## Experiments Run

(Will be added as experiments complete)

## Key Insights

(To be filled in after experiments)

## Decision

(To be made)

---

**Tags:** #${template.category}
**Created:** ${date}
`

  // Write to file
  const projectPath = useStore.getState().currentProjectPath
  const filePath = `decisions/${date}-${slug(config.decision_title)}.md`

  await commands.writeFile(path.join(projectPath, filePath), markdown)

  // Auto-commit
  await commands.gitAutoCommit(
    projectPath,
    [filePath],
    `Create decision: ${config.decision_title}`
  )

  // Save to Convex
  await convex.mutation(api.decisions.create, {
    title: config.decision_title,
    category: template.category,
    templateId: template._id,
    config,
    filePath,
  })

  return decisionId
}
```

### Phase 2 Success Criteria

- [ ] Chat interface works (Claude Desktop style)
- [ ] Agent understands user intent
- [ ] Agent recommends template
- [ ] Agent guides through configuration
- [ ] Decision log created automatically
- [ ] Decision auto-committed to Git

### Phase 2 Demo Script

```
1. Open chat interface
2. Type: "I need to decide if I should raise seed or bootstrap"
3. Agent responds:
   "I can help you with that. I recommend the 'Investor Evaluation'
    template. This will test investor interest with realistic personas.
    Let me ask you a few questions..."
4. Agent asks: "What stage are you at?"
5. User: "Seed, raising $2M"
6. Agent asks: "What's your industry?"
7. User: "Developer tools"
8. Agent asks: "What's your current MRR?"
9. User: "$50K"
10. Agent asks: "Summarize your pitch in 2-3 sentences"
11. User provides pitch summary
12. Agent: "Great! I've created a decision log and configured an
     experiment. Ready to run with 10 investor personas?"
13. User: "Yes"
14. (Transitions to Phase 3: Experiment execution)
```

**Demo this before proceeding to Phase 3!**

---

## 🚀 PHASE 3: Cloud Execution (Weeks 5-6)

### Goal

Experiments run in parallel on cloud with real personas.

### What to Build

#### Week 5 Day 1-3: Persona Generation

```typescript
// src/lib/persona-generation.ts

export async function generatePersonas(
  template: Template,
  config: Record<string, any>,
  contextFiles: ContextFile[]
): Promise<Persona[]> {
  const personas: Persona[] = []

  for (const archetype of template.personaGeneration.archetypes) {
    const count = archetype.count

    for (let i = 0; i < count; i++) {
      // Generate persona using Claude
      const persona = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Generate a realistic persona:

Archetype: ${archetype.name}
Description: ${archetype.description}
Characteristics: ${archetype.characteristics.join(', ')}

Context from user's data:
${contextFiles.map(f => summarize(f)).join('\n')}

Generate:
1. Name
2. Background (2-3 sentences)
3. Current situation
4. Beliefs and values
5. Decision-making criteria

Be realistic and specific. Base persona on real patterns from the context data.`
        }],
      })

      personas.push({
        id: generateId(),
        archetype: archetype.id,
        name: extractName(response),
        background: extractBackground(response),
        ...
      })
    }
  }

  return personas
}
```

#### Week 5 Day 4-7: Modal Integration

```python
# modal_functions/experiment_runner.py

import modal

app = modal.App("unheard-experiments")

image = (
    modal.Image.debian_slim()
    .pip_install("anthropic", "openai")
)

@app.function(
    image=image,
    concurrency_limit=50,
    timeout=300,
)
async def execute_persona(
    persona: dict,
    stimulus: str,
    model: str = "qwen2.5:32b"
) -> dict:
    """Execute a single persona simulation."""

    # Use appropriate LLM based on config
    if model.startswith("claude"):
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        response = client.messages.create(
            model=model,
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"""You are: {persona['name']}

Background: {persona['background']}
Beliefs: {persona['beliefs']}

Stimulus:
{stimulus}

Respond as this person would, considering your background and beliefs.
"""
            }]
        )
        text = response.content[0].text

    # Analyze sentiment
    sentiment = analyze_sentiment(text)

    return {
        "persona_id": persona["id"],
        "response": text,
        "sentiment": sentiment,
        "timestamp": time.time(),
    }

@app.function(image=image)
async def run_experiment(
    personas: list[dict],
    stimulus: str,
    model: str = "qwen2.5:32b",
) -> dict:
    """Run experiment with all personas in parallel."""

    # Execute all personas in parallel
    results = await asyncio.gather(*[
        execute_persona.remote(persona, stimulus, model)
        for persona in personas
    ])

    return {
        "results": results,
        "total_personas": len(personas),
        "completed_at": time.time(),
    }
```

```typescript
// src/lib/modal-client.ts

export async function runExperiment(
  personas: Persona[],
  stimulus: string,
  model: string = 'qwen2.5:32b'
) {
  // Call Modal function
  const response = await fetch(`${MODAL_URL}/run-experiment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MODAL_TOKEN}`,
    },
    body: JSON.stringify({
      personas,
      stimulus,
      model,
    }),
  })

  return await response.json()
}
```

#### Week 6 Day 1-4: Real-Time Progress

```tsx
// src/components/experiments/ExperimentProgress.tsx

export function ExperimentProgress({ experimentId }) {
  const [progress, setProgress] = useState<Progress>({
    total: 0,
    completed: 0,
    personas: [],
  })

  useEffect(() => {
    // Subscribe to progress events
    const unsubscribe = listen('experiment-progress', event => {
      if (event.experimentId === experimentId) {
        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          personas: [...prev.personas, event.personaId],
        }))
      }
    })

    return unsubscribe
  }, [experimentId])

  return (
    <div className="space-y-4">
      <div>
        <h3>Running Experiment</h3>
        <Progress value={(progress.completed / progress.total) * 100} />
        <p className="text-sm text-muted-foreground mt-2">
          {progress.completed} of {progress.total} personas complete
        </p>
      </div>

      <div className="space-y-2">
        {progress.personas.map((personaId, i) => (
          <div key={personaId} className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm">
              {getPersonaName(personaId)} responded
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### Week 6 Day 5-7: Results Storage

```typescript
// Save results to Convex and Git

export async function saveExperimentResults(
  experimentId: string,
  results: ExperimentResults
) {
  // Save to Convex
  await convex.mutation(api.experiments.updateResults, {
    experimentId,
    results: {
      responses: results.responses,
      summary: results.summary,
      completedAt: Date.now(),
    },
  })

  // Generate result files
  const projectPath = useStore.getState().currentProjectPath
  const expDir = `experiments/exp-${experimentId}`

  // 1. results.json (full data)
  await commands.writeFile(
    path.join(projectPath, expDir, 'results.json'),
    JSON.stringify(results, null, 2)
  )

  // 2. summary.md (human-readable)
  const summary = generateSummaryMarkdown(results)
  await commands.writeFile(
    path.join(projectPath, expDir, 'summary.md'),
    summary
  )

  // Auto-commit
  await commands.gitAutoCommit(
    projectPath,
    [`${expDir}/results.json`, `${expDir}/summary.md`],
    `Complete experiment: ${results.name}`
  )
}
```

### Phase 3 Success Criteria

- [ ] Personas generated from context
- [ ] Experiment runs on Modal
- [ ] 10+ personas execute in parallel
- [ ] Results stream in real-time (<60s total)
- [ ] Results saved to Convex and Git

### Phase 3 Demo Script

```
1. (Continuing from Phase 2 demo)
2. Agent: "Running experiment with 10 investor personas..."
3. Progress bar shows: "3 of 10 complete"
4. Real-time updates:
   "✓ Sarah Chen (Seed VC) responded"
   "✓ Mike Rodriguez (Angel) responded"
   ...
5. 45 seconds later: "✓ All 10 personas responded"
6. Agent: "Experiment complete! Here are the results..."
7. (Transitions to Phase 4: Results visualization)
```

**Demo this before proceeding to Phase 4!**

---

## 🚀 PHASE 4: Results & Visualization (Week 7)

### Goal

Results are easy to understand and actionable.

### What to Build

#### Day 1-3: Results Dashboard

```tsx
// src/components/results/ResultsDashboard.tsx

export function ResultsDashboard({ experimentId }) {
  const { data: results } = useExperimentResults(experimentId)

  return (
    <div className="space-y-6">
      {/* Overall Sentiment */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <SentimentGauge
            value={results.metrics.investment_rate * 100}
            label={`${(results.metrics.investment_rate * 100).toFixed(0)}% interested`}
          />
        </CardContent>
      </Card>

      {/* Breakdown by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Interest by Investor Type</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={results.insights.investor_type_breakdown} />
        </CardContent>
      </Card>

      {/* Top Concerns */}
      <Card>
        <CardHeader>
          <CardTitle>Top Concerns</CardTitle>
        </CardHeader>
        <CardContent>
          <WordCloud words={results.insights.top_concerns} />
        </CardContent>
      </Card>

      {/* Individual Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Responses</CardTitle>
        </CardHeader>
        <CardContent>
          {results.responses.map(response => (
            <ResponseCard key={response.persona_id} response={response} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

#### Day 4-5: Insight Extraction

```typescript
// Use Claude to extract insights from results

export async function extractInsights(
  results: ExperimentResults,
  template: Template
): Promise<Insights> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Analyze these experiment results and extract key insights:

Experiment: ${results.name}
Personas: ${results.responses.length}

Responses:
${results.responses
  .map(
    r => `
${r.persona_name}: ${r.response}
Sentiment: ${r.sentiment}
`
  )
  .join('\n')}

Extract:
1. Top 5 concerns (keywords/themes)
2. Most positive feedback (quotes)
3. Common questions asked
4. Patterns by persona type
5. Actionable recommendations

Format as JSON.`,
      },
    ],
  })

  return JSON.parse(response.content[0].text)
}
```

#### Day 6-7: Export & Sharing

```typescript
// Export results to PDF and update decision log

export async function exportResults(experimentId: string) {
  const results = await convex.query(api.experiments.getResults, {
    experimentId,
  })

  // Generate PDF
  const pdf = await generatePDF(results)

  // Save to project
  const projectPath = useStore.getState().currentProjectPath
  await commands.writeFile(
    path.join(projectPath, `experiments/exp-${experimentId}/report.pdf`),
    pdf
  )

  // Update decision log
  await updateDecisionLog(results)

  // Auto-commit
  await commands.gitAutoCommit(
    projectPath,
    [`experiments/exp-${experimentId}/report.pdf`],
    `Export results: ${results.name}`
  )
}
```

### Phase 4 Success Criteria

- [x] Results visualized clearly (ResultsDashboard, VanWestendorpChart SVG, SentimentOverview)
- [x] Sentiment analysis accurate (per-archetype breakdown, overall average)
- [x] Insights extracted automatically (Claude Haiku on Modal: themes, recommendations, concerns)
- [x] Van Westendorp Price Sensitivity Meter (OPP/IPP/PMC/PME, cumulative curves, per-archetype)
- [x] Templates shown directly in left sidebar (TemplateList.tsx)
- [x] Markdown export + clipboard copy
- [ ] Export to PDF works
- [ ] Results auto-committed to Git (GitHub push integration)

### Phase 4 Demo Script

```
1. (Continuing from Phase 3)
2. Results dashboard loads
3. Shows: "70% Investment Interest" (green gauge)
4. Bar chart: Seed VCs 100%, Angels 67%, etc.
5. Word cloud: "market size", "competition", "traction"
6. Individual responses with quotes
7. Agent: "Key insight: Seed VCs are very interested, but you
    need stronger market size validation. Would you like to
    run a follow-up experiment?"
8. User: "Yes, what do you suggest?"
9. (Transitions to Phase 5: Follow-up)
```

---

## 🚀 PHASE 5: Iteration & Polish (Week 8)

### Goal

Follow-up questions work, collaboration enabled, polish complete.

### What to Build

#### Day 1-2: Follow-Up System

```typescript
// Agent suggests follow-up experiments based on results

export async function suggestFollowUp(
  experimentResults: ExperimentResults
): Promise<FollowUpSuggestion[]> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Based on these experiment results, what follow-up experiments would help?

Results summary:
${JSON.stringify(experimentResults.summary, null, 2)}

Top concerns:
${experimentResults.insights.top_concerns.join(', ')}

Suggest 2-3 follow-up experiments that would address the concerns or test variations.`,
      },
    ],
  })

  return parseFollowUpSuggestions(response.content[0].text)
}
```

#### Day 3-4: GitHub Collaboration

```typescript
// Enable team collaboration via GitHub

export async function inviteTeamMember(email: string) {
  const projectPath = useStore.getState().currentProjectPath
  const repoUrl = useStore.getState().githubRepoUrl

  // Add collaborator via GitHub API
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
      },
    }
  )

  // Send email with instructions
  await sendEmail(email, {
    subject: 'Invited to collaborate on decisions',
    body: `You've been invited to collaborate on decision-making.

1. Install Unheard: https://unheard.app/download
2. Clone project: ${repoUrl}
3. Review decisions and add your insights

Questions? Reply to this email.`,
  })
}
```

#### Day 5-6: Template Customization

```typescript
// Allow users to fork and customize templates

export async function forkTemplate(
  templateId: string,
  customizations: Partial<Template>
) {
  const original = await convex.query(api.templates.getById, {
    id: templateId,
  })

  const forked = await convex.mutation(api.templates.create, {
    ...original,
    ...customizations,
    id: generateId(),
    forkedFrom: templateId,
    status: 'private',
    author: useStore.getState().userId,
  })

  return forked
}
```

#### Day 7: Polish & Bug Fixes

- Fix any outstanding bugs
- Polish UI animations
- Optimize performance
- Write documentation
- Test end-to-end flow

### Phase 5 Success Criteria

- [ ] Follow-up questions work
- [ ] Agent suggests next experiments
- [ ] Team collaboration via GitHub
- [ ] Template customization works
- [ ] All bugs fixed
- [ ] Polished UX

### Phase 5 Demo Script (Complete Flow)

```
COMPLETE END-TO-END DEMO:

1. Create project "ACME Corp"
2. Upload context (customers.csv, pitch-deck.pdf)
3. Chat: "Should I raise seed or bootstrap?"
4. Agent guides through investor template
5. Configure: Seed, $2M, developer tools, $50K MRR
6. Agent creates decision log
7. Run experiment with 10 investor personas
8. View results: 70% positive, concerns noted
9. Ask: "Why were VCs concerned about market size?"
10. Agent explains and suggests follow-up
11. Run follow-up: "Investor pitch with market validation"
12. Compare results: 90% positive now
13. Make decision: "Raise $2M seed"
14. Export report PDF
15. Invite co-founder to review
16. All committed to Git, pushed to GitHub

TOTAL TIME: 10 minutes
```

---

## 📊 Success Metrics

### Technical Metrics

| Metric               | Target             | Current |
| -------------------- | ------------------ | ------- |
| Chat response time   | <200ms             | -       |
| Experiment execution | <60s (10 personas) | -       |
| Bundle size          | <20MB              | 15MB ✅ |
| Memory usage         | <150MB             | 80MB ✅ |

### User Metrics

| Metric                     | Target          |
| -------------------------- | --------------- |
| Time to first experiment   | <5 min          |
| Setup time (with template) | <2 min          |
| Template usage rate        | >70%            |
| Git commit rate            | >20 per project |

---

## 🎁 What You Get After 8 Weeks

- ✅ Context upload (CSV, PDF)
- ✅ Chat interface (Claude Desktop style)
- ✅ 3 core templates (Investors, Pricing, Hiring)
- ✅ Cloud execution (10+ personas in parallel)
- ✅ Results visualization
- ✅ Git versioning + GitHub sync
- ✅ Team collaboration
- ✅ Export & sharing

**Fully functional MVP ready to ship!**

---

## 🚀 Getting Started (Week 1 Day 1)

### Setup Checklist

- [ ] Confirm Tauri + Convex working (already done!)
- [ ] Install Claude SDK: `npm install @anthropic-ai/sdk`
- [ ] Sign up for Modal: https://modal.com
- [ ] Get Anthropic API key
- [ ] Install git2 Rust crate: `cargo add git2`

### Day 1 Tasks

```bash
# 1. Add dependencies
npm install @anthropic-ai/sdk
cd src-tauri && cargo add git2 csv

# 2. Create directory structure
mkdir -p src/components/context
mkdir -p src/components/chat
mkdir -p src/lib
mkdir -p src-tauri/src/commands

# 3. Start with context upload UI
# See Phase 1 Day 1-2 above
```

---

## 💬 Questions?

- Architecture unclear? → Read `architecture-decision.md`
- Templates unclear? → Read `template-system-spec.md`
- Git unclear? → Read `git-integration-spec.md`
- Week-by-week breakdown? → Read `vertical-slice-implementation.md`

**Let's build! Start with Phase 1 Day 1: File Upload UI** 🚀
