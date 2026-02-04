# Context Pipeline Implementation Specification

## Complete Technical Implementation Guide

**Date**: 2026-01-29
**Version**: 1.0
**Purpose**: Detailed implementation specs for the Context Management System

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Upload System](#2-file-upload-system)
3. [Document Processing Pipeline](#3-document-processing-pipeline)
4. [Vector Storage & Search](#4-vector-storage--search)
5. [CRM Integration Framework](#5-crm-integration-framework)
6. [Persona Generation from Context](#6-persona-generation-from-context)
7. [Context-Aware AI Integration](#7-context-aware-ai-integration)
8. [API Endpoints](#8-api-endpoints)
9. [Error Handling & Recovery](#9-error-handling--recovery)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Architecture Overview

### 1.1 System Components

```
┌────────────────────────────────────────────────────────────┐
│                      ELECTRON APP                           │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              FRONTEND (React)                        │  │
│  │  - Context Library UI                                │  │
│  │  - File Upload Component                             │  │
│  │  - CRM Connection Flow                               │  │
│  │  - Persona Preview                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │ IPC                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MAIN PROCESS (Node.js)                  │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │     Context Manager                            │  │  │
│  │  │  - Orchestrates pipeline                       │  │  │
│  │  │  - Manages state                               │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │           │                 │                  │      │  │
│  │  ┌────────▼──────┐  ┌──────▼──────┐  ┌───────▼────┐ │  │
│  │  │  File Parser  │  │ CRM Connector│ │ Processor │ │  │
│  │  │  - PDF        │  │ - Attio      │ │ - Chunker │ │  │
│  │  │  - Excel      │  │ - HubSpot    │ │ - Embedder│ │  │
│  │  │  - CSV        │  │ - Salesforce │ │ - Extractor│ │  │
│  │  └───────────────┘  └──────────────┘  └───────────┘ │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌───────────┐    ┌──────────┐
    │ Convex   │    │ Pinecone  │    │  Local   │
    │  (Docs)  │    │ (Vectors) │    │ SQLite   │
    └──────────┘    └───────────┘    └──────────┘
```

### 1.2 Data Flow

```
User uploads file/connects CRM
    ↓
File saved to disk (temp) or API called
    ↓
Parser extracts text/data
    ↓
Content chunked (1000 tokens, 200 overlap)
    ↓
Chunks embedded (OpenAI text-embedding-3-small)
    ↓
Embeddings stored in Pinecone
    ↓
Document metadata stored in Convex
    ↓
User can search context or generate personas
```

### 1.3 Directory Structure

```
src/
├── context/
│   ├── manager.ts                    # Main orchestrator
│   ├── types.ts                      # TypeScript types
│   │
│   ├── upload/
│   │   ├── file-handler.ts           # File upload handling
│   │   ├── validators.ts             # File validation
│   │   └── storage.ts                # Temp storage management
│   │
│   ├── parsers/
│   │   ├── base-parser.ts            # Parser interface
│   │   ├── pdf-parser.ts             # PDF extraction
│   │   ├── excel-parser.ts           # Excel/XLSX parsing
│   │   ├── csv-parser.ts             # CSV parsing
│   │   ├── docx-parser.ts            # Word document parsing
│   │   ├── text-parser.ts            # Plain text
│   │   └── parser-factory.ts         # Factory pattern
│   │
│   ├── processing/
│   │   ├── chunker.ts                # Text chunking
│   │   ├── embedder.ts               # Generate embeddings
│   │   ├── entity-extractor.ts       # Extract entities
│   │   └── schema-detector.ts        # Detect CSV schemas
│   │
│   ├── storage/
│   │   ├── vector-store.ts           # Pinecone wrapper
│   │   ├── document-store.ts         # Convex wrapper
│   │   └── local-cache.ts            # SQLite cache
│   │
│   ├── connectors/
│   │   ├── base-connector.ts         # Connector interface
│   │   ├── attio-connector.ts        # Attio CRM (PRIORITY)
│   │   ├── salesforce-connector.ts   # Salesforce
│   │   ├── hubspot-connector.ts      # HubSpot
│   │   └── connector-factory.ts      # Factory pattern
│   │
│   ├── search/
│   │   ├── searcher.ts               # Semantic search
│   │   ├── query-builder.ts          # Build vector queries
│   │   └── result-ranker.ts          # Re-rank results
│   │
│   └── generation/
│       ├── persona-generator.ts      # Generate personas from context
│       ├── insight-extractor.ts      # Extract insights
│       └── summary-generator.ts      # Document summaries
│
├── ipc/
│   └── context-handlers.ts           # IPC handlers for context
│
└── mastra/
    └── agents/
        └── ContextEnhancedAssistant.ts  # Assistant with context tools
```

---

## 2. File Upload System

### 2.1 File Handler

```typescript
// src/context/upload/file-handler.ts

import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import os from 'os'

export interface UploadOptions {
  userId: string
  workspaceId?: string
  tags?: string[]
  type?: DocumentType
}

export interface UploadResult {
  fileId: string
  filePath: string
  fileName: string
  fileSize: number
  fileType: string
  checksum: string
}

export class FileHandler {
  private uploadDir: string

  constructor() {
    // Store in OS temp dir
    this.uploadDir = path.join(os.tmpdir(), 'unheard-uploads')
    this.ensureUploadDir()
  }

  private async ensureUploadDir() {
    const fs = await import('fs/promises')
    await fs.mkdir(this.uploadDir, { recursive: true })
  }

  async handleUpload(
    file: File | string, // File object or path
    options: UploadOptions
  ): Promise<UploadResult> {
    const fileId = randomUUID()
    const fileName = typeof file === 'string' ? path.basename(file) : file.name
    const ext = path.extname(fileName)
    const destPath = path.join(this.uploadDir, `${fileId}${ext}`)

    // Copy file to temp directory
    if (typeof file === 'string') {
      // File path provided (drag & drop)
      const fs = await import('fs/promises')
      await fs.copyFile(file, destPath)
    } else {
      // File object (web upload)
      const buffer = Buffer.from(await file.arrayBuffer())
      const fs = await import('fs/promises')
      await fs.writeFile(destPath, buffer)
    }

    // Get file stats
    const stats = await this.getFileStats(destPath)
    const checksum = await this.calculateChecksum(destPath)

    return {
      fileId,
      filePath: destPath,
      fileName,
      fileSize: stats.size,
      fileType: ext.slice(1),
      checksum,
    }
  }

  private async getFileStats(filePath: string) {
    const fs = await import('fs/promises')
    return fs.stat(filePath)
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto')
    const fs = await import('fs')
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  async cleanup(fileId: string) {
    const fs = await import('fs/promises')
    const files = await fs.readdir(this.uploadDir)
    const toDelete = files.filter(f => f.startsWith(fileId))

    await Promise.all(
      toDelete.map(f => fs.unlink(path.join(this.uploadDir, f)))
    )
  }
}
```

### 2.2 File Validators

```typescript
// src/context/upload/validators.ts

export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

export class FileValidator {
  private static MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

  private static ALLOWED_TYPES = {
    pdf: ['application/pdf'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    xls: ['application/vnd.ms-excel'],
    csv: ['text/csv', 'application/csv'],
    docx: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    doc: ['application/msword'],
    txt: ['text/plain'],
    md: ['text/markdown'],
  }

  static validate(file: UploadResult): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check file size
    if (file.fileSize > this.MAX_FILE_SIZE) {
      errors.push(
        `File size (${this.formatBytes(file.fileSize)}) exceeds maximum allowed (100MB)`
      )
    }

    // Check file type
    if (!this.isAllowedType(file.fileType)) {
      errors.push(
        `File type '.${file.fileType}' is not supported. Allowed: ${Object.keys(this.ALLOWED_TYPES).join(', ')}`
      )
    }

    // Warn on large files
    if (file.fileSize > 50 * 1024 * 1024) {
      warnings.push('Large file detected. Processing may take several minutes.')
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  private static isAllowedType(ext: string): boolean {
    return ext in this.ALLOWED_TYPES
  }

  private static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
```

---

## 3. Document Processing Pipeline

### 3.1 Base Parser Interface

```typescript
// src/context/parsers/base-parser.ts

export interface ParsedDocument {
  fileId: string
  content: string // Full text content
  metadata: DocumentMetadata
  chunks?: Chunk[] // Optional pre-chunked
  structuredData?: any // For CSV/Excel
  entities?: ExtractedEntities // Optional extracted entities
}

export interface DocumentMetadata {
  title?: string
  author?: string
  createdAt?: Date
  pageCount?: number
  wordCount?: number
  [key: string]: any
}

export interface Chunk {
  id: string
  content: string
  metadata: ChunkMetadata
}

export interface ChunkMetadata {
  chunkIndex: number
  tokenCount: number
  pageNumber?: number
  section?: string
}

export abstract class BaseParser {
  abstract supports(fileType: string): boolean
  abstract parse(filePath: string, fileId: string): Promise<ParsedDocument>

  protected countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length
  }

  protected estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }
}
```

### 3.2 PDF Parser

```typescript
// src/context/parsers/pdf-parser.ts

import pdf from 'pdf-parse'
import { readFile } from 'fs/promises'
import { BaseParser, ParsedDocument } from './base-parser'

export class PDFParser extends BaseParser {
  supports(fileType: string): boolean {
    return fileType === 'pdf'
  }

  async parse(filePath: string, fileId: string): Promise<ParsedDocument> {
    const dataBuffer = await readFile(filePath)
    const data = await pdf(dataBuffer)

    return {
      fileId,
      content: data.text,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        createdAt: data.info?.CreationDate
          ? new Date(data.info.CreationDate)
          : undefined,
        pageCount: data.numpages,
        wordCount: this.countWords(data.text),
        pdfVersion: data.version,
      },
    }
  }
}
```

### 3.3 Excel Parser

```typescript
// src/context/parsers/excel-parser.ts

import XLSX from 'xlsx'
import { BaseParser, ParsedDocument } from './base-parser'

export class ExcelParser extends BaseParser {
  supports(fileType: string): boolean {
    return ['xlsx', 'xls'].includes(fileType)
  }

  async parse(filePath: string, fileId: string): Promise<ParsedDocument> {
    const workbook = XLSX.readFile(filePath)

    // Detect if this is structured data (rows with headers)
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet)

    if (this.isStructuredData(data)) {
      return this.parseAsStructuredData(workbook, fileId)
    } else {
      return this.parseAsText(workbook, fileId)
    }
  }

  private isStructuredData(data: any[]): boolean {
    if (data.length === 0) return false

    // Check if first row has consistent keys
    const firstRow = data[0]
    const keys = Object.keys(firstRow)

    // Must have at least 2 columns and 2 rows
    return keys.length >= 2 && data.length >= 2
  }

  private parseAsStructuredData(
    workbook: XLSX.WorkBook,
    fileId: string
  ): ParsedDocument {
    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name]
      const data = XLSX.utils.sheet_to_json(sheet)
      return { name, data }
    })

    const mainSheet = sheets[0]
    const schema = this.detectSchema(mainSheet.data)

    return {
      fileId,
      content: JSON.stringify(mainSheet.data, null, 2),
      metadata: {
        sheetCount: sheets.length,
        rowCount: mainSheet.data.length,
        columnCount: Object.keys(mainSheet.data[0] || {}).length,
        detectedSchema: schema,
      },
      structuredData: {
        sheets: sheets.map(s => ({
          name: s.name,
          rows: s.data,
        })),
        schema,
      },
    }
  }

  private parseAsText(workbook: XLSX.WorkBook, fileId: string): ParsedDocument {
    const text = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name]
      return XLSX.utils.sheet_to_txt(sheet)
    }).join('\n\n')

    return {
      fileId,
      content: text,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        wordCount: this.countWords(text),
      },
    }
  }

  private detectSchema(data: any[]): DataSchema {
    if (data.length === 0) return { type: 'unknown', columns: [] }

    const firstRow = data[0]
    const columns = Object.keys(firstRow).map(key => ({
      name: key,
      type: this.detectColumnType(data, key),
      sampleValues: data.slice(0, 3).map(row => row[key]),
    }))

    // Detect if this looks like customer data
    const hasNameColumn = columns.some(c =>
      ['name', 'full_name', 'contact_name'].includes(c.name.toLowerCase())
    )
    const hasEmailColumn = columns.some(c =>
      ['email', 'email_address'].includes(c.name.toLowerCase())
    )
    const hasCompanyColumn = columns.some(c =>
      ['company', 'company_name', 'organization'].includes(c.name.toLowerCase())
    )

    let type: 'customer_data' | 'survey_responses' | 'generic' = 'generic'
    if (hasNameColumn && (hasEmailColumn || hasCompanyColumn)) {
      type = 'customer_data'
    }

    return { type, columns }
  }

  private detectColumnType(data: any[], key: string): string {
    const samples = data
      .slice(0, 10)
      .map(row => row[key])
      .filter(Boolean)
    if (samples.length === 0) return 'string'

    const types = samples.map(val => typeof val)
    const mostCommon = types
      .sort(
        (a, b) =>
          types.filter(v => v === a).length - types.filter(v => v === b).length
      )
      .pop()

    return mostCommon || 'string'
  }
}

interface DataSchema {
  type: 'customer_data' | 'survey_responses' | 'generic' | 'unknown'
  columns: Array<{
    name: string
    type: string
    sampleValues: any[]
  }>
}
```

### 3.4 CSV Parser

```typescript
// src/context/parsers/csv-parser.ts

import { parse } from 'csv-parse/sync'
import { readFile } from 'fs/promises'
import { BaseParser, ParsedDocument } from './base-parser'

export class CSVParser extends BaseParser {
  supports(fileType: string): boolean {
    return fileType === 'csv'
  }

  async parse(filePath: string, fileId: string): Promise<ParsedDocument> {
    const content = await readFile(filePath, 'utf-8')

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    const schema = this.detectSchema(records)

    return {
      fileId,
      content: JSON.stringify(records, null, 2),
      metadata: {
        rowCount: records.length,
        columnCount: Object.keys(records[0] || {}).length,
        detectedSchema: schema,
      },
      structuredData: {
        rows: records,
        schema,
      },
    }
  }

  private detectSchema(records: any[]): any {
    // Same as ExcelParser.detectSchema
    // Extract to shared utility
  }
}
```

### 3.5 Word/Docx Parser

```typescript
// src/context/parsers/docx-parser.ts

import mammoth from 'mammoth'
import { BaseParser, ParsedDocument } from './base-parser'

export class DocxParser extends BaseParser {
  supports(fileType: string): boolean {
    return ['docx', 'doc'].includes(fileType)
  }

  async parse(filePath: string, fileId: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ path: filePath })

    return {
      fileId,
      content: result.value,
      metadata: {
        wordCount: this.countWords(result.value),
        hasWarnings: result.messages.length > 0,
      },
    }
  }
}
```

### 3.6 Parser Factory

```typescript
// src/context/parsers/parser-factory.ts

import { BaseParser } from './base-parser'
import { PDFParser } from './pdf-parser'
import { ExcelParser } from './excel-parser'
import { CSVParser } from './csv-parser'
import { DocxParser } from './docx-parser'
import { TextParser } from './text-parser'

export class ParserFactory {
  private static parsers: BaseParser[] = [
    new PDFParser(),
    new ExcelParser(),
    new CSVParser(),
    new DocxParser(),
    new TextParser(),
  ]

  static getParser(fileType: string): BaseParser | null {
    return this.parsers.find(p => p.supports(fileType)) || null
  }

  static getSupportedTypes(): string[] {
    return ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc', 'txt', 'md']
  }
}
```

---

## 4. Vector Storage & Search

### 4.1 Chunking Strategy

```typescript
// src/context/processing/chunker.ts

export interface ChunkOptions {
  maxTokens: number // Max tokens per chunk (default: 1000)
  overlap: number // Overlap tokens (default: 200)
  strategy: 'fixed' | 'semantic' | 'sentence'
}

export class DocumentChunker {
  private tokenizer: any // Use tiktoken or similar

  constructor() {
    // Initialize tokenizer
    this.tokenizer = require('tiktoken').encoding_for_model(
      'text-embedding-3-small'
    )
  }

  chunk(content: string, options: Partial<ChunkOptions> = {}): Chunk[] {
    const opts: ChunkOptions = {
      maxTokens: options.maxTokens || 1000,
      overlap: options.overlap || 200,
      strategy: options.strategy || 'fixed',
    }

    if (opts.strategy === 'semantic') {
      return this.semanticChunk(content, opts)
    }

    if (opts.strategy === 'sentence') {
      return this.sentenceChunk(content, opts)
    }

    return this.fixedChunk(content, opts)
  }

  private fixedChunk(content: string, options: ChunkOptions): Chunk[] {
    const tokens = this.tokenizer.encode(content)
    const chunks: Chunk[] = []
    const { maxTokens, overlap } = options

    for (let i = 0; i < tokens.length; i += maxTokens - overlap) {
      const chunkTokens = tokens.slice(i, i + maxTokens)
      const chunkText = this.tokenizer.decode(chunkTokens)

      chunks.push({
        id: `chunk_${i}`,
        content: chunkText,
        metadata: {
          chunkIndex: chunks.length,
          tokenCount: chunkTokens.length,
        },
      })

      // Stop if we're at the end
      if (i + maxTokens >= tokens.length) break
    }

    return chunks
  }

  private sentenceChunk(content: string, options: ChunkOptions): Chunk[] {
    // Split into sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content]
    const chunks: Chunk[] = []
    let currentChunk: string[] = []
    let currentTokens = 0

    for (const sentence of sentences) {
      const sentenceTokens = this.tokenizer.encode(sentence).length

      if (
        currentTokens + sentenceTokens > options.maxTokens &&
        currentChunk.length > 0
      ) {
        // Flush current chunk
        chunks.push({
          id: `chunk_${chunks.length}`,
          content: currentChunk.join(' '),
          metadata: {
            chunkIndex: chunks.length,
            tokenCount: currentTokens,
          },
        })

        // Start new chunk with overlap
        const overlapSentences = Math.floor(options.overlap / 100) // Rough estimate
        currentChunk = currentChunk.slice(-overlapSentences)
        currentTokens = this.tokenizer.encode(currentChunk.join(' ')).length
      }

      currentChunk.push(sentence)
      currentTokens += sentenceTokens
    }

    // Flush remaining
    if (currentChunk.length > 0) {
      chunks.push({
        id: `chunk_${chunks.length}`,
        content: currentChunk.join(' '),
        metadata: {
          chunkIndex: chunks.length,
          tokenCount: currentTokens,
        },
      })
    }

    return chunks
  }

  private semanticChunk(content: string, options: ChunkOptions): Chunk[] {
    // TODO: Implement semantic chunking using sentence embeddings
    // For V1, fall back to sentence chunking
    return this.sentenceChunk(content, options)
  }
}
```

### 4.2 Embedding Service

```typescript
// src/context/processing/embedder.ts

import OpenAI from 'openai'

export interface EmbeddingOptions {
  provider: 'openai' | 'local'
  model?: string
  batchSize?: number
}

export class EmbeddingService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async embed(
    texts: string[],
    options: Partial<EmbeddingOptions> = {}
  ): Promise<number[][]> {
    const opts: EmbeddingOptions = {
      provider: options.provider || 'openai',
      model: options.model || 'text-embedding-3-small',
      batchSize: options.batchSize || 100,
    }

    if (opts.provider === 'local') {
      return this.embedLocal(texts)
    }

    return this.embedOpenAI(texts, opts)
  }

  private async embedOpenAI(
    texts: string[],
    options: EmbeddingOptions
  ): Promise<number[][]> {
    const embeddings: number[][] = []

    // Process in batches
    for (let i = 0; i < texts.length; i += options.batchSize!) {
      const batch = texts.slice(i, i + options.batchSize!)

      const response = await this.openai.embeddings.create({
        model: options.model!,
        input: batch,
      })

      embeddings.push(...response.data.map(d => d.embedding))
    }

    return embeddings
  }

  private async embedLocal(texts: string[]): Promise<number[][]> {
    // TODO: Implement local embeddings via Modal or Ollama
    // For V1, use OpenAI
    throw new Error('Local embeddings not yet implemented. Use OpenAI.')
  }

  async estimateCost(
    textCount: number,
    avgTokensPerText: number = 100
  ): Promise<number> {
    // OpenAI text-embedding-3-small: $0.02 per 1M tokens
    const totalTokens = textCount * avgTokensPerText
    return (totalTokens / 1_000_000) * 0.02
  }
}
```

### 4.3 Vector Store (Pinecone)

```typescript
// src/context/storage/vector-store.ts

import { Pinecone } from '@pinecone-database/pinecone'

export interface VectorRecord {
  id: string
  values: number[]
  metadata: {
    userId: string
    documentId: string
    content: string
    chunkIndex: number
    fileType?: string
    documentType?: string
    createdAt: number
    [key: string]: any
  }
}

export interface SearchOptions {
  topK?: number
  filter?: Record<string, any>
  includeMetadata?: boolean
  minScore?: number
}

export class VectorStore {
  private pinecone: Pinecone
  private index: any
  private indexName = 'unheard-context'

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })
  }

  async initialize() {
    this.index = this.pinecone.index(this.indexName)
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    // Upsert in batches of 100
    const batchSize = 100
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      await this.index.upsert(batch)
    }
  }

  async search(
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<VectorRecord[]> {
    const opts = {
      topK: options.topK || 10,
      filter: options.filter,
      includeMetadata: options.includeMetadata !== false,
    }

    const results = await this.index.query({
      vector: queryVector,
      ...opts,
    })

    return results.matches
      .filter(match => !options.minScore || match.score >= options.minScore)
      .map(match => ({
        id: match.id,
        values: match.values || [],
        metadata: match.metadata as any,
        score: match.score,
      }))
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.index.deleteMany({
      filter: { documentId: { $eq: documentId } },
    })
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.index.deleteMany({
      filter: { userId: { $eq: userId } },
    })
  }
}
```

---

## 5. CRM Integration Framework

### 5.1 Base Connector Interface

```typescript
// src/context/connectors/base-connector.ts

export interface CRMContact {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  jobTitle?: string
  industry?: string
  notes?: string
  customFields?: Record<string, any>
  lastActivityDate?: Date
  source: string // 'attio', 'salesforce', etc.
}

export interface SyncResult {
  imported: number
  updated: number
  skipped: number
  errors: number
  errorMessages?: string[]
}

export interface ConnectorConfig {
  credentials: any
  filters?: {
    tags?: string[]
    status?: string
    limit?: number
  }
  fieldMapping?: Record<string, string>
}

export abstract class BaseCRMConnector {
  protected config: ConnectorConfig

  constructor(config: ConnectorConfig) {
    this.config = config
  }

  abstract authenticate(): Promise<void>
  abstract testConnection(): Promise<boolean>
  abstract fetchContacts(filters?: any): Promise<CRMContact[]>
  abstract sync(): Promise<SyncResult>
  abstract disconnect(): Promise<void>

  protected mapContact(
    rawContact: any,
    mapping: Record<string, string>
  ): CRMContact {
    const mapped: Partial<CRMContact> = {
      source: this.getSourceName(),
    }

    for (const [target, source] of Object.entries(mapping)) {
      if (rawContact[source] !== undefined) {
        ;(mapped as any)[target] = rawContact[source]
      }
    }

    return mapped as CRMContact
  }

  protected abstract getSourceName(): string
}
```

### 5.2 Attio Connector (PRIORITY)

See separate document: `attio-connector.ts`

---

## 6. Persona Generation from Context

### 6.1 Persona Generator

```typescript
// src/context/generation/persona-generator.ts

import { Agent } from '@mastra/core'

export interface PersonaGenerationOptions {
  count: number
  focusArea?: string // "enterprise", "startup", etc.
  diversity?: 'low' | 'medium' | 'high'
  sourceDocuments: string[] // Document IDs
}

export interface GeneratedPersona {
  name: string
  demographics: {
    age: number
    gender: string
    location: string
    income?: string
    education?: string
  }
  jobRole: {
    title: string
    department: string
    seniority: string
    company?: string
    industry?: string
  }
  personality: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  }
  beliefs: string[]
  preferences: Record<string, any>
  behaviors: string[]
  quote?: string // Actual quote from source data
  sourceAttribution: {
    documentIds: string[]
    snippets: string[] // Specific text that informed this persona
  }
}

export class PersonaGenerator {
  private searcher: ContextSearcher
  private llm: any // LLM client

  constructor(searcher: ContextSearcher, llm: any) {
    this.searcher = searcher
    this.llm = llm
  }

  async generateFromContext(
    userId: string,
    options: PersonaGenerationOptions
  ): Promise<GeneratedPersona[]> {
    // 1. Search for relevant customer data
    const contextChunks = await this.searcher.search(
      userId,
      'customer profiles demographics behavior feedback',
      {
        documentIds: options.sourceDocuments,
        topK: 50,
      }
    )

    // 2. Extract patterns from context
    const patterns = await this.extractPatterns(contextChunks)

    // 3. Generate diverse personas
    const prompt = this.buildGenerationPrompt(contextChunks, patterns, options)
    const response = await this.llm.generate(prompt, { format: 'json' })
    const personas = JSON.parse(response)

    // 4. Add source attribution
    return personas.map((persona: any) => ({
      ...persona,
      sourceAttribution: {
        documentIds: options.sourceDocuments,
        snippets: this.findRelevantSnippets(persona, contextChunks),
      },
    }))
  }

  private async extractPatterns(chunks: any[]): Promise<any> {
    const prompt = `
Analyze these customer data snippets and identify common patterns:

${chunks
  .map(c => c.content)
  .slice(0, 20)
  .join('\n\n')}

Extract:
- Common demographics (age ranges, locations, job titles)
- Frequent behaviors
- Recurring needs/pain points
- Company types/industries

Return JSON with patterns.
`

    const response = await this.llm.generate(prompt, { format: 'json' })
    return JSON.parse(response)
  }

  private buildGenerationPrompt(
    chunks: any[],
    patterns: any,
    options: PersonaGenerationOptions
  ): string {
    return `
You are generating ${options.count} realistic customer personas based on REAL customer data.

REAL CUSTOMER DATA:
${chunks
  .map(c => c.content)
  .slice(0, 30)
  .join('\n\n')}

IDENTIFIED PATTERNS:
${JSON.stringify(patterns, null, 2)}

INSTRUCTIONS:
- Create ${options.count} diverse personas covering the range of customers
- Base personas on actual data (quotes, demographics, behaviors)
- Include real quotes from customer data where available
- Vary: age, seniority, company size, industry
${options.focusArea ? `- Focus on: ${options.focusArea} segment` : ''}
${options.diversity === 'high' ? '- Maximize diversity across all dimensions' : ''}

Return JSON array of personas with this structure:
[{
  name: "realistic name",
  demographics: { age, gender, location, income, education },
  jobRole: { title, department, seniority, company, industry },
  personality: { openness, conscientiousness, extraversion, agreeableness, neuroticism },
  beliefs: ["belief 1", "belief 2"],
  preferences: { key: value },
  behaviors: ["behavior 1"],
  quote: "actual quote from data if available"
}]
`
  }

  private findRelevantSnippets(persona: any, chunks: any[]): string[] {
    // Find chunks that are most relevant to this specific persona
    // Based on job title, company, or quoted text
    return chunks
      .filter(chunk => {
        const content = chunk.content.toLowerCase()
        return (
          content.includes(persona.jobRole.title.toLowerCase()) ||
          (persona.quote && content.includes(persona.quote.toLowerCase()))
        )
      })
      .slice(0, 3)
      .map(c => c.content)
  }
}
```

---

## 7. Context-Aware AI Integration

### 7.1 Context Search Tool for Assistant

```typescript
// src/context/search/searcher.ts

export interface SearchResult {
  id: string
  content: string
  score: number
  metadata: {
    documentId: string
    documentName: string
    documentType: string
    chunkIndex: number
  }
}

export class ContextSearcher {
  private vectorStore: VectorStore
  private embedder: EmbeddingService
  private documentStore: any // Convex client

  constructor(
    vectorStore: VectorStore,
    embedder: EmbeddingService,
    documentStore: any
  ) {
    this.vectorStore = vectorStore
    this.embedder = embedder
    this.documentStore = documentStore
  }

  async search(
    userId: string,
    query: string,
    options: {
      topK?: number
      documentIds?: string[]
      documentTypes?: string[]
      minScore?: number
    } = {}
  ): Promise<SearchResult[]> {
    // 1. Embed query
    const queryEmbedding = await this.embedder.embed([query])

    // 2. Build filter
    const filter: any = { userId: { $eq: userId } }
    if (options.documentIds) {
      filter.documentId = { $in: options.documentIds }
    }
    if (options.documentTypes) {
      filter.documentType = { $in: options.documentTypes }
    }

    // 3. Search vectors
    const vectorResults = await this.vectorStore.search(queryEmbedding[0], {
      topK: options.topK || 10,
      filter,
      minScore: options.minScore || 0.7,
    })

    // 4. Hydrate with document metadata
    const documentIds = [
      ...new Set(vectorResults.map(r => r.metadata.documentId)),
    ]
    const documents = await this.documentStore.query(
      api.contextDocuments.getByIds,
      {
        ids: documentIds,
      }
    )

    const documentMap = new Map(documents.map((d: any) => [d._id, d]))

    return vectorResults.map(result => ({
      id: result.id,
      content: result.metadata.content,
      score: result.score!,
      metadata: {
        documentId: result.metadata.documentId,
        documentName:
          documentMap.get(result.metadata.documentId)?.name || 'Unknown',
        documentType: result.metadata.documentType || 'unknown',
        chunkIndex: result.metadata.chunkIndex,
      },
    }))
  }

  async searchByDocumentType(
    userId: string,
    query: string,
    documentType: string
  ): Promise<SearchResult[]> {
    return this.search(userId, query, { documentTypes: [documentType] })
  }
}
```

### 7.2 Enhanced Assistant with Context Tools

```typescript
// src/mastra/agents/ContextEnhancedAssistant.ts

import { Agent } from '@mastra/core'
import { z } from 'zod'

export const ContextEnhancedAssistant = new Agent({
  name: 'context-enhanced-assistant',
  model: { provider: 'openai', name: 'gpt-4o' },
  instructions: `
${BASE_INSTRUCTIONS}

You have access to the user's uploaded documents and connected CRM data.

When designing experiments:
1. ALWAYS search user context first
2. Ground suggestions in their actual data
3. Reference specific documents/data
4. Generate personas from real customers

Example:
User: "Test pricing"
You: [Search context for "pricing strategy"]
Found: "Q4_Strategy.pdf mentions $99 premium tier"
Response: "I see from your Q4 strategy you're planning a $99 premium tier..."
`,
  tools: {
    // ... existing tools

    searchUserContext: {
      name: 'searchUserContext',
      description: "Search user's uploaded documents for relevant context.",
      parameters: z.object({
        query: z.string().describe('What to search for'),
        documentTypes: z
          .array(z.string())
          .optional()
          .describe('Filter by type: strategy, customer_data, feedback'),
      }),
      handler: async ({ query, documentTypes }) => {
        const results = await contextSearcher.search(currentUserId, query, {
          documentTypes,
          topK: 5,
        })

        return {
          results: results.map(r => ({
            snippet: r.content.slice(0, 500),
            source: r.metadata.documentName,
            relevance: r.score,
          })),
          found: results.length,
        }
      },
    },

    listUserDocuments: {
      name: 'listUserDocuments',
      description: 'List all documents uploaded by user.',
      parameters: z.object({
        type: z.string().optional(),
      }),
      handler: async ({ type }) => {
        const docs = await convex.query(api.contextDocuments.list, {
          userId: currentUserId,
          type,
        })

        return {
          documents: docs.map(d => ({
            id: d._id,
            name: d.name,
            type: d.type,
            summary: d.summary,
            uploadedAt: d.createdAt,
          })),
        }
      },
    },

    generatePersonasFromContext: {
      name: 'generatePersonasFromContext',
      description: "Generate realistic personas from user's customer data.",
      parameters: z.object({
        count: z
          .number()
          .min(1)
          .max(50)
          .describe('Number of personas to generate'),
        sourceDocumentIds: z
          .array(z.string())
          .describe('Which documents to use'),
        focusArea: z.string().optional().describe('Focus on specific segment'),
      }),
      handler: async ({ count, sourceDocumentIds, focusArea }) => {
        const personas = await personaGenerator.generateFromContext(
          currentUserId,
          {
            count,
            sourceDocuments: sourceDocumentIds,
            focusArea,
          }
        )

        // Save to Convex
        const savedPersonas = await Promise.all(
          personas.map(p =>
            convex.mutation(api.personas.create, {
              userId: currentUserId,
              ...p,
            })
          )
        )

        return {
          personas: savedPersonas.map(p => ({
            id: p._id,
            name: p.name,
            summary: `${p.jobRole.title} at ${p.jobRole.company}`,
          })),
          message: `Created ${count} personas from your customer data`,
        }
      },
    },
  },
})
```

---

## 8. API Endpoints (IPC Handlers)

### 8.1 Context IPC Handlers

```typescript
// src/ipc/context-handlers.ts

import { ipcMain } from 'electron'
import { ContextManager } from '../context/manager'

export function registerContextHandlers(contextManager: ContextManager) {
  // Upload file
  ipcMain.handle(
    'context:upload',
    async (event, filePath: string, options: any) => {
      try {
        const result = await contextManager.processFile(filePath, {
          userId: options.userId,
          type: options.type,
          tags: options.tags,
        })

        return { success: true, document: result }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  // Search context
  ipcMain.handle(
    'context:search',
    async (event, userId: string, query: string, options: any) => {
      const results = await contextManager.search(userId, query, options)
      return results
    }
  )

  // List documents
  ipcMain.handle(
    'context:list',
    async (event, userId: string, filters: any) => {
      const documents = await contextManager.listDocuments(userId, filters)
      return documents
    }
  )

  // Delete document
  ipcMain.handle('context:delete', async (event, documentId: string) => {
    await contextManager.deleteDocument(documentId)
    return { success: true }
  })

  // Connect CRM
  ipcMain.handle(
    'context:connect-crm',
    async (event, type: string, credentials: any) => {
      const connection = await contextManager.connectCRM(type, credentials)
      return connection
    }
  )

  // Sync CRM
  ipcMain.handle('context:sync-crm', async (event, connectionId: string) => {
    const result = await contextManager.syncCRM(connectionId)
    return result
  })

  // Generate personas from context
  ipcMain.handle('context:generate-personas', async (event, options: any) => {
    const personas = await contextManager.generatePersonas(options)
    return personas
  })

  // Get document summary
  ipcMain.handle('context:get-summary', async (event, documentId: string) => {
    const summary = await contextManager.getSummary(documentId)
    return summary
  })
}
```

---

## 9. Error Handling & Recovery

### 9.1 Error Types

```typescript
// src/context/errors.ts

export class ContextError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true,
    public metadata?: any
  ) {
    super(message)
    this.name = 'ContextError'
  }
}

export class ParsingError extends ContextError {
  constructor(message: string, fileType: string) {
    super(message, 'PARSING_ERROR', true, { fileType })
  }
}

export class EmbeddingError extends ContextError {
  constructor(message: string, textCount: number) {
    super(message, 'EMBEDDING_ERROR', true, { textCount })
  }
}

export class StorageError extends ContextError {
  constructor(message: string, operation: string) {
    super(message, 'STORAGE_ERROR', true, { operation })
  }
}

export class CRMConnectionError extends ContextError {
  constructor(message: string, crmType: string) {
    super(message, 'CRM_CONNECTION_ERROR', true, { crmType })
  }
}
```

### 9.2 Recovery Strategies

```typescript
// src/context/recovery.ts

export class RecoveryManager {
  async handleError(
    error: ContextError,
    context: any
  ): Promise<RecoveryResult> {
    switch (error.code) {
      case 'PARSING_ERROR':
        return this.recoverFromParsingError(error, context)

      case 'EMBEDDING_ERROR':
        return this.recoverFromEmbeddingError(error, context)

      case 'STORAGE_ERROR':
        return this.recoverFromStorageError(error, context)

      case 'CRM_CONNECTION_ERROR':
        return this.recoverFromCRMError(error, context)

      default:
        return { recovered: false, error }
    }
  }

  private async recoverFromParsingError(
    error: ContextError,
    context: any
  ): Promise<RecoveryResult> {
    // Try alternative parser
    const { fileType } = error.metadata

    if (fileType === 'pdf') {
      // Try OCR if text extraction failed
      return {
        recovered: true,
        message: 'Attempting OCR extraction...',
        retry: { useOCR: true },
      }
    }

    return { recovered: false, error }
  }

  private async recoverFromEmbeddingError(
    error: ContextError,
    context: any
  ): Promise<RecoveryResult> {
    // Retry with exponential backoff
    return {
      recovered: true,
      message: 'Retrying embedding generation...',
      retry: { delay: 1000, maxAttempts: 3 },
    }
  }

  private async recoverFromStorageError(
    error: ContextError,
    context: any
  ): Promise<RecoveryResult> {
    // Cache locally and retry sync later
    return {
      recovered: true,
      message: 'Cached locally. Will retry sync when online.',
      action: 'cache_and_retry',
    }
  }

  private async recoverFromCRMError(
    error: ContextError,
    context: any
  ): Promise<RecoveryResult> {
    // Re-authenticate if token expired
    if (error.message.includes('token') || error.message.includes('auth')) {
      return {
        recovered: true,
        message: 'Re-authenticating...',
        action: 'reauth',
      }
    }

    return { recovered: false, error }
  }
}

interface RecoveryResult {
  recovered: boolean
  message?: string
  retry?: { delay?: number; maxAttempts?: number; useOCR?: boolean }
  action?: string
  error?: ContextError
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
// src/context/__tests__/parsers.test.ts

describe('Document Parsers', () => {
  describe('PDFParser', () => {
    it('should extract text from PDF', async () => {
      const parser = new PDFParser()
      const result = await parser.parse('./fixtures/sample.pdf', 'test-id')

      expect(result.content).toBeTruthy()
      expect(result.metadata.pageCount).toBeGreaterThan(0)
    })

    it('should handle encrypted PDFs', async () => {
      const parser = new PDFParser()
      await expect(
        parser.parse('./fixtures/encrypted.pdf', 'test-id')
      ).rejects.toThrow('encrypted')
    })
  })

  describe('ExcelParser', () => {
    it('should detect customer data schema', async () => {
      const parser = new ExcelParser()
      const result = await parser.parse('./fixtures/customers.xlsx', 'test-id')

      expect(result.structuredData).toBeDefined()
      expect(result.metadata.detectedSchema?.type).toBe('customer_data')
    })

    it('should parse multi-sheet workbooks', async () => {
      const parser = new ExcelParser()
      const result = await parser.parse(
        './fixtures/multi-sheet.xlsx',
        'test-id'
      )

      expect(result.structuredData?.sheets).toHaveLength(3)
    })
  })
})

// src/context/__tests__/chunker.test.ts

describe('DocumentChunker', () => {
  it('should chunk text with overlap', () => {
    const chunker = new DocumentChunker()
    const text = 'a'.repeat(5000) // Long text

    const chunks = chunker.chunk(text, {
      maxTokens: 1000,
      overlap: 200,
      strategy: 'fixed',
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].metadata.tokenCount).toBeLessThanOrEqual(1000)
  })

  it('should respect sentence boundaries', () => {
    const chunker = new DocumentChunker()
    const text = 'First sentence. Second sentence. Third sentence.'

    const chunks = chunker.chunk(text, {
      maxTokens: 50,
      overlap: 10,
      strategy: 'sentence',
    })

    // Should not split mid-sentence
    chunks.forEach(chunk => {
      expect(chunk.content.match(/\.\s*$/)).toBeTruthy()
    })
  })
})
```

### 10.2 Integration Tests

```typescript
// src/context/__tests__/integration.test.ts

describe('Context Pipeline Integration', () => {
  let contextManager: ContextManager

  beforeAll(async () => {
    contextManager = new ContextManager({
      vectorStore: mockVectorStore,
      documentStore: mockDocumentStore,
      embedder: mockEmbedder,
    })
  })

  it('should process PDF end-to-end', async () => {
    const result = await contextManager.processFile('./fixtures/sample.pdf', {
      userId: 'test-user',
      type: 'strategy',
    })

    expect(result.documentId).toBeDefined()
    expect(result.status).toBe('indexed')
    expect(result.chunkCount).toBeGreaterThan(0)
  })

  it('should generate personas from customer CSV', async () => {
    // Upload CSV
    const doc = await contextManager.processFile('./fixtures/customers.csv', {
      userId: 'test-user',
      type: 'customer_data',
    })

    // Generate personas
    const personas = await contextManager.generatePersonas({
      userId: 'test-user',
      count: 10,
      sourceDocuments: [doc.documentId],
    })

    expect(personas).toHaveLength(10)
    expect(personas[0].name).toBeTruthy()
    expect(personas[0].sourceAttribution).toBeDefined()
  })

  it('should search across multiple documents', async () => {
    // Upload multiple docs
    await contextManager.processFile('./fixtures/strategy.pdf', {
      userId: 'test-user',
      type: 'strategy',
    })
    await contextManager.processFile('./fixtures/feedback.csv', {
      userId: 'test-user',
      type: 'feedback',
    })

    // Search
    const results = await contextManager.search('test-user', 'pricing strategy')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThan(0.7)
  })
})
```

### 10.3 E2E Tests

```typescript
// e2e/context-flow.test.ts

describe('E2E: Context Upload and Usage', () => {
  it('should upload document → generate personas → run experiment', async () => {
    // 1. Upload customer data
    await app.client.execute(filePath => {
      window.electronAPI.uploadContext(filePath, {
        type: 'customer_data',
      })
    }, './fixtures/customers.csv')

    // Wait for processing
    await app.client.waitUntil(
      async () => {
        const status = await app.client.execute(() => {
          return window.electronAPI.getContextStatus()
        })
        return status.processingComplete
      },
      { timeout: 30000 }
    )

    // 2. Generate personas
    await app.client.click('#generate-personas-btn')
    await app.client.waitForExist('.persona-card', { timeout: 10000 })

    const personas = await app.client.$$('.persona-card')
    expect(personas).toHaveLength(10)

    // 3. Run experiment with generated personas
    await app.client.click('#run-experiment-btn')
    await app.client.waitForExist('.experiment-results', { timeout: 60000 })

    const results = await app.client.$('.experiment-results')
    expect(await results.isDisplayed()).toBe(true)
  })
})
```

---

## Summary

This implementation spec provides:

1. **Complete file upload system** with validation and temp storage
2. **5 document parsers** (PDF, Excel, CSV, Word, Text) with smart schema detection
3. **Chunking and embedding pipeline** with configurable strategies
4. **Vector storage** (Pinecone) with semantic search
5. **CRM integration framework** with base connector pattern
6. **Persona generation** from real customer data with source attribution
7. **Context-aware AI** with search tools for Enhanced Assistant
8. **IPC handlers** for all context operations
9. **Error handling & recovery** strategies
10. **Comprehensive testing** (unit, integration, E2E)

**Key Implementation Decisions**:

- **OpenAI embeddings** for V1 (text-embedding-3-small, $0.02/1M tokens)
- **Pinecone free tier** (100k vectors, enough for ~100 documents)
- **Convex** for document metadata and structured data
- **Local temp storage** for file processing
- **Attio as first CRM** (see separate connector doc)
- **Source attribution** for all generated personas
- **Offline-first** with background sync

**Next Steps**:

1. Implement Attio connector (see next document)
2. Set up Pinecone index
3. Create IPC handlers
4. Build Context Library UI
5. Test end-to-end flow

**Estimated Effort**:

- Week 1-2: File parsers + chunking + embeddings
- Week 3: Vector storage + search
- Week 4: Attio connector
- Week 5: Persona generation
- Week 6: UI + testing
