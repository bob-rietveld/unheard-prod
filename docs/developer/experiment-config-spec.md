# Experiment Config YAML Specification

**Date**: 2026-02-06
**Version**: 1.0
**Status**: Approved
**Purpose**: Define the YAML experiment config file generated after a user completes the template configuration wizard

---

## 1. Purpose

The experiment config YAML is the **bridge between the chat/wizard UI and the cloud execution engine (Modal)**. It captures everything needed to run an experiment as a single, portable, version-controlled file.

### Where It Fits in the Flow

```
User describes decision in chat
  -> Agent recommends template (from Convex experimentTemplates)
  -> User completes configuration wizard (answers questions)
  -> System generates decision log markdown (decisions/*.md)    <-- exists today
  -> System generates experiment config YAML (experiments/*.yaml) <-- THIS SPEC
  -> Modal reads config YAML and executes experiment (Phase 3)
  -> Results written back alongside config (experiments/*-results.json)
```

The decision log (markdown) is the human-readable record. The experiment config (YAML) is the machine-readable execution plan. Both are generated at the same time when the user finishes the wizard.

### Design Principles

1. **Self-contained**: The YAML file contains everything needed to run the experiment. No external lookups required at execution time.
2. **Deterministic**: Given the same config, the experiment should produce comparable results (modulo LLM stochasticity).
3. **Git-friendly**: Plain text, diffable, suitable for version control.
4. **Derived from templates**: The schema captures what seed templates already define -- it does not invent new concepts.

---

## 2. YAML Schema

### Complete Schema Definition

```yaml
# ============================================================
# METADATA
# ============================================================
metadata:
  id: string              # Unique ID: "exp-YYYY-MM-DD-{slug}"
  version: string          # Config format version: "1.0"
  created: string          # ISO 8601 timestamp
  template:
    id: string             # Template ID from YAML (e.g., "investor-pitch-evaluation")
    slug: string           # Template slug from Convex (e.g., "investor-evaluation")
    version: string        # Template version (e.g., "1.0")
    name: string           # Human-readable template name
  decision:
    id: string             # Decision log ID (e.g., "dec-2026-02-06-seed-fundraising")
    title: string          # User-provided decision title
    markdownPath: string   # Relative path to decision log (e.g., "decisions/2026-02-06-seed-fundraising.md")

# ============================================================
# CONFIGURATION (user's wizard answers)
# ============================================================
configuration:
  # Key-value pairs where keys are question IDs from configurationFlow
  # Values are typed according to the question type:
  #   text/textarea -> string
  #   select        -> string (the selected option value)
  #   multiselect   -> string[] (list of selected option values)
  #   number        -> number
  #   boolean       -> boolean
  {question_id}: {typed_value}

# ============================================================
# CONTEXT (referenced context files)
# ============================================================
context:
  files:
    - path: string         # Relative path in project (e.g., "context/customers.csv")
      originalFilename: string  # Original upload filename
      fileType: string     # MIME-like type: "csv", "pdf", "xlsx", "txt", "md"
      detectedType: string # Optional semantic type: "customer_data", "financial_model", etc.
      rows: number         # For tabular data: row count (optional)
      columns: string[]    # For tabular data: column names (optional)
      pages: number        # For documents: page count (optional)
      sizeBytes: number    # File size in bytes

# ============================================================
# PERSONAS (generation strategy and archetypes)
# ============================================================
personas:
  generationType: string   # "standard" | "fromContext"
  count: number            # Total persona count (e.g., 10)
  archetypes:
    - id: string           # Archetype ID (e.g., "seed_vc_partner")
      name: string         # Human-readable name (e.g., "Seed VC Partner")
      count: number        # How many of this archetype to generate

# ============================================================
# STIMULUS (the prompt template with variables substituted)
# ============================================================
stimulus:
  template: string         # The stimulus prompt with {{variable}} placeholders resolved
  # The template is resolved at generation time by substituting
  # configuration answers into the template's stimulusTemplate field.
  # If the template has no stimulusTemplate, a default is generated
  # from the template category and configuration answers.

# ============================================================
# EXECUTION (provider and model settings)
# ============================================================
execution:
  provider: string         # "modal" | "anthropic" | "openai"
  model: string            # Model identifier (e.g., "qwen2.5:32b", "claude-3-5-haiku-20241022")
  temperature: number      # Sampling temperature (e.g., 0.7)
  maxTokens: number        # Max tokens per response (e.g., 500)
  timeout: number          # Per-response timeout in seconds (e.g., 60)
  parallelization: boolean # Whether to run persona responses in parallel

# ============================================================
# ANALYSIS (metrics and insight extraction)
# ============================================================
analysis:
  metrics:
    - id: string           # Metric ID (e.g., "investment_rate")
      name: string         # Human-readable name
      description: string  # What this metric measures (optional)
      calculation: string  # Pseudo-expression for calculation
  insights:
    - id: string           # Insight ID (e.g., "top_concerns")
      name: string         # Human-readable name
      description: string  # What this insight captures (optional)
      extraction: string   # Extraction method (e.g., "keyword_extraction", "question_extraction") (optional)
      groupBy: string      # Group results by field (e.g., "archetype") (optional)
      limit: number        # Max items to extract (optional)

# ============================================================
# OUTPUT (format and storage)
# ============================================================
output:
  format: string           # "yaml" (the config itself) + "json" (results)
  resultsPath: string      # Relative path for results file (e.g., "experiments/2026-02-06-seed-fundraising-results.json")
  gitAutoCommit: boolean   # Whether to auto-commit results when experiment completes
```

