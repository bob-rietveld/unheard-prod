## Description

Implement template library in Convex and agent logic for intent classification and template recommendation.

**Size:** M
**Files:**

- `convex/schema.ts` (update)
- `convex/templates.ts` (new - queries/mutations)
- `convex/seed-templates.ts` (new - seed function)
- `src/services/templates.ts` (new - TanStack Query hooks)
- `src/lib/agent/intent-classifier.ts` (new)
- `src/lib/agent/system-prompts.ts` (new)

## Approach

**Template Storage**:

- Convex table `experimentTemplates` with fields: name, slug, category, description, yamlContent, version, isPublished
- 3 seed templates: investor-evaluation, pricing-strategy, product-roadmap
- YAML format from `.claude/plans/template-system-spec.md:489-538`

**Template Query Pattern** (CRITICAL - follow existing pattern):

```typescript
// src/services/templates.ts
export const templateKeys = {
  all: ['templates'] as const,
  list: () => [...templateKeys.all, 'list'] as const,
  detail: (id: string) => [...templateKeys.all, id] as const,
}

export function useTemplates() {
  const convex = useConvex()
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: () => convex.query(api.templates.list),
    staleTime: 1000 * 60 * 5,
  })
}
```

**Note**: Use `useConvex()` hook for query calls (not direct Convex client import). This matches existing project pattern for real-time subscriptions.

**Intent Classification**:

- Analyze user message for keywords (fundraising, pricing, roadmap)
- Simple keyword matching for MVP (no ML)
- Return 1-2 template suggestions with confidence scores

**System Prompt**:

- Modular prompt: role definition + available templates + guidelines
- Templates injected dynamically from Convex query
- Prompt located in `src/lib/agent/system-prompts.ts`

## Key Context

**Convex Real-time**:

- `useQuery` with `convex.query()` auto-subscribes to updates
- No manual invalidation needed (Convex pushes changes)
- Pass `"skip"` to conditionally skip query (not conditional hook calls)

**Template Seeding**:

- Run via `npx convex run seed:templates` after deployment
- Idempotent: Check if templates exist before inserting
- Log seeded template IDs

**Existing Convex Pattern**:

- Follow `src/services/preferences.ts:1-64` for TanStack Query wrapper
- Use `useConvex()` hook inside `queryFn`

## References

- Convex pattern: `src/services/preferences.ts:1-64`
- Schema: `convex/schema.ts:1-69`
- Template spec: `.claude/plans/template-system-spec.md`
- Agent spec: `.claude/plans/enhanced-assistant-spec.md`
- Task 2: Rust chat command for agent responses

## Acceptance

- [ ] Convex schema updated with `experimentTemplates` table
- [ ] Indexes: by_slug, by_category (with isPublished filter)
- [ ] Queries: `list()`, `get(id)`, `getBySlug(slug)`
- [ ] Mutations: `create(template)`, `update(id, fields)`, `publish(id)`
- [ ] Seed function creates 3 templates: investor-evaluation, pricing-strategy, product-roadmap
- [ ] YAML content validates against template spec schema
- [ ] TanStack Query hooks: `useTemplates()`, `useTemplate(id)`, `useCreateTemplate()`
- [ ] Intent classifier analyzes message and returns template suggestions
- [ ] Classifier handles: "raise funding" → investor, "pricing decision" → pricing, "feature priority" → roadmap
- [ ] System prompt includes all published templates dynamically
- [ ] System prompt defines agent role, conversation guidelines, output format
- [ ] Unit tests: Template queries return correct data
- [ ] Test: Intent classifier matches keywords to templates
- [ ] Test: System prompt includes template list
- [ ] Test: Seed function is idempotent (doesn't duplicate)
- [ ] Convex dev dashboard shows templates after seed
- [ ] Documentation: Update `docs/developer/convex-setup.md` with template schema
- [ ] Documentation: Update `docs/developer/data-persistence.md` with template patterns
- [ ] Documentation: Create `docs/developer/agent-system.md` (new)
