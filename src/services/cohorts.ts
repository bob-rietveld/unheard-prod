/**
 * TanStack Query hooks for cohort management.
 * Uses the useConvex() pattern (NOT @convex-dev/react-query).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

/**
 * Query key factory for cohorts.
 */
export const cohortKeys = {
  all: ['cohorts'] as const,
  byProject: (projectId: Id<'projects'>) =>
    [...cohortKeys.all, 'byProject', projectId] as const,
  detail: (id: Id<'cohorts'>) =>
    [...cohortKeys.all, id] as const,
  members: (id: Id<'cohorts'>) =>
    [...cohortKeys.all, id, 'members'] as const,
}

/**
 * Hook to fetch all cohorts for a project.
 */
export function useProjectCohorts(projectId: Id<'projects'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: cohortKeys.byProject(projectId!),
    queryFn: () =>
      convex.query(api.cohorts.listByProject, { projectId: projectId! }),
    enabled: !!projectId,
  })
}

/**
 * Hook to fetch a single cohort by ID.
 */
export function useCohort(id: Id<'cohorts'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: cohortKeys.detail(id!),
    queryFn: () => convex.query(api.cohorts.get, { id: id! }),
    enabled: !!id,
  })
}

/**
 * Hook to fetch all member records for a cohort.
 */
export function useCohortMembers(id: Id<'cohorts'> | null) {
  const convex = useConvex()

  return useQuery({
    queryKey: cohortKeys.members(id!),
    queryFn: () => convex.query(api.cohorts.getMembers, { id: id! }),
    enabled: !!id,
  })
}

/**
 * Hook to create a new cohort.
 * Invalidates byProject queries on success.
 */
export function useCreateCohort() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      projectId: Id<'projects'>
      name: string
      description?: string
      memberIds: Id<'attioImports'>[]
    }) => {
      return await convex.mutation(api.cohorts.create, args)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: cohortKeys.byProject(variables.projectId),
      })
    },
  })
}

/**
 * Hook to update cohort metadata.
 * Invalidates detail and byProject queries on success.
 */
export function useUpdateCohort() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      id: Id<'cohorts'>
      projectId: Id<'projects'>
      name?: string
      description?: string
    }) => {
      return await convex.mutation(api.cohorts.update, {
        id: args.id,
        name: args.name,
        description: args.description,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: cohortKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: cohortKeys.byProject(variables.projectId),
      })
    },
  })
}

/**
 * Hook to add members to a cohort.
 * Invalidates detail and members queries on success.
 */
export function useAddCohortMembers() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      id: Id<'cohorts'>
      projectId: Id<'projects'>
      memberIds: Id<'attioImports'>[]
    }) => {
      return await convex.mutation(api.cohorts.addMembers, {
        id: args.id,
        memberIds: args.memberIds,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: cohortKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: cohortKeys.members(variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: cohortKeys.byProject(variables.projectId),
      })
    },
  })
}

/**
 * Hook to remove members from a cohort.
 * Invalidates detail and members queries on success.
 */
export function useRemoveCohortMembers() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      id: Id<'cohorts'>
      projectId: Id<'projects'>
      memberIds: Id<'attioImports'>[]
    }) => {
      return await convex.mutation(api.cohorts.removeMembers, {
        id: args.id,
        memberIds: args.memberIds,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: cohortKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: cohortKeys.members(variables.id),
      })
      queryClient.invalidateQueries({
        queryKey: cohortKeys.byProject(variables.projectId),
      })
    },
  })
}

/**
 * Hook to delete a cohort.
 * Invalidates byProject queries on success.
 */
export function useDeleteCohort() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: {
      id: Id<'cohorts'>
      projectId: Id<'projects'>
    }) => {
      return await convex.mutation(api.cohorts.remove, { id: args.id })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: cohortKeys.byProject(variables.projectId),
      })
    },
  })
}
