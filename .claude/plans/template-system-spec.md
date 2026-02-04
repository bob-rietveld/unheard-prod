# Template System Specification

**Date**: 2026-02-04
**Version**: 1.0
**Purpose**: Complete specification for template-driven decision support

---

## Overview

The template system is the **core innovation** of Unheard V2. It solves the fundamental problem: **founders don't know what parameters to configure**.

**Instead of**: "Configure 50 parameters for your experiment"
**We provide**: "I'm testing investor interest" → Template selected → 2 questions → Done

---

## Template Anatomy

### Complete Template Structure

```yaml
# Template Metadata
id: investor-pitch-evaluation
version: 1.0
name: "Investor Pitch Evaluation"
description: "Test investor interest in your pitch with 10 realistic VC/angel personas"
category: investors
author: unheard-official
tags: [fundraising, seed, series-a, angels, vcs]
created_at: 2026-02-04T00:00:00Z
updated_at: 2026-02-04T00:00:00Z

# Icon for UI
icon: "💰"

# Configuration Flow (questions to ask user)
configurationFlow:
  - id: stage
    question: "What funding stage are you at?"
    type: select
    required: true
    options:
      - value: pre-seed
        label: "Pre-seed ($100K-$500K)"
      - value: seed
        label: "Seed ($500K-$2M)"
      - value: series-a
        label: "Series A ($2M-$10M)"
    default: seed

  - id: funding_target
    question: "How much are you raising?"
    type: number
    required: true
    unit: USD
    min: 100000
    max: 10000000
    default: 2000000

  - id: industry
    question: "What industry are you in?"
    type: text
    required: true
    placeholder: "e.g., developer tools, fintech, healthcare"

  - id: current_mrr
    question: "What's your current MRR?"
    type: number
    required: false
    unit: USD
    min: 0

  - id: pitch_summary
    question: "Summarize your pitch (2-3 sentences)"
    type: textarea
    required: true
    placeholder: "We're building X to solve Y. We have Z traction..."
    maxLength: 500

# Context Requirements (what data is needed)
contextRequirements:
  required:
    - company_profile
  optional:
    - pitch_deck
    - financial_model
    - customer_data

# Persona Generation Config
personaGeneration:
  type: standard  # standard | fromContext | custom
  count: 10

  # Persona archetypes to generate
  archetypes:
    - id: seed_vc_partner
      name: "Seed VC Partner"
      count: 3
      description: "Partner at seed-stage VC fund ($50M-$200M)"
      characteristics:
        - "Invests in 10-15 companies per year"
        - "Looks for 100x potential"
        - "Cares about team, market, and traction"
        - "Risk-tolerant but data-driven"

    - id: angel_investor
      name: "Angel Investor"
      count: 3
      description: "Successful founder turned angel investor"
      characteristics:
        - "Writes $25K-$100K checks"
        - "Hands-on, provides mentorship"
        - "Invests in 5-10 companies per year"
        - "Pattern-matches to own experience"

    - id: series_a_vc_principal
      name: "Series A VC Principal"
      count: 2
      description: "Principal at growth-stage VC fund"
      characteristics:
        - "Looking for proven product-market fit"
        - "Needs $1M+ ARR typically"
        - "Focus on unit economics"
        - "More conservative than seed VCs"

    - id: corporate_vc
      name: "Corporate VC"
      count: 2
      description: "Corporate venture arm investor"
      characteristics:
        - "Strategic fit is critical"
        - "Slower decision process"
        - "Can provide distribution/partnerships"
        - "Risk-averse, needs board approval"

# Experiment Configuration
experiment:
  type: focus_group  # focus_group | survey | debate | scenario

  # Stimulus template (variables filled from config)
  stimulusTemplate: |
    You're evaluating {company_name} for investment.

    Stage: {stage}
    Raising: ${funding_target:,.0f}
    Industry: {industry}
    Current MRR: ${current_mrr:,.0f}

    Pitch:
    {pitch_summary}

    Based on your investment criteria and experience, what's your decision?

    Provide:
    1. Your investment decision (PASS, INTERESTED, or INVEST)
    2. Your reasoning (2-3 key points)
    3. Your biggest concern
    4. One question you'd ask the founders

  # Round configuration
  rounds:
    - id: initial_reaction
      name: "Initial Reaction"
      instructions: "Give your gut reaction based on the pitch"

    - id: deep_dive
      name: "Due Diligence Questions"
      instructions: "After hearing the founders' answers, what's your final decision?"
      dependsOn: initial_reaction

# Execution Configuration
execution:
  parallelization: true
  provider: modal  # modal | openai | anthropic
  model: qwen2.5:32b  # For Modal
  temperature: 0.7
  max_tokens: 500
  timeout: 60  # seconds

# Analysis Configuration
analysis:
  # What metrics to calculate
  metrics:
    - id: investment_rate
      name: "Investment Interest Rate"
      description: "% of investors interested or investing"
      calculation: "COUNT(decision IN ['INTERESTED', 'INVEST']) / TOTAL"

    - id: pass_rate
      name: "Pass Rate"
      calculation: "COUNT(decision = 'PASS') / TOTAL"

    - id: avg_sentiment
      name: "Average Sentiment"
      calculation: "AVG(sentiment_score)"

  # What insights to extract
  insights:
    - id: top_concerns
      name: "Top Concerns"
      description: "Most frequently mentioned concerns"
      extraction: "keyword_extraction"
      limit: 5

    - id: investor_type_breakdown
      name: "Interest by Investor Type"
      description: "Which investor types are most interested"
      groupBy: archetype

    - id: key_questions
      name: "Common Questions"
      description: "Questions investors would ask"
      extraction: "question_extraction"
      limit: 10

# Visualization Configuration
visualization:
  - type: gauge
    title: "Investment Interest"
    metric: investment_rate
    ranges:
      - min: 0
        max: 30
        color: red
        label: "Low Interest"
      - min: 30
        max: 60
        color: yellow
        label: "Moderate Interest"
      - min: 60
        max: 100
        color: green
        label: "High Interest"

  - type: bar_chart
    title: "Interest by Investor Type"
    metric: investor_type_breakdown

  - type: word_cloud
    title: "Top Concerns"
    metric: top_concerns

# Follow-up Suggestions
followUpSuggestions:
  - condition: "investment_rate < 30"
    suggestion: "Consider testing a different pitch angle or market positioning"

  - condition: "top_concerns contains 'market size'"
    suggestion: "Run follow-up: 'Market Size Validation' template"

  - condition: "series_a_vc_principal.pass_rate > 70"
    suggestion: "You may be too early for Series A investors. Focus on seed/angels."

# Export Configuration
export:
  formats: [markdown, pdf, json]
  includeRawData: true
  includePersonaDetails: true
```