### Required vs Optional Fields

| Section | Field | Required | Notes |
|---------|-------|----------|-------|
| metadata.id | Yes | Generated automatically |
| metadata.version | Yes | Always "1.0" for now |
| metadata.created | Yes | ISO 8601 |
| metadata.template | Yes | Always present (derived from selected template) |
| metadata.decision | Yes | Links back to decision log |
| configuration | Yes | At minimum, all required question answers |
| context.files | No | Empty array if no context files uploaded |
| personas | Yes | Derived from template personaGeneration |
| stimulus.template | Yes | Resolved prompt text |
| execution | Yes | Defaults from template or system defaults |
| analysis.metrics | No | Empty array if template defines none |
| analysis.insights | No | Empty array if template defines none |
| output | Yes | Defaults applied automatically |

---

## 3. Variable Substitution

Template YAML files define a `stimulusTemplate` field (in the template-system-spec) with variable placeholders. The experiment config generator resolves these variables using the user's wizard answers.

### Substitution Rules

1. **Syntax**: `{{variable_name}}` in the stimulus template maps to a key in `configuration`.
2. **Matching**: Variable names correspond directly to question IDs from `configurationFlow`. For example, `{{funding_target}}` maps to the answer for question ID `funding_target`.
3. **Type formatting**:
   - `string` values are inserted as-is
   - `number` values are formatted as plain numbers (no currency formatting in YAML; display formatting is a UI concern)
   - `string[]` (multiselect) values are joined with ", "
   - `boolean` values are rendered as "Yes" or "No"
4. **Missing optional values**: If a variable references an optional question that the user did not answer, the placeholder is replaced with "N/A".
5. **Unknown variables**: If a placeholder references a variable not in `configuration`, it is left as `{{variable_name}}` with a warning logged.

### Example

Template stimulus:
```
You're evaluating {{company_name}} for investment.
Stage: {{stage}}
Raising: {{funding_target}}
Industry: {{industry}}
Current MRR: {{current_mrr}}
Pitch: {{pitch_summary}}
```

User answers:
```yaml
configuration:
  stage: seed
  funding_target: 2000000
  industry: developer tools
  current_mrr: 50000
  pitch_summary: "We're building AI-powered decision support for founders..."
```

