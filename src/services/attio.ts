/**
 * TanStack Query hooks for Attio CRM import management.
 * Uses the useConvex() pattern (NOT @convex-dev/react-query).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

/**
 * Query key factory for Attio imports.
 */
export const attioKeys = {
  all: ['attioImports'] as const,
  byProject: (projectId: Id<'projects'>) =>
    [...attioKeys.all, 'byProject', projectId] as const,
  byType: (projectId: Id<'projects'>, objectType: string) =>
    [...attioKeys.all, 'byType', projectId, objectType] as const,
  detail: (id: Id<'attioImports'>) =>
    [...attioKeys.all, id] as const,
}

/**
 * Hook to fetch all Attio imports for a project.
 */
export function useAttioImports(projectId: Id<'projects'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: attioKeys.byProject(projectId!),
    queryFn: () =>
      convex.query(api.attio.listByProject, { projectId: projectId! }),
    enabled: !!projectId,
  })
}

/**
 * Hook to fetch Attio imports filtered by object type within a project.
 */
export function useAttioImportsByType(
  projectId: Id<'projects'> | null,
  objectType: 'company' | 'person' | 'list_entry'
) {
  const convex = useConvex()

  return useQuery({
    queryKey: attioKeys.byType(projectId!, objectType),
    queryFn: () =>
      convex.query(api.attio.listByType, {
        projectId: projectId!,
        objectType,
      }),
    enabled: !!projectId,
  })
}

/**
 * Hook to fetch a single Attio import by ID.
 */
export function useAttioImport(id: Id<'attioImports'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: attioKeys.detail(id!),
    queryFn: () => convex.query(api.attio.get, { id: id! }),
    enabled: !!id,
  })
}

/**
 * Hook to create a new Attio import record.
 * Invalidates byProject queries on success.
 */
export function useCreateAttioImport() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      projectId: Id<'projects'>
      attioRecordId: string
      attioObjectType: 'company' | 'person' | 'list_entry'
      name: string
      attioWebUrl?: string
      localFilePath: string
      attributes?: unknown
      listSlug?: string
      importedAt: number
      syncStatus: 'synced' | 'pending' | 'error'
    }) => {
      return await convex.mutation(api.attio.create, args)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attioKeys.byProject(variables.projectId),
      })
    },
  })
}

/**
 * Hook to delete an Attio import record.
 * Invalidates byProject queries on success.
 */
export function useRemoveAttioImport() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      id: Id<'attioImports'>
      projectId: Id<'projects'>
    }) => {
      return await convex.mutation(api.attio.remove, { id: args.id })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attioKeys.byProject(variables.projectId),
      })
    },
  })
}

/**
 * Hook to link an Attio import to an experiment.
 * Invalidates the import detail query on success.
 */
export function useLinkImportToExperiment() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      id: Id<'attioImports'>
      experimentId: Id<'experiments'>
    }) => {
      return await convex.mutation(api.attio.linkToExperiment, args)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: attioKeys.detail(variables.id),
      })
    },
  })
}