---

## Core Templates

### 1. Investor Evaluation Template

**Purpose**: Test investor interest across different investor types

**Use Cases**:
- Should I raise from VCs or angels?
- Is my pitch resonating?
- What are the top concerns?
- Which investor type is most interested?

**Configuration Questions**:
1. Funding stage (pre-seed, seed, series A)
2. Funding target ($)
3. Industry
4. Current MRR
5. Pitch summary

**Personas**: 10 investors (3 seed VCs, 3 angels, 2 series A VCs, 2 corporate VCs)

**Output**:
- Investment interest rate
- Breakdown by investor type
- Top concerns
- Key questions investors would ask

---

### 2. Pricing Strategy Template

**Purpose**: Test pricing with target customers

**Use Cases**:
- Should we charge $50/mo or $100/mo?
- Freemium vs paid-only?
- Usage-based vs flat pricing?
- What price point maximizes revenue?

**Configuration Questions**:
1. Product description
2. Target customer type (SMB, mid-market, enterprise)
3. Pricing options to test (2-4 options)
4. Current pricing (if exists)
5. Cost structure

**Personas**: 15 customers (generated from uploaded customer data or standard archetypes)

**Output**:
- Willingness to pay breakdown
- Price sensitivity analysis
- Preferred pricing model
- Budget constraints by customer type

---

### 3. Product Roadmap Template

**Purpose**: Prioritize features based on customer demand