Resolved stimulus (stored in experiment config):
```
You're evaluating the company for investment.
Stage: seed
Raising: 2000000
Industry: developer tools
Current MRR: 50000
Pitch: We're building AI-powered decision support for founders...
```

Note: The seed templates do not currently include a `stimulusTemplate` field. When a template lacks an explicit stimulus, the generator creates a default stimulus based on the template category and all configuration answers. See section 6 for details.

---

## 4. File Conventions

### Naming

```
experiments/YYYY-MM-DD-{slug}.yaml
```

- `YYYY-MM-DD`: Date the config was generated
- `{slug}`: Sanitized decision title (lowercase, hyphens, max 50 chars)
- Same slug logic as decision logs (uses `sanitizeFilename()` from `src/lib/decision-generator.ts`)

Examples:
```
experiments/2026-02-06-seed-fundraising.yaml
experiments/2026-02-06-pricing-evaluation.yaml
experiments/2026-02-06-roadmap-prioritization.yaml
```

### Duplicate Handling

If a file with the same name already exists, append a numeric suffix:
```
experiments/2026-02-06-seed-fundraising-2.yaml
experiments/2026-02-06-seed-fundraising-3.yaml
```

This mirrors the decision log duplicate handling pattern.

### Results File

When the experiment completes, results are stored alongside the config:
```
experiments/2026-02-06-seed-fundraising-results.json
```

### Storage Location

All experiment configs live under the `experiments/` directory in the project root (the Git repository root). This directory is created automatically if it does not exist.

### Git Behavior

- The experiment config YAML is auto-committed when generated, using the existing `git_auto_commit` Tauri command from Phase 1.
- Commit message format: `[unheard] Add experiment config: {decision title}`
- The results JSON is auto-committed when the experiment completes (Phase 3).
- Commit message format: `[unheard] Add experiment results: {decision title}`

---

## 5. Complete Examples

### 5.1 Investor Pitch Evaluation

```yaml
metadata:
  id: exp-2026-02-06-seed-fundraising
  version: "1.0"
  created: "2026-02-06T14:30:00Z"
  template:
    id: investor-pitch-evaluation
    slug: investor-evaluation
    version: "1.0"
    name: Investor Pitch Evaluation
  decision:
    id: dec-2026-02-06-seed-fundraising
    title: Seed Fundraising Decision
    markdownPath: decisions/2026-02-06-seed-fundraising.md

configuration:
  stage: seed
  funding_target: 2000000
  industry: developer tools
  current_mrr: 50000
  pitch_summary: >-
    We're building AI-powered decision support for founders.
    We have 30 paying customers and $50K MRR with 15% month-over-month growth.

context:
  files:
    - path: context/customers.csv
      originalFilename: customers.csv
      fileType: csv
      detectedType: customer_data
      rows: 500
      columns: [name, email, plan, mrr, signup_date]
      sizeBytes: 45200
    - path: context/pitch-deck.pdf
      originalFilename: pitch-deck.pdf
      fileType: pdf
      pages: 12
      sizeBytes: 2340000

personas:
  generationType: standard
  count: 10
  archetypes:
    - id: seed_vc_partner
      name: Seed VC Partner
      count: 3
    - id: angel_investor
      name: Angel Investor
      count: 3
    - id: series_a_vc_principal
      name: Series A VC Principal
      count: 2
    - id: corporate_vc
      name: Corporate VC
      count: 2

stimulus:
  template: >-
    You are evaluating a startup for investment.

    Funding Stage: seed
    Amount Raising: $2,000,000
    Industry: developer tools
    Current MRR: $50,000

    Pitch Summary:
    We're building AI-powered decision support for founders.
    We have 30 paying customers and $50K MRR with 15% month-over-month growth.

    Based on your investment criteria and experience, provide:
    1. Your investment decision (PASS, INTERESTED, or INVEST)
    2. Your reasoning (2-3 key points)
    3. Your biggest concern
    4. One question you'd ask the founders

execution:
  provider: modal
  model: qwen2.5:32b
  temperature: 0.7
  maxTokens: 500
  timeout: 60
  parallelization: true

analysis:
  metrics:
    - id: investment_rate
      name: Investment Interest Rate
      description: Percentage of investors interested or investing
      calculation: "COUNT(decision IN ['INTERESTED', 'INVEST']) / TOTAL"
    - id: pass_rate
      name: Pass Rate
      calculation: "COUNT(decision = 'PASS') / TOTAL"
    - id: avg_sentiment
      name: Average Sentiment
      calculation: "AVG(sentiment_score)"
  insights:
    - id: top_concerns
      name: Top Concerns
      description: Most frequently mentioned concerns
      extraction: keyword_extraction
      limit: 5
    - id: investor_type_breakdown
      name: Interest by Investor Type
      description: Which investor types are most interested
      groupBy: archetype
    - id: key_questions
      name: Common Questions
      description: Questions investors would ask
      extraction: question_extraction
      limit: 10

output:
  format: yaml
  resultsPath: experiments/2026-02-06-seed-fundraising-results.json
  gitAutoCommit: true
```

