/**
 * TanStack Query hooks for decision management.
 * Provides React hooks for querying and mutating decision data in Convex.
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'

/**
 * Query key factory for decisions.
 * Follows TanStack Query best practices for cache invalidation.
 */
export const decisionsKeys = {
  all: ['decisions'] as const,
  lists: () => [...decisionsKeys.all, 'list'] as const,
  list: (userId: string) => [...decisionsKeys.lists(), userId] as const,
  byProject: (projectId: Id<'projects'>) =>
    [...decisionsKeys.all, 'byProject', projectId] as const,
  byTemplate: (templateId: Id<'experimentTemplates'>) =>
    [...decisionsKeys.all, 'byTemplate', templateId] as const,
  detail: (id: Id<'decisions'>) => [...decisionsKeys.all, id] as const,
}

/**
 * Hook to fetch all decisions for a user.
 */
export function useDecisions(clerkUserId: string) {
  const convex = useConvex()

  return useQuery({
    queryKey: decisionsKeys.list(clerkUserId),
    queryFn: () => convex.query(api.decisions.list, { clerkUserId }),
    enabled: !!clerkUserId,
  })
}

/**
 * Hook to fetch decisions by project.
 */
export function useDecisionsByProject(projectId: Id<'projects'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: decisionsKeys.byProject(projectId!),
    queryFn: () => convex.query(api.decisions.byProject, { projectId: projectId! }),
    enabled: !!projectId,
  })
}

/**
 * Hook to fetch decisions by template.
 */
export function useDecisionsByTemplate(
  templateId: Id<'experimentTemplates'> | null
) {
  const convex = useConvex()

  return useQuery({
    queryKey: decisionsKeys.byTemplate(templateId!),
    queryFn: () =>
      convex.query(api.decisions.byTemplate, { templateId: templateId! }),
    enabled: !!templateId,
  })
}

/**
 * Hook to fetch a single decision by ID.
 */
export function useDecision(id: Id<'decisions'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: decisionsKeys.detail(id!),
    queryFn: () => convex.query(api.decisions.get, { id: id! }),
    enabled: !!id,
  })
}

/**
 * Input for updating a decision with log metadata.
 */
export interface UpdateDecisionWithLogInput {
  title: string
  description?: string
  templateId?: Id<'experimentTemplates'>
  configData?: Record<string, unknown>
  markdownFilePath?: string
  projectId?: Id<'projects'>
  clerkUserId: string
}

/**
 * Hook to update a decision with decision log metadata.
 * This mutation is called after the decision log markdown file is created and committed to Git.
 *
 * Returns the decision ID (creates new or updates existing).
 */
export function useUpdateDecisionWithLog() {
  const convexMutation = useConvexMutation(api.decisions.updateWithLog)

  return useMutation({
    mutationFn: async (input: UpdateDecisionWithLogInput) => {
      return await convexMutation({
        title: input.title,
        description: input.description,
        templateId: input.templateId,
        configData: input.configData,
        markdownFilePath: input.markdownFilePath,
        projectId: input.projectId,
        clerkUserId: input.clerkUserId,
      })
    },
  })
}