**Use Cases**:
- Which feature should we build next?
- What do customers care about most?
- Should we build X or Y first?
- Is this feature worth 3 months of eng time?

**Configuration Questions**:
1. Product overview
2. Features to evaluate (3-10 features)
3. Current roadmap context
4. Team capacity

**Personas**: 20 customers (from context data)

**Output**:
- Feature priority ranking
- Expected adoption by feature
- "Must-have" vs "nice-to-have"
- ROI estimate per feature

---

### 4. Hiring Decision Template

**Purpose**: Evaluate if a hire is right for the company

**Use Cases**:
- Should I hire this senior engineer?
- Technical co-founder vs first eng hire?
- Build internal team vs outsource?
- What's the hiring bar for this role?

**Configuration Questions**:
1. Role description
2. Candidate background (optional)
3. Team context
4. Stage of company
5. Hiring criteria

**Personas**: 8 stakeholders (team members, board members, advisors)

**Output**:
- Hire/no-hire sentiment
- Top concerns
- Key questions to ask candidate
- Onboarding recommendations

---

### 5. Operations Decision Template

**Purpose**: Decide on processes, tools, or operational changes

**Use Cases**:
- Should we switch to Slack from email?
- Remote-first vs office?
- Build internal tools vs buy?
- Outsource customer support?

**Configuration Questions**:
1. Decision description
2. Options to evaluate (2-5 options)
3. Team size and structure
4. Budget constraints

**Personas**: 10 team members (various roles)

**Output**:
- Preferred option by role
- Implementation concerns
- Change management needs
- ROI analysis

---

## Template Lifecycle

### 1. Template Creation

```typescript
// Official templates (Unheard team)
const template = await convex.mutation(api.templates.create, {
  ...templateData,
  status: 'official',
  author: 'unheard-team'
})

// User-created templates (fork existing)
const customTemplate = await convex.mutation(api.templates.fork, {
  sourceTemplateId: 'investor-pitch-evaluation',
  customizations: {
    name: 'Investor Pitch - Healthcare Focus',
    personaGeneration: {
      ...existing,
      archetypes: addHealthcareVCs(existing.archetypes)
    }
  }
})
```

### 2. Template Discovery

```typescript
// Agent recommends template based on conversation
const recommended = await agent.selectTemplate(userInput: "I need to decide if I should raise seed or bootstrap")

// Agent reasoning:
// "Based on your question about fundraising, I recommend the
//  'Investor Evaluation' template. This will help you test investor
//  interest and understand if raising is viable."
```

### 3. Template Configuration

```typescript
// Agent guides user through configuration
for (const step of template.configurationFlow) {
  const answer = await agent.ask(step.question, step.options)
  config[step.id] = answer
}

// Validation
const validated = validateConfig(config, template)
```

### 4. Template Execution

```typescript
// Generate experiment config from template
const experimentConfig = await generateExperimentConfig(template, config, context)

// Execute on Modal
const results = await modal.invoke('experiment-runner', experimentConfig)

// Analyze results
const insights = await analyzeResults(results, template.analysis)
```

### 5. Template Evolution

```typescript
// User feedback improves templates
await convex.mutation(api.templates.recordUsage, {
  templateId,
  experimentId,
  feedback: {
    helpful: true,
    suggestions: "Add more technical investor personas"
  }
})

// Template versioning
await convex.mutation(api.templates.updateVersion, {
  templateId,
  changes: {
    personaGeneration: {
      archetypes: [...existing, technicalInvestor]
    }
  },
  version: '1.1.0'
})
```

---

## Template Storage (Convex)

```typescript
// convex/schema.ts

export default defineSchema({
  templates: defineTable({
    id: v.string(),
    version: v.string(),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    author: v.string(),
    status: v.union(
      v.literal('official'),
      v.literal('community'),
      v.literal('private')
    ),

    // Template configuration
    configurationFlow: v.array(v.any()),
    contextRequirements: v.any(),
    personaGeneration: v.any(),
    experiment: v.any(),
    execution: v.any(),
    analysis: v.any(),
    visualization: v.any(),

    // Metadata
    usageCount: v.number(),
    rating: v.optional(v.number()),
    tags: v.array(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_category', ['category'])
    .index('by_author', ['author'])
    .index('by_status', ['status']),

  userTemplates: defineTable({
    userId: v.id('users'),
    templateId: v.id('templates'),
    forkedFrom: v.optional(v.id('templates')),
    customizations: v.any(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_template', ['templateId']),
})
```