### 5.2 Pricing Strategy Evaluation

```yaml
metadata:
  id: exp-2026-02-06-pricing-evaluation
  version: "1.0"
  created: "2026-02-06T15:00:00Z"
  template:
    id: pricing-strategy-evaluation
    slug: pricing-strategy
    version: "1.0"
    name: Pricing Strategy Evaluation
  decision:
    id: dec-2026-02-06-pricing-evaluation
    title: Pricing Strategy Evaluation
    markdownPath: decisions/2026-02-06-pricing-evaluation.md

configuration:
  product_name: DataPipe
  product_description: >-
    Real-time data pipeline tool that connects any data source to any
    destination. Eliminates the need for custom ETL scripts.
  pricing_models:
    - freemium
    - usage-based
    - tiered
  price_range_low: 29
  price_range_high: 299

context:
  files:
    - path: context/customer-survey.csv
      originalFilename: customer-survey.csv
      fileType: csv
      detectedType: customer_data
      rows: 200
      columns: [company_size, current_spend, pain_points, willingness_to_pay]
      sizeBytes: 18400

personas:
  generationType: fromContext
  count: 8
  archetypes:
    - id: price_sensitive
      name: Price-Sensitive Buyer
      count: 3
    - id: value_buyer
      name: Value-Focused Buyer
      count: 3
    - id: premium_buyer
      name: Premium Buyer
      count: 2

stimulus:
  template: >-
    You are evaluating a data pipeline product called DataPipe.

    Product Description:
    Real-time data pipeline tool that connects any data source to any
    destination. Eliminates the need for custom ETL scripts.

    Pricing Models Being Tested:
    - Freemium (free tier + paid)
    - Usage-based (pay per use)
    - Tiered (good/better/best)

    Price Range: $29/mo - $299/mo

    Based on your role and budget constraints, provide:
    1. Which pricing model you prefer and why
    2. What price point feels right for your use case
    3. What would make you upgrade to a higher tier
    4. What would cause you to churn

execution:
  provider: modal
  model: qwen2.5:32b
  temperature: 0.7
  maxTokens: 500
  timeout: 60
  parallelization: true

analysis:
  metrics:
    - id: preferred_model
      name: Preferred Pricing Model
      description: Which model was most popular
      calculation: "MODE(preferred_model)"
    - id: avg_willingness_to_pay
      name: Average Willingness to Pay
      calculation: "AVG(price_point)"
    - id: churn_risk
      name: Churn Risk Factors
      calculation: "COUNT(churn_reason) GROUP BY reason"
  insights:
    - id: model_preference_by_segment
      name: Model Preference by Buyer Type
      description: Which segments prefer which models
      groupBy: archetype
    - id: price_sensitivity
      name: Price Sensitivity Analysis
      description: Price points where demand drops
      extraction: keyword_extraction
      limit: 5

output:
  format: yaml
  resultsPath: experiments/2026-02-06-pricing-evaluation-results.json
  gitAutoCommit: true
```

