/**
 * TanStack Query hooks for experiment management.
 * Uses the useConvex() pattern (NOT @convex-dev/react-query).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { executeExperiment } from '@/lib/experiment-runner'

/**
 * Query key factory for experiments.
 */
export const experimentsKeys = {
  all: ['experiments'] as const,
  byProject: (projectId: Id<'projects'>) =>
    [...experimentsKeys.all, 'byProject', projectId] as const,
  byDecision: (decisionId: Id<'decisions'>) =>
    [...experimentsKeys.all, 'byDecision', decisionId] as const,
  detail: (id: Id<'experiments'>) =>
    [...experimentsKeys.all, id] as const,
}

/**
 * Hook to fetch a single experiment by ID.
 */
export function useExperiment(id: Id<'experiments'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: experimentsKeys.detail(id!),
    queryFn: () => convex.query(api.experiments.getExperiment, { id: id! }),
    enabled: !!id,
  })
}

/**
 * Hook to fetch experiments for a project, ordered by most recent first.
 */
export function useProjectExperiments(projectId: Id<'projects'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: experimentsKeys.byProject(projectId!),
    queryFn: () =>
      convex.query(api.experiments.listByProject, { projectId: projectId! }),
    enabled: !!projectId,
  })
}

/**
 * Hook to get the experiment linked to a specific decision.
 */
export function useExperimentByDecision(
  decisionId: Id<'decisions'> | null
) {
  const convex = useConvex()

  return useQuery({
    queryKey: experimentsKeys.byDecision(decisionId!),
    queryFn: () =>
      convex.query(api.experiments.getByDecision, {
        decisionId: decisionId!,
      }),
    enabled: !!decisionId,
  })
}

/**
 * Hook to trigger experiment execution.
 * Orchestrates the full flow: read YAML -> Convex -> Modal -> results -> git.
 */
export function useRunExperiment() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      yamlFilename: string
      projectPath: string
      projectId: Id<'projects'>
      decisionId?: Id<'decisions'>
    }) => {
      await executeExperiment({
        yamlFilename: params.yamlFilename,
        projectPath: params.projectPath,
        projectId: params.projectId,
        decisionId: params.decisionId,
        convex,
      })
    },
    onSuccess: (_data, variables) => {
      // Invalidate relevant queries so they refetch
      queryClient.invalidateQueries({
        queryKey: experimentsKeys.byProject(variables.projectId),
      })
      if (variables.decisionId) {
        queryClient.invalidateQueries({
          queryKey: experimentsKeys.byDecision(variables.decisionId),
        })
      }
    },
  })
}