---

## UI Components

### Template Selector

```tsx
function TemplateSelector({ onSelect }) {
  const templates = useQuery(api.templates.list, {
    category: selectedCategory
  })

  return (
    <div className="grid grid-cols-3 gap-4">
      {templates?.map(template => (
        <TemplateCard
          key={template._id}
          template={template}
          onClick={() => onSelect(template)}
        />
      ))}
    </div>
  )
}

function TemplateCard({ template }) {
  return (
    <Card>
      <CardHeader>
        <div className="text-4xl mb-2">{template.icon}</div>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{template.usageCount} uses</span>
        </div>
        {template.status === 'official' && (
          <Badge variant="secondary">Official</Badge>
        )}
      </CardContent>
    </Card>
  )
}
```

### Template Configuration

```tsx
function TemplateConfiguration({ template, onComplete }) {
  const [config, setConfig] = useState({})
  const [currentStep, setCurrentStep] = useState(0)

  const step = template.configurationFlow[currentStep]

  return (
    <div className="space-y-6">
      <Progress value={(currentStep / template.configurationFlow.length) * 100} />

      <ConfigurationStep
        step={step}
        value={config[step.id]}
        onChange={(value) => {
          setConfig({ ...config, [step.id]: value })
        }}
      />

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep === 0}
        >
          Back
        </Button>

        {currentStep === template.configurationFlow.length - 1 ? (
          <Button onClick={() => onComplete(config)}>
            Run Experiment
          </Button>
        ) : (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  )
}
```

---

## Template Marketplace (Future)

### Community Templates

Allow users to publish and share templates:

```typescript
// Publish template to marketplace
await convex.mutation(api.templates.publish, {
  templateId,
  status: 'community',
  pricing: {
    type: 'free' // or 'paid'
  }
})

// Install community template
await convex.mutation(api.templates.install, {
  templateId: 'community-saas-pricing-v2',
  userId
})
```

### Template Analytics

Track template effectiveness:

```typescript
interface TemplateAnalytics {
  usageCount: number
  averageRating: number
  successRate: number // % experiments that led to decisions
  avgConfigTime: number // seconds
  avgExecutionTime: number // seconds
}
```

---

## Benefits of Template System

### For Users

1. **Fast Setup**: 2 minutes vs 30 minutes
2. **Best Practices**: Expert knowledge encoded
3. **Consistent Results**: Reproducible experiments
4. **Easy Sharing**: "Use this template"
5. **Learning**: Templates teach decision-making

### For Platform

1. **Network Effects**: More usage → better templates
2. **Reduced Support**: Self-service via templates
3. **Viral Growth**: "Try this template" sharing
4. **Marketplace**: Revenue from premium templates
5. **Data Insights**: Aggregate learnings across users

---

## Implementation Checklist

### Phase 1: Core Templates (Week 3)
- [ ] Template data structure (Convex schema)
- [ ] 3 official templates (Investors, Pricing, Hiring)
- [ ] Template selector UI
- [ ] Template configuration wizard

### Phase 2: Execution (Week 4-6)
- [ ] Template → experiment config generator
- [ ] Variable substitution
- [ ] Persona generation from template
- [ ] Results analysis per template

### Phase 3: Customization (Week 7)
- [ ] Fork template feature
- [ ] Custom template editor
- [ ] Save user templates
- [ ] Template versioning

### Phase 4: Marketplace (Post-MVP)
- [ ] Community templates
- [ ] Template ratings/reviews
- [ ] Template analytics
- [ ] Paid templates (optional)

---

## Conclusion

The template system is **the key to product-market fit**. It solves the core problem: making experimentation accessible to founders who don't know what to configure.

**Next**: See `vertical-slice-implementation.md` Phase 2 for detailed implementation plan.