### 5.3 Product Roadmap Prioritization

```yaml
metadata:
  id: exp-2026-02-06-roadmap-prioritization
  version: "1.0"
  created: "2026-02-06T16:00:00Z"
  template:
    id: product-roadmap-prioritization
    slug: product-roadmap
    version: "1.0"
    name: Product Roadmap Prioritization
  decision:
    id: dec-2026-02-06-roadmap-prioritization
    title: Q2 Roadmap Prioritization
    markdownPath: decisions/2026-02-06-roadmap-prioritization.md

configuration:
  product_context: >-
    B2B analytics platform for e-commerce companies. Currently used by
    150 stores for sales tracking and inventory management.
  feature_list: >-
    Feature 1: Advanced analytics dashboard
    Feature 2: Mobile app for store owners
    Feature 3: API access for custom integrations
    Feature 4: Multi-store management
    Feature 5: Automated inventory alerts
  timeframe: next-quarter
  user_segment: SMBs with 1-5 stores

context:
  files:
    - path: context/feature-requests.csv
      originalFilename: feature-requests.csv
      fileType: csv
      detectedType: product_data
      rows: 340
      columns: [customer_id, feature_requested, priority, date]
      sizeBytes: 22100

personas:
  generationType: fromContext
  count: 10
  archetypes:
    - id: power_user
      name: Power User
      count: 3
    - id: casual_user
      name: Casual User
      count: 3
    - id: enterprise_admin
      name: Enterprise Admin
      count: 2
    - id: new_user
      name: New User
      count: 2

stimulus:
  template: >-
    You are a user of an e-commerce analytics platform.

    Product Context:
    B2B analytics platform for e-commerce companies. Currently used by
    150 stores for sales tracking and inventory management.

    We are planning our roadmap for the next quarter. Please rank
    these features by importance to you and explain your reasoning:

    1. Advanced analytics dashboard
    2. Mobile app for store owners
    3. API access for custom integrations
    4. Multi-store management
    5. Automated inventory alerts

    For each feature, provide:
    1. Priority rank (1-5, where 1 is most important)
    2. Why this matters to you
    3. Would this feature alone justify staying/upgrading?

execution:
  provider: modal
  model: qwen2.5:32b
  temperature: 0.7
  maxTokens: 500
  timeout: 60
  parallelization: true

analysis:
  metrics:
    - id: feature_ranking
      name: Feature Priority Ranking
      description: Average rank across all personas
      calculation: "AVG(rank) GROUP BY feature"
    - id: must_have_rate
      name: Must-Have Rate
      description: Percentage of personas ranking feature in top 2
      calculation: "COUNT(rank <= 2) / TOTAL GROUP BY feature"
  insights:
    - id: segment_preferences
      name: Preferences by User Type
      description: How different user types prioritize differently
      groupBy: archetype
    - id: upgrade_drivers
      name: Upgrade Drivers
      description: Features most likely to drive upgrades
      extraction: keyword_extraction
      limit: 5

output:
  format: yaml
  resultsPath: experiments/2026-02-06-roadmap-prioritization-results.json
  gitAutoCommit: true
```

---

## 6. Integration Points

### 6.1 Decision Log <-> Experiment Config

The decision log and experiment config are generated simultaneously from the same wizard completion. They share a linked identity:

- Decision log references the experiment config via the "Experiment Plan" section
- Experiment config references the decision log via `metadata.decision.markdownPath`
- Both use the same slug and date for correlated filenames:
  ```
  decisions/2026-02-06-seed-fundraising.md
  experiments/2026-02-06-seed-fundraising.yaml
  ```

### 6.2 Convex Integration

The `decisions` table in Convex tracks the relationship:

| Convex Field | Value |
|---|---|
| `decisions.templateId` | Reference to `experimentTemplates._id` |
| `decisions.configData` | JSON copy of the `configuration` section |
| `decisions.markdownFilePath` | Relative path to decision log |
| `decisions.status` | Transitions: `draft` -> `ready` -> `running` -> `completed` |

