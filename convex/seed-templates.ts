import { internalMutation } from './_generated/server'

/**
 * Seed the database with 3 core experiment templates.
 * Idempotent: checks if templates exist before inserting.
 *
 * Run via: npx convex run seed:templates
 */
export default internalMutation({
  handler: async ctx => {
    const now = Date.now()

    // Template 1: Investor Evaluation
    const investorSlug = 'investor-evaluation'
    const existingInvestor = await ctx.db
      .query('experimentTemplates')
      .filter(q => q.eq(q.field('slug'), investorSlug))
      .first()

    if (!existingInvestor) {
      const investorId = await ctx.db.insert('experimentTemplates', {
        name: 'Investor Pitch Evaluation',
        slug: investorSlug,
        category: 'investor',
        description:
          'Test investor interest in your pitch with 10 realistic VC/angel personas',
        yamlContent: `# Template Metadata
id: investor-pitch-evaluation
version: 1.0
name: 'Investor Pitch Evaluation'
description: 'Test investor interest in your pitch with 10 realistic VC/angel personas'
category: investors
author: unheard-official
tags: [fundraising, seed, series-a, angels, vcs]

# Configuration Flow
configurationFlow:
  - id: stage
    question: 'What funding stage are you at?'
    type: select
    required: true
    options:
      - value: pre-seed
        label: 'Pre-seed ($100K-$500K)'
      - value: seed
        label: 'Seed ($500K-$2M)'
      - value: series-a
        label: 'Series A ($2M-$10M)'
    default: seed

  - id: funding_target
    question: 'How much are you raising?'
    type: number
    required: true
    unit: USD
    min: 100000
    max: 10000000
    default: 2000000

  - id: industry
    question: 'What industry are you in?'
    type: text
    required: true
    placeholder: 'e.g., developer tools, fintech, healthcare'

  - id: current_mrr
    question: "What's your current MRR?"
    type: number
    required: false
    unit: USD
    min: 0

  - id: pitch_summary
    question: 'Summarize your pitch (2-3 sentences)'
    type: textarea
    required: true
    placeholder: "We're building X to solve Y. We have Z traction..."
    maxLength: 500

# Persona Generation Config
personaGeneration:
  type: standard
  count: 10
  archetypes:
    - id: seed_vc_partner
      name: 'Seed VC Partner'
      count: 3
    - id: angel_investor
      name: 'Angel Investor'
      count: 3
    - id: series_a_vc_principal
      name: 'Series A VC Principal'
      count: 2
    - id: corporate_vc
      name: 'Corporate VC'
      count: 2`,
        version: '1.0',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      })
      console.log(`Seeded template: ${investorSlug} (ID: ${investorId})`)
    } else {
      console.log(`Template already exists: ${investorSlug}`)
    }

    // Template 2: Pricing Strategy
    const pricingSlug = 'pricing-strategy'
    const existingPricing = await ctx.db
      .query('experimentTemplates')
      .filter(q => q.eq(q.field('slug'), pricingSlug))
      .first()

    if (!existingPricing) {
      const pricingId = await ctx.db.insert('experimentTemplates', {
        name: 'Pricing Strategy Evaluation',
        slug: pricingSlug,
        category: 'pricing',
        description:
          'Test different pricing models with target customer personas to find optimal pricing',
        yamlContent: `# Template Metadata
id: pricing-strategy-evaluation
version: 1.0
name: 'Pricing Strategy Evaluation'
description: 'Test different pricing models with target customer personas'
category: pricing
author: unheard-official
tags: [pricing, monetization, saas, strategy]

# Configuration Flow
configurationFlow:
  - id: product_name
    question: 'What is your product called?'
    type: text
    required: true

  - id: product_description
    question: 'Describe your product briefly'
    type: textarea
    required: true
    placeholder: 'What problem does it solve? Key features?'
    maxLength: 300

  - id: pricing_models
    question: 'Which pricing models do you want to test?'
    type: multiselect
    required: true
    options:
      - value: freemium
        label: 'Freemium (free tier + paid)'
      - value: subscription
        label: 'Subscription (monthly/annual)'
      - value: usage-based
        label: 'Usage-based (pay per use)'
      - value: tiered
        label: 'Tiered (good/better/best)'

  - id: price_range_low
    question: 'Minimum price point to test?'
    type: number
    required: true
    unit: USD
    min: 0
    default: 10

  - id: price_range_high
    question: 'Maximum price point to test?'
    type: number
    required: true
    unit: USD
    min: 0
    default: 100

# Persona Generation Config
personaGeneration:
  type: fromContext
  count: 8
  archetypes:
    - id: price_sensitive
      name: 'Price-Sensitive Buyer'
      count: 3
    - id: value_buyer
      name: 'Value-Focused Buyer'
      count: 3
    - id: premium_buyer
      name: 'Premium Buyer'
      count: 2`,
        version: '1.0',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      })
      console.log(`Seeded template: ${pricingSlug} (ID: ${pricingId})`)
    } else {
      console.log(`Template already exists: ${pricingSlug}`)
    }

    // Template 3: Product Roadmap
    const roadmapSlug = 'product-roadmap'
    const existingRoadmap = await ctx.db
      .query('experimentTemplates')
      .filter(q => q.eq(q.field('slug'), roadmapSlug))
      .first()

    if (!existingRoadmap) {
      const roadmapId = await ctx.db.insert('experimentTemplates', {
        name: 'Product Roadmap Prioritization',
        slug: roadmapSlug,
        category: 'roadmap',
        description:
          'Get feedback from customer personas on which features to prioritize',
        yamlContent: `# Template Metadata
id: product-roadmap-prioritization
version: 1.0
name: 'Product Roadmap Prioritization'
description: 'Get feedback from customer personas on feature priorities'
category: roadmap
author: unheard-official
tags: [roadmap, features, prioritization, product]

# Configuration Flow
configurationFlow:
  - id: product_context
    question: 'What is your product?'
    type: textarea
    required: true
    placeholder: 'Brief description of your product and current state'
    maxLength: 300

  - id: feature_list
    question: 'List features to prioritize (one per line)'
    type: textarea
    required: true
    placeholder: |
      Feature 1: Advanced analytics
      Feature 2: Mobile app
      Feature 3: API access
      Feature 4: Custom integrations
    maxLength: 1000

  - id: timeframe
    question: 'What timeframe are you prioritizing for?'
    type: select
    required: true
    options:
      - value: next-month
        label: 'Next Month (sprint)'
      - value: next-quarter
        label: 'Next Quarter (3 months)'
      - value: next-year
        label: 'Next Year (annual planning)'
    default: next-quarter

  - id: user_segment
    question: 'Which user segment should we focus on?'
    type: text
    required: false
    placeholder: 'e.g., enterprise customers, SMBs, freemium users'

# Persona Generation Config
personaGeneration:
  type: fromContext
  count: 10
  archetypes:
    - id: power_user
      name: 'Power User'
      count: 3
    - id: casual_user
      name: 'Casual User'
      count: 3
    - id: enterprise_admin
      name: 'Enterprise Admin'
      count: 2
    - id: new_user
      name: 'New User'
      count: 2`,
        version: '1.0',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      })
      console.log(`Seeded template: ${roadmapSlug} (ID: ${roadmapId})`)
    } else {
      console.log(`Template already exists: ${roadmapSlug}`)
    }

    return {
      message: 'Template seeding complete',
      seeded: [
        existingInvestor ? null : investorSlug,
        existingPricing ? null : pricingSlug,
        existingRoadmap ? null : roadmapSlug,
      ].filter(Boolean),
    }
  },
})
