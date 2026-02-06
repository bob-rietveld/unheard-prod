> **LEGACY DOCUMENT** - This references superseded architecture (Electron/Mastra/GPT-4o). See README.md for current architecture.

# Dataset Extraction System Specification

## From Unstructured Responses to AutoDS-Ready Datasets

**Date**: 2026-01-29
**Version**: 1.0
**Purpose**: Complete specification for extracting structured datasets from experiment responses with full observability

---

## Table of Contents

1. [Overview & Problem Statement](#1-overview--problem-statement)
2. [Extractor Types](#2-extractor-types)
3. [Semantic Similarity Rating (SSR)](#3-semantic-similarity-rating-ssr)
4. [Observability & Validation](#4-observability--validation)
5. [Implementation Architecture](#5-implementation-architecture)
6. [Quality Metrics](#6-quality-metrics)
7. [AutoDS Integration](#7-autods-integration)

---

## 1. Overview & Problem Statement

### 1.1 The Gap

**Current State**:

```
Experiment runs → 30 text responses collected
  ↓
  ??? (MISSING TRANSFORMATION)
  ↓
AutoDS expects: Structured dataset (CSV/DataFrame)
```

**Problem**: Text responses like _"I'd pay $50 if it included analytics"_ need to become structured data like `{willingness_to_pay: true, max_price: 50, required_features: ["analytics"]}`

### 1.2 Requirements

1. **Multiple Extractor Types**
   - Survey-type: Rating scales, multiple choice, Likert responses
   - Conversation-type: Free-form discussion, qualitative insights
   - Hybrid: Mixed survey + conversation

2. **Quality & Observability**
   - Validate extraction accuracy
   - Track confidence scores
   - Monitor distributional similarity
   - Alert on poor extractions

3. **AutoDS Compatibility**
   - Output must be analyzable (numeric + categorical columns)
   - Sufficient variance for statistical tests
   - No missing data in critical fields
   - Documented schema

---

## 2. Extractor Types

### 2.1 Architecture: Strategy Pattern

```typescript
interface DatasetExtractor {
  supports(experimentType: string): boolean
  extract(responses: Response[], personas: Persona[]): Promise<Dataset>
  validate(dataset: Dataset): ValidationResult
  getObservability(): ExtractionMetrics
}

class ExtractorFactory {
  static create(
    experimentType: string,
    hypothesis: Hypothesis
  ): DatasetExtractor {
    // Select appropriate extractor
    if (experimentType === 'survey') return new SurveyExtractor()
    if (experimentType === 'focus_group') return new ConversationExtractor()
    if (experimentType === 'ab_test') return new ABTestExtractor()
    return new HybridExtractor()
  }
}
```

### 2.2 Extractor Type 1: Survey Extractor (SSR Method)

**Use Case**: Experiments that ask rating/scale questions

**Example Stimulus**:

```
"Rate your interest in feature X on a scale of 1-10"
"How likely are you to recommend this product? (1-5)"
```

**Method**: Semantic Similarity Rating (from paper)

```typescript
class SurveyExtractor implements DatasetExtractor {
  private embedder: EmbeddingService

  supports(experimentType: string): boolean {
    return experimentType === 'survey' || experimentType === 'ab_test'
  }

  async extract(responses: Response[], personas: Persona[]): Promise<Dataset> {
    // 1. Define reference statements (Likert anchors)
    const referenceStatements = this.createReferenceStatements()

    // 2. Embed all responses and references
    const responseEmbeddings = await this.embedResponses(responses)
    const referenceEmbeddings = await this.embedReferences(referenceStatements)

    // 3. Calculate similarity scores (SSR method)
    const records = responses.map((response, i) => {
      const embedding = responseEmbeddings[i]
      const scores = this.calculateSimilarityScores(
        embedding,
        referenceEmbeddings
      )
      const likertRating = this.scoreToLikert(scores)

      return {
        personaId: response.personaId,
        personaName: response.personaName,
        ...this.getPersonaDemographics(response.personaId, personas),

        // SSR outputs
        rating: likertRating.value, // 1-5 Likert scale
        confidence: likertRating.confidence, // How confident
        distribution: scores, // Full probability distribution

        // Original response
        responseText: response.response,
        sentiment: response.sentiment,
        round: response.round,
      }
    })

    // 4. Validate extraction quality
    const validation = this.validateExtraction(records, responses)

    return {
      records,
      csv: this.toCSV(records),
      json: JSON.stringify(records, null, 2),
      dataframeCode: this.toDataFrameCode(records),
      schema: this.getSchema(),
      stats: this.calculateStats(records),
      validation,
      extractionMethod: 'ssr',
      extractionMetrics: this.getMetrics(),
    }
  }

  /**
   * Create reference statements for Likert scale
   * Following paper's approach: 6 different anchor sets, averaged
   */
  private createReferenceStatements(): ReferenceSet[] {
    // Reference set 1: Direct rating language
    const set1 = {
      1: 'I strongly disagree with this',
      2: 'I somewhat disagree with this',
      3: "I'm neutral about this",
      4: 'I somewhat agree with this',
      5: 'I strongly agree with this',
    }

    // Reference set 2: Intent language
    const set2 = {
      1: 'I would never use this',
      2: "I probably won't use this",
      3: 'I might use this',
      4: 'I would probably use this',
      5: 'I would definitely use this',
    }

    // Reference set 3: Interest language
    const set3 = {
      1: 'I have no interest in this',
      2: 'I have little interest in this',
      3: 'I have some interest in this',
      4: 'I have significant interest in this',
      5: 'I have very high interest in this',
    }

    // Reference set 4: Value language (for pricing)
    const set4 = {
      1: 'This has no value to me',
      2: 'This has little value to me',
      3: 'This has moderate value to me',
      4: 'This has good value to me',
      5: 'This has excellent value to me',
    }

    // Reference set 5: Likelihood language
    const set5 = {
      1: 'Extremely unlikely',
      2: 'Unlikely',
      3: 'Neutral',
      4: 'Likely',
      5: 'Extremely likely',
    }

    // Reference set 6: Satisfaction language
    const set6 = {
      1: 'Very dissatisfied',
      2: 'Dissatisfied',
      3: 'Neither satisfied nor dissatisfied',
      4: 'Satisfied',
      5: 'Very satisfied',
    }

    return [set1, set2, set3, set4, set5, set6]
  }

  /**
   * Calculate semantic similarity scores (cosine similarity)
   */
  private calculateSimilarityScores(
    responseEmbedding: number[],
    referenceEmbeddings: Map<number, number[][]> // Likert value → multiple reference embeddings
  ): LikertDistribution {
    const scores: Record<number, number> = {}

    // For each Likert point (1-5)
    for (let likert = 1; likert <= 5; likert++) {
      const refEmbeddings = referenceEmbeddings.get(likert) || []

      // Average similarity across all reference sets
      const similarities = refEmbeddings.map(refEmb =>
        this.cosineSimilarity(responseEmbedding, refEmb)
      )

      scores[likert] =
        similarities.reduce((a, b) => a + b, 0) / similarities.length
    }

    // Normalize to probability distribution
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const distribution = Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, v / total])
    )

    return distribution
  }

  /**
   * Convert probability distribution to single Likert value
   */
  private scoreToLikert(distribution: LikertDistribution): {
    value: number
    confidence: number
  } {
    // Find mode (most likely value)
    const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1])
    const mostLikely = parseInt(entries[0][0])
    const confidence = entries[0][1] // Probability of most likely value

    return { value: mostLikely, confidence }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magA * magB)
  }

  /**
   * Validate extraction quality (from paper)
   */
  private validateExtraction(
    records: ExtractedRecord[],
    originalResponses: Response[]
  ): ValidationResult {
    const metrics = {
      avgConfidence:
        records.reduce((sum, r) => sum + r.confidence, 0) / records.length,
      lowConfidenceCount: records.filter(r => r.confidence < 0.5).length,
      distributionalSpread: this.calculateSpread(records),
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Flag low confidence extractions
    if (metrics.avgConfidence < 0.6) {
      errors.push(
        `Low average confidence: ${metrics.avgConfidence.toFixed(2)} (expect >0.6)`
      )
    }

    if (metrics.lowConfidenceCount > records.length * 0.2) {
      warnings.push(
        `${metrics.lowConfidenceCount} responses have low confidence (<0.5)`
      )
    }

    // Check for distribution skew
    if (metrics.distributionalSpread < 0.3) {
      warnings.push(
        'Responses show little variance - dataset may not be informative'
      )
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: this.generateSuggestions(metrics),
      quality: {
        confidence: metrics.avgConfidence,
        coverage: 1 - metrics.lowConfidenceCount / records.length,
        variance: metrics.distributionalSpread,
      },
    }
  }

  private calculateSpread(records: ExtractedRecord[]): number {
    const ratings = records.map(r => r.rating)
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length
    const variance =
      ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      ratings.length
    return Math.sqrt(variance)
  }
}
```

### 2.3 Extractor Type 2: Conversation Extractor

**Use Case**: Focus groups, interviews, open-ended discussions

**Example Stimulus**:

```
"Discuss your thoughts on this product"
"What features matter most to you and why?"
```

**Method**: LLM-based structured extraction with validation

```typescript
class ConversationExtractor implements DatasetExtractor {
  private llm: any

  supports(experimentType: string): boolean {
    return experimentType === 'focus_group' || experimentType === 'interview'
  }

  async extract(responses: Response[], personas: Persona[]): Promise<Dataset> {
    // 1. Infer extraction schema from conversation content
    const schema = await this.inferSchemaFromConversation(responses)

    // 2. Extract structured data with LLM
    const records = await this.extractWithLLM(responses, personas, schema)

    // 3. Validate extraction
    const validation = this.validateExtraction(records, responses, schema)

    // 4. Human-in-the-loop validation for low confidence
    const validated = await this.reviewLowConfidence(records, validation)

    return {
      records: validated,
      csv: this.toCSV(validated),
      json: JSON.stringify(validated, null, 2),
      dataframeCode: this.toDataFrameCode(validated),
      schema,
      stats: this.calculateStats(validated),
      validation,
      extractionMethod: 'llm_structured',
      extractionMetrics: this.getMetrics(),
    }
  }

  /**
   * Infer what data to extract from conversation content
   */
  private async inferSchemaFromConversation(
    responses: Response[]
  ): Promise<ExtractionSchema> {
    // Analyze first 5 responses to determine common themes
    const sampleResponses = responses.slice(0, 5)

    const prompt = `
Analyze these conversation responses and determine what structured data should be extracted:

${sampleResponses.map((r, i) => `${i + 1}. "${r.response}"`).join('\n')}

What specific, measurable data points appear across responses?
Consider:
- Themes mentioned repeatedly
- Numerical values mentioned
- Categories or choices mentioned
- Sentiment indicators

Return JSON:
{
  "fields": [
    { "name": "field_name", "type": "boolean|number|string|array<string>|categorical", "description": "...", "possibleValues": [...] }
  ]
}
`

    const result = await this.llm.generate(prompt, { format: 'json' })
    const schemaData = JSON.parse(result)

    return {
      experimentType: 'conversation',
      hypothesisCategory: 'qualitative',
      fields: schemaData.fields,
    }
  }

  /**
   * Extract with confidence tracking
   */
  private async extractWithLLM(
    responses: Response[],
    personas: Persona[],
    schema: ExtractionSchema
  ): Promise<ExtractedRecordWithConfidence[]> {
    const records: ExtractedRecordWithConfidence[] = []

    // Process in batches
    for (let i = 0; i < responses.length; i += 5) {
      const batch = responses.slice(i, i + 5)

      const prompt = this.buildExtractionPrompt(batch, personas, schema)

      const result = await this.llm.generate(prompt, {
        format: 'json',
        temperature: 0.1, // Low temperature for consistent extraction
      })

      const extracted = JSON.parse(result)

      // Add field-level confidence scores
      const withConfidence = await this.calculateFieldConfidence(
        extracted,
        batch
      )
      records.push(...withConfidence)
    }

    return records
  }

  /**
   * Calculate confidence score for each extracted field
   */
  private async calculateFieldConfidence(
    extractedRecords: any[],
    originalResponses: Response[]
  ): Promise<ExtractedRecordWithConfidence[]> {
    return extractedRecords.map((record, i) => {
      const original = originalResponses[i]

      // For each field, calculate confidence
      const fieldConfidence: Record<string, number> = {}

      Object.keys(record).forEach(field => {
        if (['personaId', 'round', 'sentiment'].includes(field)) {
          fieldConfidence[field] = 1.0 // Metadata fields always confident
        } else {
          // Confidence based on: value is not null, value is mentioned in text
          const value = record[field]
          const mentioned = this.isValueMentionedInText(
            value,
            original.response
          )

          if (value === null) {
            fieldConfidence[field] = 0.0
          } else if (mentioned) {
            fieldConfidence[field] = 0.9
          } else {
            fieldConfidence[field] = 0.3 // Inferred, not explicit
          }
        }
      })

      // Overall record confidence: average of field confidences
      const overallConfidence =
        Object.values(fieldConfidence).reduce((a, b) => a + b, 0) /
        Object.keys(fieldConfidence).length

      return {
        ...record,
        _fieldConfidence: fieldConfidence,
        _overallConfidence: overallConfidence,
      }
    })
  }

  private isValueMentionedInText(value: any, text: string): boolean {
    if (value === null || value === undefined) return false

    const lowerText = text.toLowerCase()

    if (typeof value === 'boolean') {
      // Check for yes/no, agree/disagree, etc.
      const positiveWords = ['yes', 'agree', 'will', 'would', 'definitely']
      const negativeWords = ['no', 'disagree', "won't", "wouldn't", 'never']

      if (value === true) {
        return positiveWords.some(word => lowerText.includes(word))
      } else {
        return negativeWords.some(word => lowerText.includes(word))
      }
    }

    if (typeof value === 'number') {
      // Check if number appears in text
      return lowerText.includes(value.toString())
    }

    if (typeof value === 'string') {
      // Check if string/phrase appears in text
      return lowerText.includes(value.toLowerCase())
    }

    if (Array.isArray(value)) {
      // Check if any array element appears
      return value.some(v => lowerText.includes(v.toLowerCase()))
    }

    return false
  }

  /**
   * Review and correct low-confidence extractions
   */
  private async reviewLowConfidence(
    records: ExtractedRecordWithConfidence[],
    validation: ValidationResult
  ): Promise<ExtractedRecord[]> {
    const lowConfidenceRecords = records.filter(r => r._overallConfidence < 0.6)

    if (lowConfidenceRecords.length === 0) {
      // All good, return as-is
      return records.map(r => this.removeConfidenceFields(r))
    }

    console.warn(
      `⚠️  ${lowConfidenceRecords.length} records have low confidence`
    )

    // Re-extract low confidence records with better prompt
    const reExtracted = await this.reExtractWithContext(lowConfidenceRecords)

    // Merge back
    const finalRecords = records.map(record => {
      const reExtractedVersion = reExtracted.find(
        r => r.personaId === record.personaId
      )
      return reExtractedVersion || record
    })

    return finalRecords.map(r => this.removeConfidenceFields(r))
  }

  private removeConfidenceFields(record: any): ExtractedRecord {
    const { _fieldConfidence, _overallConfidence, ...cleanRecord } = record
    return cleanRecord
  }
}
```

### 2.4 Extractor Type 3: Hybrid Extractor

**Use Case**: Experiments with both quantitative (ratings) and qualitative (discussion) components

```typescript
class HybridExtractor implements DatasetExtractor {
  private surveyExtractor: SurveyExtractor
  private conversationExtractor: ConversationExtractor

  async extract(responses: Response[], personas: Persona[]): Promise<Dataset> {
    // 1. Extract quantitative data (SSR method)
    const quantitative = await this.surveyExtractor.extract(responses, personas)

    // 2. Extract qualitative themes (LLM method)
    const qualitative = await this.conversationExtractor.extract(
      responses,
      personas
    )

    // 3. Merge both datasets
    const merged = this.mergeDatasets(quantitative, qualitative)

    return merged
  }

  private mergeDatasets(quant: Dataset, qual: Dataset): Dataset {
    // Merge records by personaId
    const merged = quant.records.map((quantRecord, i) => {
      const qualRecord = qual.records[i]
      return {
        ...quantRecord,
        ...qualRecord,
        // Avoid duplicate fields
        personaId: quantRecord.personaId,
        personaName: quantRecord.personaName,
      }
    })

    return {
      records: merged,
      csv: this.toCSV(merged),
      json: JSON.stringify(merged, null, 2),
      dataframeCode: this.toDataFrameCode(merged),
      schema: this.mergeSchemas(quant.schema, qual.schema),
      stats: this.calculateStats(merged),
      validation: this.mergeValidations(quant.validation, qual.validation),
      extractionMethod: 'hybrid',
    }
  }
}
```

---

## 3. Semantic Similarity Rating (SSR) Implementation

### 3.1 Complete SSR Pipeline

```typescript
// src/extraction/ssr-extractor.ts

import { EmbeddingService } from '../llm/providers/embedder'

export interface SSRConfig {
  referenceSets: ReferenceSet[]
  scale: 'likert-5' | 'likert-7' | 'nps'
  epsilon?: number // Temperature parameter (default: 0.1)
  tau?: number // Spread parameter (default: 1.0)
}

export interface ReferenceSet {
  [rating: number]: string // e.g., { 1: "Strongly disagree", ..., 5: "Strongly agree" }
}

export interface LikertDistribution {
  [rating: number]: number // Probability distribution
}

export class SSRExtractor {
  private embedder: EmbeddingService

  constructor(embedder: EmbeddingService) {
    this.embedder = embedder
  }

  /**
   * Extract Likert ratings using Semantic Similarity Rating
   */
  async extractRatings(
    responses: string[],
    config: SSRConfig
  ): Promise<
    Array<{
      rating: number
      confidence: number
      distribution: LikertDistribution
    }>
  > {
    // 1. Embed all responses
    const responseEmbeddings = await this.embedder.embed(responses)

    // 2. Embed all reference statements (cached for efficiency)
    const referenceEmbeddings = await this.embedReferences(config.referenceSets)

    // 3. For each response, calculate similarity to all references
    return responseEmbeddings.map((responseEmb, i) => {
      const distribution = this.calculateSSR(
        responseEmb,
        referenceEmbeddings,
        config
      )
      const { rating, confidence } = this.distributionToRating(distribution)

      return {
        rating,
        confidence,
        distribution,
        responseText: responses[i],
      }
    })
  }

  /**
   * Core SSR algorithm (from paper)
   */
  private calculateSSR(
    responseEmbedding: number[],
    referenceEmbeddings: Map<number, number[][]>,
    config: SSRConfig
  ): LikertDistribution {
    const { epsilon = 0.1, tau = 1.0 } = config
    const rawScores: Record<number, number> = {}

    // Calculate similarity for each Likert point
    for (const [rating, refEmbeddings] of referenceEmbeddings.entries()) {
      // Average across multiple reference statements
      const similarities = refEmbeddings.map(refEmb =>
        this.cosineSimilarity(responseEmbedding, refEmb)
      )
      const avgSimilarity =
        similarities.reduce((a, b) => a + b, 0) / similarities.length

      rawScores[rating] = avgSimilarity
    }

    // Apply temperature and normalize (from paper formula)
    const adjusted: Record<number, number> = {}
    for (const [rating, score] of Object.entries(rawScores)) {
      adjusted[parseInt(rating)] = Math.exp((score - epsilon) / tau)
    }

    const total = Object.values(adjusted).reduce((a, b) => a + b, 0)
    const distribution: LikertDistribution = {}
    for (const [rating, score] of Object.entries(adjusted)) {
      distribution[parseInt(rating)] = score / total
    }

    return distribution
  }

  private async embedReferences(
    referenceSets: ReferenceSet[]
  ): Promise<Map<number, number[][]>> {
    const map = new Map<number, number[][]>()

    // Get all unique ratings (e.g., 1-5)
    const ratings = [
      ...new Set(referenceSets.flatMap(set => Object.keys(set).map(Number))),
    ]

    for (const rating of ratings) {
      // Get all reference statements for this rating across all sets
      const statements = referenceSets.map(set => set[rating]).filter(Boolean)

      // Embed all statements
      const embeddings = await this.embedder.embed(statements)
      map.set(rating, embeddings)
    }

    return map
  }

  private distributionToRating(distribution: LikertDistribution): {
    rating: number
    confidence: number
  } {
    const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1])
    const mostLikely = parseInt(entries[0][0])
    const probability = entries[0][1]

    return {
      rating: mostLikely,
      confidence: probability,
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magA * magB)
  }
}
```

---

## 4. Observability & Validation Layer

### 4.1 Extraction Monitoring

```typescript
// src/extraction/observability.ts

export interface ExtractionMetrics {
  // Extraction process
  totalResponses: number
  successfulExtractions: number
  failedExtractions: number
  extractionTimeMs: number

  // Quality metrics
  avgConfidence: number
  minConfidence: number
  maxConfidence: number
  lowConfidenceCount: number // confidence < 0.5

  // Distribution metrics (for SSR)
  distributionalKSDistance?: number // Kolmogorov-Smirnov distance
  correlationAttainment?: number // % of maximum correlation achieved

  // Field-level metrics
  fieldExtractionRates: Record<string, number> // % successfully extracted per field
  fieldConfidenceScores: Record<string, number> // Avg confidence per field

  // Validation
  validRecords: number
  invalidRecords: number
  warningCount: number

  // LLM usage
  llmCalls: number
  llmCost: number
  llmTokens: number
}

export class ExtractionMonitor {
  private metrics: ExtractionMetrics
  private events: ExtractionEvent[] = []

  constructor() {
    this.metrics = this.initializeMetrics()
  }

  /**
   * Track extraction event
   */
  logEvent(event: ExtractionEvent) {
    this.events.push({
      ...event,
      timestamp: Date.now(),
    })

    // Update metrics
    this.updateMetrics(event)
  }

  /**
   * Get current metrics
   */
  getMetrics(): ExtractionMetrics {
    return { ...this.metrics }
  }

  /**
   * Generate extraction quality report
   */
  generateReport(): ExtractionReport {
    return {
      summary: {
        totalRecords: this.metrics.totalResponses,
        successRate:
          this.metrics.successfulExtractions / this.metrics.totalResponses,
        avgConfidence: this.metrics.avgConfidence,
        quality: this.assessQuality(),
      },
      details: {
        fieldMetrics: this.getFieldMetrics(),
        lowConfidenceRecords: this.findLowConfidenceRecords(),
        suggestions: this.generateImprovementSuggestions(),
      },
      timeline: this.getEventTimeline(),
    }
  }

  private assessQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const { avgConfidence, validRecords, totalResponses } = this.metrics
    const validRate = validRecords / totalResponses

    if (avgConfidence > 0.8 && validRate > 0.95) return 'excellent'
    if (avgConfidence > 0.6 && validRate > 0.85) return 'good'
    if (avgConfidence > 0.4 && validRate > 0.7) return 'fair'
    return 'poor'
  }

  /**
   * Find problematic extractions for human review
   */
  private findLowConfidenceRecords(): Array<{
    recordId: string
    confidence: number
    issues: string[]
  }> {
    return this.events
      .filter(e => e.type === 'extraction_complete' && e.confidence < 0.5)
      .map(e => ({
        recordId: e.recordId!,
        confidence: e.confidence!,
        issues: e.issues || [],
      }))
  }

  /**
   * Generate suggestions for improving extraction
   */
  private generateImprovementSuggestions(): string[] {
    const suggestions: string[] = []

    // Low confidence suggestions
    if (this.metrics.avgConfidence < 0.6) {
      suggestions.push('Consider using SSR method for survey-type questions')
      suggestions.push('Add more specific extraction fields to schema')
      suggestions.push(
        'Improve stimulus clarity to get more structured responses'
      )
    }

    // High null rate suggestions
    const highNullFields = Object.entries(this.metrics.fieldExtractionRates)
      .filter(([_, rate]) => rate < 0.5)
      .map(([field, _]) => field)

    if (highNullFields.length > 0) {
      suggestions.push(
        `Fields with low extraction: ${highNullFields.join(', ')}`
      )
      suggestions.push('Consider making these fields optional or removing them')
    }

    // Variance suggestions
    if (
      this.metrics.distributionalKSDistance &&
      this.metrics.distributionalKSDistance > 0.3
    ) {
      suggestions.push(
        'High distributional distance - responses may not match expected pattern'
      )
    }

    return suggestions
  }
}

export interface ExtractionEvent {
  type: 'extraction_start' | 'extraction_complete' | 'validation_run' | 'error'
  timestamp: number
  recordId?: string
  confidence?: number
  issues?: string[]
  metadata?: any
}

export interface ExtractionReport {
  summary: {
    totalRecords: number
    successRate: number
    avgConfidence: number
    quality: 'excellent' | 'good' | 'fair' | 'poor'
  }
  details: {
    fieldMetrics: Record<string, any>
    lowConfidenceRecords: Array<{
      recordId: string
      confidence: number
      issues: string[]
    }>
    suggestions: string[]
  }
  timeline: ExtractionEvent[]
}
```

### 4.2 Real-Time Observability UI

```typescript
// renderer/src/components/extraction/ExtractionMonitor.tsx

function ExtractionMonitor({ experimentId }: { experimentId: string }) {
  const [metrics, setMetrics] = useState<ExtractionMetrics | null>(null);

  useEffect(() => {
    // Listen for extraction progress
    window.electronAPI.onExtractionProgress((data: ExtractionMetrics) => {
      setMetrics(data);
    });
  }, [experimentId]);

  if (!metrics) return <div>Extracting dataset...</div>;

  return (
    <div className="extraction-monitor">
      <h3>Dataset Extraction Progress</h3>

      {/* Progress */}
      <div className="progress">
        <ProgressBar
          value={metrics.successfulExtractions}
          max={metrics.totalResponses}
          label={`${metrics.successfulExtractions}/${metrics.totalResponses} responses processed`}
        />
      </div>

      {/* Quality Metrics */}
      <div className="quality-metrics">
        <MetricCard
          label="Avg Confidence"
          value={`${(metrics.avgConfidence * 100).toFixed(0)}%`}
          status={metrics.avgConfidence > 0.7 ? 'good' : metrics.avgConfidence > 0.5 ? 'warning' : 'error'}
        />
        <MetricCard
          label="Valid Records"
          value={`${metrics.validRecords}/${metrics.totalResponses}`}
          status={metrics.validRecords === metrics.totalResponses ? 'good' : 'warning'}
        />
        <MetricCard
          label="Warnings"
          value={metrics.warningCount}
          status={metrics.warningCount === 0 ? 'good' : 'warning'}
        />
      </div>

      {/* Field-Level Quality */}
      <div className="field-quality">
        <h4>Field Extraction Quality</h4>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Extraction Rate</th>
              <th>Avg Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(metrics.fieldExtractionRates).map(([field, rate]) => (
              <tr key={field}>
                <td>{field}</td>
                <td>{(rate * 100).toFixed(0)}%</td>
                <td>{(metrics.fieldConfidenceScores[field] * 100).toFixed(0)}%</td>
                <td>
                  {rate > 0.8 ? '✅' : rate > 0.5 ? '⚠️' : '❌'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Low Confidence Records (for review) */}
      {metrics.lowConfidenceCount > 0 && (
        <Alert variant="warning">
          <AlertTitle>Low Confidence Extractions</AlertTitle>
          <AlertDescription>
            {metrics.lowConfidenceCount} records have confidence below 50%.
            <Button onClick={() => openReviewDialog()}>Review & Correct</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Suggestions */}
      {metrics.warnings.length > 0 && (
        <div className="suggestions">
          <h4>Improvement Suggestions</h4>
          <ul>
            {metrics.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 5. Updated Experiment Flow (Complete)

````
┌────────────────────────────────────────────────────────────┐
│  STEP 1: EXPERIMENT EXECUTION                               │
└────────────────────────────────────────────────────────────┘
10 personas × 3 rounds = 30 responses (text)

┌────────────────────────────────────────────────────────────┐
│  STEP 2: EXTRACTION TYPE SELECTION                         │
└────────────────────────────────────────────────────────────┘
System determines experiment type:
  - Survey → Use SSR Extractor
  - Focus Group → Use Conversation Extractor
  - A/B Test → Use Hybrid Extractor

┌────────────────────────────────────────────────────────────┐
│  STEP 3: DATASET EXTRACTION (WITH OBSERVABILITY)           │
└────────────────────────────────────────────────────────────┘
ExtractionMonitor starts
  ↓
For each response:
  - Extract structured fields
  - Calculate field-level confidence
  - Log extraction event
  - Update UI progress
  ↓
UI shows:
  "Extracting... 25/30 responses processed
   Avg confidence: 82%
   3 warnings"

┌────────────────────────────────────────────────────────────┐
│  STEP 4: VALIDATION & REVIEW                               │
└────────────────────────────────────────────────────────────┘
Validate dataset:
  ✓ 30 rows extracted
  ✓ Avg confidence: 82%
  ⚠️  3 records with confidence <50%
  ↓
UI shows low-confidence records:
  "Sarah Chen: max_price=50 (confidence: 45%)
   Original: 'I'd consider paying around that range...'

   Extracted value seems uncertain. Accept or edit?"
   [Accept] [Edit Manually] [Re-extract]

┌────────────────────────────────────────────────────────────┐
│  STEP 5: DATASET FINALIZATION                              │
└────────────────────────────────────────────────────────────┘
User reviews and approves
  ↓
Dataset saved to experiment:
  - CSV format
  - JSON format
  - DataFrame Python code
  - Schema documentation
  - Quality metrics
  ↓
✓ Ready for AutoDS!

┌────────────────────────────────────────────────────────────┐
│  STEP 6: AUTODS DISCOVERY (UPDATED)                        │
└────────────────────────────────────────────────────────────┘
MCTS initializes with validated dataset
  ↓
Generates Python code:
```python
df = pd.read_json('dataset.json')
result = df.groupby('jobTitle')['max_price'].mean()
````

↓
Code executes in Modal with REAL, VALIDATED data
↓
Results feed back to MCTS belief updates
↓
Surprising patterns discovered

````

---

## 6. Quality Metrics & Monitoring

### 6.1 Extraction Quality Dashboard

```typescript
// renderer/src/components/extraction/QualityDashboard.tsx

interface QualityMetrics {
  // Overall quality
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  confidenceScore: number;
  completenessScore: number;

  // Detailed metrics
  recordMetrics: {
    total: number;
    highConfidence: number;    // >0.7
    mediumConfidence: number;  // 0.5-0.7
    lowConfidence: number;     // <0.5
  };

  // Field metrics
  fieldMetrics: Array<{
    fieldName: string;
    extractionRate: number;
    avgConfidence: number;
    nullRate: number;
    variance: number;
  }>;

  // For SSR method
  ssrMetrics?: {
    distributionalKS: number;
    correlationAttainment: number;
    referenceSetCount: number;
  };
}

function QualityDashboard({ dataset }: { dataset: Dataset }) {
  const quality = calculateQualityMetrics(dataset);

  return (
    <div className="quality-dashboard">
      <h2>Dataset Quality Report</h2>

      {/* Overall Score */}
      <Card>
        <h3>Overall Quality: <QualityBadge quality={quality.overallQuality} /></h3>
        <div className="scores">
          <Score label="Confidence" value={quality.confidenceScore} />
          <Score label="Completeness" value={quality.completenessScore} />
          {quality.ssrMetrics && (
            <Score label="Correlation Attainment" value={quality.ssrMetrics.correlationAttainment} />
          )}
        </div>
      </Card>

      {/* Record-Level Breakdown */}
      <Card>
        <h3>Record Quality Distribution</h3>
        <BarChart data={[
          { name: 'High Confidence', value: quality.recordMetrics.highConfidence, color: 'green' },
          { name: 'Medium Confidence', value: quality.recordMetrics.mediumConfidence, color: 'yellow' },
          { name: 'Low Confidence', value: quality.recordMetrics.lowConfidence, color: 'red' },
        ]} />
      </Card>

      {/* Field-Level Quality */}
      <Card>
        <h3>Field Extraction Quality</h3>
        <Table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Extracted</th>
              <th>Confidence</th>
              <th>Variance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {quality.fieldMetrics.map(field => (
              <tr key={field.fieldName}>
                <td>{field.fieldName}</td>
                <td>{(field.extractionRate * 100).toFixed(0)}%</td>
                <td>{(field.avgConfidence * 100).toFixed(0)}%</td>
                <td>{field.variance > 0 ? '✅' : '⚠️ No variance'}</td>
                <td>
                  {field.avgConfidence < 0.5 && (
                    <Button size="sm" onClick={() => reviewField(field.fieldName)}>
                      Review
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* SSR Validation (if applicable) */}
      {quality.ssrMetrics && (
        <Card>
          <h3>SSR Validation Metrics</h3>
          <div className="ssr-metrics">
            <Metric
              label="Distributional KS Distance"
              value={quality.ssrMetrics.distributionalKS.toFixed(3)}
              description="Lower is better (expect <0.2)"
              status={quality.ssrMetrics.distributionalKS < 0.2 ? 'good' : 'warning'}
            />
            <Metric
              label="Correlation Attainment"
              value={`${(quality.ssrMetrics.correlationAttainment * 100).toFixed(0)}%`}
              description="% of maximum achievable correlation"
              status={quality.ssrMetrics.correlationAttainment > 0.8 ? 'good' : 'warning'}
            />
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="actions">
        <Button onClick={() => exportDataset(dataset)}>Export Dataset</Button>
        <Button onClick={() => reviewLowConfidence(dataset)}>Review Low Confidence</Button>
        <Button onClick={() => reExtractWithImprovedPrompt(dataset)}>Re-extract</Button>
        {quality.overallQuality !== 'poor' && (
          <Button variant="primary" onClick={() => proceedToAutoDS(dataset)}>
            Proceed to Discovery
          </Button>
        )}
      </div>
    </div>
  );
}
````

---

## 7. Integration with AutoDS

### 7.1 Updated AutoDS Input

```typescript
// src/discovery/autodiscovery-runner.ts

interface AutoDSInput {
  // Dataset (now structured!)
  dataset: Dataset

  // Experiment context
  experiment: Experiment
  hypothesis: Hypothesis

  // Discovery config
  config: MCTSConfig
}

class AutoDiscoveryRunner {
  async run(input: AutoDSInput): Promise<DiscoveryResults> {
    // 1. Validate dataset is ready
    if (!input.dataset.stats.readyForAnalysis) {
      throw new Error(
        'Dataset not suitable for analysis: ' +
          input.dataset.validation.errors.join(', ')
      )
    }

    // 2. Initialize MCTS with dataset
    const mcts = new MCTSEngine({
      ...input.config,
      initialHypothesis: input.hypothesis.statement,
      dataset: input.dataset, // ← Now we have actual data!
    })

    // 3. Generate exploration hypotheses
    const rootHypotheses = await this.generateHypotheses(
      input.dataset,
      input.experiment
    )

    // 4. Run MCTS
    for (const hypothesis of rootHypotheses) {
      await mcts.explore(hypothesis)
    }

    // 5. Return findings
    return mcts.getResults()
  }

  /**
   * Generate initial hypotheses based on dataset structure
   */
  private async generateHypotheses(
    dataset: Dataset,
    experiment: Experiment
  ): Promise<string[]> {
    const prompt = `
Given this dataset from an experiment:

Columns: ${dataset.stats.numericColumns.join(', ')} (numeric)
         ${dataset.stats.categoricalColumns.join(', ')} (categorical)

Experiment hypothesis: ${experiment.hypothesis.statement}

Generate 5-10 testable hypotheses that can be analyzed with this data.
Focus on:
- Correlations between variables
- Segment differences (by role, company size, etc.)
- Surprising patterns

Return JSON array of hypothesis strings.
`

    const result = await llm.generate(prompt, { format: 'json' })
    return JSON.parse(result)
  }
}
```

### 7.2 Python Code Generation (with actual data)

```typescript
// Previously, MCTS generated code but had no data
// Now, dataset is available!

const experimentPlannerAgent = new Agent({
  instructions: `
You generate Python code to test hypotheses.

You have access to a pandas DataFrame with these columns:
${dataset.stats.numericColumns.join(', ')} (numeric)
${dataset.stats.categoricalColumns.join(', ')} (categorical)

The data comes from: ${experiment.name}

Generate executable Python code using pandas/numpy/scipy.
`,
  tools: {},
})

// Example generated code (NOW WITH REAL DATA):

const hypothesisCode = `
import pandas as pd
import numpy as np

# Load the actual experiment dataset
df = pd.read_json('${dataset.json}')

# Test hypothesis: "Do CTOs pay more than VPs?"
cto_prices = df[df['jobTitle'] == 'CTO']['max_price']
vp_prices = df[df['jobTitle'] == 'VP Engineering']['max_price']

cto_avg = cto_prices.mean()
vp_avg = vp_prices.mean()
difference_pct = ((cto_avg - vp_avg) / vp_avg) * 100

# Statistical test
from scipy.stats import ttest_ind
t_stat, p_value = ttest_ind(cto_prices, vp_prices)

result = {
  'cto_avg_price': cto_avg,
  'vp_avg_price': vp_avg,
  'difference_percent': difference_pct,
  'p_value': p_value,
  'significant': p_value < 0.05
}

print(result)
`
```

---

## 8. Updated Requirements Document Integration

Add to main plan:

### **Section 1.5: Dataset Extraction System (NEW)**

````markdown
### 1.5 Dataset Extraction System

**Purpose**: Transform unstructured experiment responses into structured datasets for AutoDS analysis

**Critical Challenge**: Bridge the gap between conversational text responses and statistical analysis

**Three Extractor Types**:

1. **Survey Extractor** (SSR Method)
   - Use case: Rating/scale questions
   - Method: Semantic Similarity Rating (arxiv:2510.08338)
   - Output: Likert scale ratings with confidence scores
   - Validation: KS distance, correlation attainment
   - Quality: >90% correlation attainment

2. **Conversation Extractor** (LLM Structured Extraction)
   - Use case: Focus groups, interviews
   - Method: LLM-based structured extraction with field-level confidence
   - Output: Thematic data, categorical responses
   - Validation: Field-level confidence scoring, null rate monitoring
   - Quality: >80% field extraction rate

3. **Hybrid Extractor**
   - Use case: Mixed quantitative + qualitative experiments
   - Method: Combines SSR + LLM extraction
   - Output: Merged quantitative + qualitative dataset
   - Quality: Best of both methods

**Observability Features**:

- Real-time extraction progress monitoring
- Field-level confidence scores
- Quality dashboard with warnings
- Low-confidence record review UI
- Extraction metrics logging (LLM calls, cost, time)
- Validation reports with improvement suggestions

**Integration Points**:

- Runs automatically after experiment completion
- User reviews extraction quality before AutoDS
- Can re-extract with improved prompts if quality poor
- Dataset saved with full provenance (extraction method, confidence scores)

**Implementation Files**:

- `src/extraction/ssr-extractor.ts` - Semantic Similarity Rating implementation
- `src/extraction/conversation-extractor.ts` - LLM-based extraction
- `src/extraction/hybrid-extractor.ts` - Combined approach
- `src/extraction/observability.ts` - Monitoring and metrics
- `renderer/src/components/extraction/QualityDashboard.tsx` - UI monitoring

**Dataset Output Format**:

```typescript
interface Dataset {
  experimentId: string
  records: ExtractedRecord[] // Structured data
  csv: string // CSV format
  json: string // JSON format
  dataframeCode: string // Python DataFrame code
  schema: ExtractionSchema // Field definitions
  stats: DatasetStats // Row/column counts, types
  validation: ValidationResult // Quality checks
  extractionMethod: 'ssr' | 'llm_structured' | 'hybrid'
  extractionMetrics: ExtractionMetrics // Observability data
  createdAt: number
}
```
````

````

### **Updated Section 7: Implementation Roadmap**

Add to **Phase 4**:

```markdown
### Phase 4: Mastra + Experiments + **Dataset Extraction** (Weeks 7-8)

**Goals**: Experiment execution with dataset extraction and observability

**New Tasks** (Week 8):
1. Implement SSR extractor (Semantic Similarity Rating)
2. Implement Conversation extractor (LLM structured)
3. Implement Hybrid extractor
4. Add extraction observability layer
5. Build quality dashboard UI
6. Add low-confidence review workflow
7. Test: Experiment → Extraction → Quality validation → AutoDS

**Deliverables**:
- ✅ Experiments automatically extract datasets
- ✅ Quality dashboard shows extraction confidence
- ✅ User can review/correct low-confidence extractions
- ✅ Datasets validated before AutoDS
````

### **Updated Section 9: Success Criteria**

Add:

```markdown
### Dataset Extraction Quality ✓

- [ ] > 80% average extraction confidence
- [ ] > 90% field extraction rate for required fields
- [ ] SSR correlation attainment >85% (for survey experiments)
- [ ] <10% low-confidence records requiring review
- [ ] Extraction quality dashboard functional
- [ ] User can review and correct extractions
- [ ] Dataset validation prevents bad data entering AutoDS
```

---

## Summary

I've designed a **complete dataset extraction system** with:

### **1. Three Extractor Types**

- **Survey Extractor** (SSR method from paper)
  - Semantic similarity to reference statements
  - Probability distributions for each rating
  - 90%+ correlation attainment
  - Best for: Rating questions, NPS, Likert scales

- **Conversation Extractor** (LLM-based)
  - Infers schema from conversation content
  - Field-level confidence tracking
  - Human review for low-confidence
  - Best for: Focus groups, interviews, open-ended

- **Hybrid Extractor**
  - Combines both methods
  - Quantitative + qualitative data
  - Best for: Complex multi-part experiments

### **2. Full Observability**

- Real-time extraction progress monitoring
- Field-level confidence scores (per field, per record)
- Quality dashboard with visual metrics
- Low-confidence record flagging
- Validation reports with improvement suggestions
- Cost/time tracking for extraction process

### **3. Quality Validation**

From the paper's methodology:

- **Distributional similarity** (KS distance)
- **Correlation attainment** (vs human test-retest baseline)
- **Confidence thresholds** (flag <50%, review <60%)
- **Null rate monitoring** (warn if >50% null in any field)
- **Variance checks** (warn if no variance in numeric fields)

### **4. Human-in-the-Loop**

- Auto-flags low-confidence extractions
- UI for reviewing and correcting
- Can re-extract with improved prompts
- User approves before sending to AutoDS

---

## Next Steps

Want me to:

1. **Add this full spec to the main requirements document?**
2. **Implement the SSR extractor code** (production-ready)?
3. **Create the Quality Dashboard UI mockups?**
4. **Design the human review workflow in detail?**
5. **Update the 13-week timeline** with extraction tasks?

This is a **critical missing piece** - without proper dataset extraction, AutoDS gets garbage data. With this system, AutoDS gets high-quality, validated, structured data with full provenance and confidence scores.
