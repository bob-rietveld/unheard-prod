# Convex Setup

Guide for integrating Convex as the cloud backend for collaborative features.

## Overview

Unheard uses a **hybrid data architecture**:

- **Cloud Data (Convex)**: User decisions, projects, analyses, synthetic datasets
- **Local Data (Tauri)**: App preferences, window state, UI state
- **Unified Access**: TanStack Query provides consistent API for both sources

```
React Components
    ↓
TanStack Query (unified caching)
    ↓         ↓
Convex     Tauri
(cloud)    (local)
```

## Initial Setup

### 1. Create Convex Project

```bash
# Install CLI globally (optional)
npm install -g convex

# Initialize Convex (first time only)
npx convex dev --once
```

This will:

- Create a Convex project at https://dashboard.convex.dev
- Generate `convex/` directory with schema and functions
- Add `.env.local` with your project URL

### 2. Configure Environment

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Update with your project URL from the Convex dashboard:

```bash
VITE_CONVEX_URL=https://your-project.convex.cloud
```

### 3. Start Development Servers

```bash
# Terminal 1: Convex dev server (watches convex/ directory)
npm run convex:dev

# Terminal 2: Tauri dev (runs Vite + Tauri)
npm run tauri:dev
```

## Architecture Patterns

### Query Pattern

Use `useConvexData` wrapper for queries (defined in `src/services/convex-wrapper.ts`):

```typescript
// convex/projects.ts
import { query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await ctx.auth.getUserIdentity()
    if (!userId) return []

    return await ctx.db
      .query('projects')
      .withIndex('by_user', q => q.eq('userId', userId.subject))
      .filter(q => q.eq(q.field('archived'), false))
      .collect()
  },
})
```

```typescript
// src/services/projects.ts
import { api } from '@/convex/_generated/api'
import { useConvexData } from './convex-wrapper'

export const projectQueryKeys = {
  all: ['projects'] as const,
  lists: () => [...projectQueryKeys.all, 'list'] as const,
}

export function useProjects() {
  return useConvexData(projectQueryKeys.lists(), api.projects.list, {})
}
```

### Mutation Pattern

Use `useConvexMutation` wrapper for mutations:

```typescript
// convex/projects.ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity()
    if (!userId) throw new Error('Not authenticated')

    return await ctx.db.insert('projects', {
      ...args,
      userId: userId.subject,
      archived: false,
      createdAt: Date.now(),
    })
  },
})
```

```typescript
// src/services/projects.ts
import { useConvexMutation } from './convex-wrapper'
import { toast } from 'sonner'

export function useCreateProject() {
  return useConvexMutation(api.projects.create, {
    invalidateKeys: [projectQueryKeys.lists()],
    onSuccess: () => {
      toast.success('Project created')
    },
  })
}
```

### Using in Components

Follow Zustand selector pattern (no destructuring):

```typescript
function ProjectsList() {
  const { data: projects, isLoading, error } = useProjects()
  const createProject = useCreateProject()

  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  const handleCreate = () => {
    createProject.mutate({
      name: 'New Project',
      description: 'Project description'
    })
  }

  return (
    <div>
      {projects?.map(project => (
        <ProjectCard key={project._id} project={project} />
      ))}
      <Button onClick={handleCreate}>Create Project</Button>
    </div>
  )
}
```

## Real-Time Updates

Convex automatically provides real-time subscriptions. When data changes in the database, all connected clients receive updates instantly.

```typescript
// This hook will automatically re-render when projects change
const { data: projects } = useProjects()

// No additional setup needed - real-time is built-in
```

## Authentication

Authentication will be added in Phase 2. For now, queries/mutations will work unauthenticated in development.

## Schema Design

Schema is defined in `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.id('users'),
    archived: v.boolean(),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  // Add more tables as needed
})
```

### Adding Fields

Convex uses **schemaless evolution**. Add fields to new documents, and handle missing fields in old documents:

```typescript
// Add new field to mutation
export const create = mutation({
  args: {
    name: v.string(),
    tags: v.optional(v.array(v.string())), // New field
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('projects', {
      ...args,
      tags: args.tags ?? [], // Default for new field
    })
  },
})

// Handle missing field in queries
export const list = query({
  handler: async ctx => {
    const projects = await ctx.db.query('projects').collect()
    return projects.map(p => ({
      ...p,
      tags: p.tags ?? [], // Default for old documents
    }))
  },
})
```

## Testing

### Unit Tests

Mock Convex hooks in tests:

```typescript
import { vi } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockData),
  useMutation: vi.fn(() => vi.fn()),
}))
```

### Integration Tests

Use ConvexTestingHelper for backend testing:

```typescript
import { convexTest } from 'convex-test'
import { api } from './_generated/api'
import schema from './schema'

describe('projects', () => {
  it('creates a project', async () => {
    const t = convexTest(schema)

    const projectId = await t.mutation(api.projects.create, {
      name: 'Test Project',
    })

    const projects = await t.query(api.projects.list, {})
    expect(projects).toHaveLength(1)
    expect(projects[0]._id).toBe(projectId)
  })
})
```

## Deployment

```bash
# Deploy to production
npm run convex:deploy

# Set production environment variable
# Add VITE_CONVEX_URL to your build process
```

## Offline Support

TanStack Query provides automatic offline support:

- Queries return cached data when offline
- Mutations queue and retry when connection restores
- Configure retry behavior in `src/lib/query-client.ts`

## Troubleshooting

### "Cannot read property 'undefined' of undefined"

**Cause**: Convex query returns `undefined` while loading.

**Solution**: Check `isLoading` state before accessing data:

```typescript
const { data, isLoading } = useProjects()
if (isLoading) return <Spinner />
// Now safe to use data
```

### "VITE_CONVEX_URL is not defined"

**Cause**: Missing `.env.local` file.

**Solution**: Copy `.env.local.example` to `.env.local` and add your Convex URL.

### Real-time updates not working

**Cause**: Not using Convex query hooks or missing ConvexProvider.

**Solution**: Ensure `ConvexProvider` wraps your app in `src/main.tsx` and use `useConvexData` wrapper.

## Migration from Local to Cloud

To migrate existing local data to Convex:

1. Create a migration Tauri command to read local data
2. Create a Convex mutation to insert data
3. Run migration on first launch after update
4. Mark migration as complete in preferences

See `data-persistence.md` for local data patterns.

## Related Documentation

- [State Management](./state-management.md) - TanStack Query layer
- [Data Persistence](./data-persistence.md) - Local data patterns
- [External APIs](./external-apis.md) - HTTP API patterns
- [Testing](./testing.md) - Testing strategies