The experiment config YAML path is not stored in Convex directly. It is derived from the decision's `markdownFilePath` by replacing `decisions/` with `experiments/` and `.md` with `.yaml`. This avoids schema changes.

### 6.3 Template -> Config Generation

The generator reads from three sources:

1. **Template YAML** (from `experimentTemplates.yamlContent` in Convex): Provides `configurationFlow`, `personaGeneration`, and template metadata.
2. **User answers** (from `useChatStore.configAnswers` or `decisions.configData`): Provides the `configuration` section values.
3. **Context files** (from `contextFiles` table in Convex, filtered by project): Provides the `context.files` section.

The generator merges these into the experiment config YAML. Fields not present in the current seed templates (like `execution`, `analysis`, `stimulus`) use category-aware defaults:

| Field | Default Source |
|---|---|
| `execution.provider` | System default: `"modal"` |
| `execution.model` | System default: `"qwen2.5:32b"` |
| `execution.temperature` | `0.7` |
| `execution.maxTokens` | `500` |
| `execution.timeout` | `60` |
| `execution.parallelization` | `true` |
| `stimulus.template` | Generated from category + config answers |
| `analysis.metrics` | Category-specific defaults (see template-system-spec.md) |
| `analysis.insights` | Category-specific defaults |

### 6.4 Future Modal Execution (Phase 3)

The Modal execution engine will:

1. Read the experiment config YAML from disk
2. Generate full persona profiles from the `personas` section archetypes
3. Send the `stimulus.template` to each generated persona using `execution` settings
4. Collect responses and compute `analysis.metrics`
5. Extract `analysis.insights`
6. Write results to `output.resultsPath`
7. If `output.gitAutoCommit` is true, commit the results file

The config YAML is designed so that Modal needs no network access to Convex or the Tauri app -- everything is self-contained in the file.

### 6.5 Status Flow

```
Wizard complete
  -> decision.status = "ready"
  -> experiment config YAML written
  -> decision log markdown written
  -> both auto-committed to Git

User triggers "Run Experiment" (Phase 3)
  -> decision.status = "running"
  -> Modal reads experiment config YAML
  -> Modal executes experiment
  -> Modal writes results JSON

Experiment completes (Phase 3)
  -> decision.status = "completed"
  -> results JSON auto-committed to Git
  -> Convex updated with results summary
```

---

## 7. Implementation Notes

### Generator Function Signature

```typescript
// src/lib/experiment-config-generator.ts

interface ExperimentConfigInput {
  template: ParsedTemplate          // From template-parser.ts
  templateRaw: Record<string, any>  // Full parsed YAML (includes personaGeneration, etc.)
  templateSlug: string              // Convex slug
  answers: Record<string, unknown>  // User's wizard answers
  decisionTitle: string             // User-provided title
  decisionId: string                // Generated decision ID
  markdownPath: string              // Decision log path
  contextFiles: ContextFileInfo[]   // From Convex contextFiles table
}

interface ContextFileInfo {
  path: string
  originalFilename: string
  fileType: string
  detectedType?: string
  rows?: number
  columns?: string[]
  pages?: number
  sizeBytes: number
}

function generateExperimentConfig(input: ExperimentConfigInput): string
// Returns YAML string ready to write to disk
```

### Rust Command

The experiment config is written to disk via a Tauri command (reusing the file-write + git-commit pattern from Phase 1):

```rust
#[tauri::command]
#[specta::specta]
async fn write_experiment_config(
    project_path: String,
    filename: String,
    yaml_content: String,
) -> Result<String, String>
// Returns the relative file path on success
```

### Validation

Before writing, the generator validates:

1. All required configuration answers are present
2. Answer types match question types (number is number, etc.)
3. Template has valid `personaGeneration` with at least one archetype
4. Archetype counts sum to `personas.count`

Validation reuses the existing validators from `src/lib/config-validator.ts`.
