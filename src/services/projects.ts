import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { commands } from '@/lib/tauri-bindings'
import { useProjectStore } from '@/store/project-store'
import type { Id } from '../../convex/_generated/dataModel'

// Query keys for project-related data
export const projectQueryKeys = {
  all: ['projects'] as const,
  lists: () => [...projectQueryKeys.all, 'list'] as const,
  list: (filters?: object) => [...projectQueryKeys.lists(), filters] as const,
  details: () => [...projectQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectQueryKeys.details(), id] as const,
}

/**
 * Get all projects for the authenticated user from Convex.
 */
export function useProjects() {
  return useConvexQuery(api.projects.list)
}

/**
 * Get a specific project by ID from Convex.
 */
export function useProject(id: Id<'projects'>) {
  return useConvexQuery(api.projects.get, { id })
}

/**
 * Create a new project in Convex and initialize Git repository locally.
 * This mutation combines Convex DB creation with local Git setup.
 */
export function useCreateProject() {
  const convexCreate = useConvexMutation(api.projects.create)

  return useMutation({
    mutationFn: async (args: {
      name: string
      description?: string
      localPath: string
    }) => {
      logger.info('Creating new project', {
        name: args.name,
        path: args.localPath,
      })

      // Step 1: Create project in Convex first (fail fast if auth/network issues)
      const projectId = await convexCreate({
        name: args.name,
        description: args.description,
      })

      logger.info('Project created in Convex', { projectId })

      // Step 2: Initialize Git repository locally
      // If this fails, we have a DB project with no local repo (partial success)
      const gitResult = await commands.initializeGit(args.localPath)

      if (gitResult.status === 'error') {
        logger.error('Failed to initialize Git repository', {
          error: gitResult.error,
          projectId,
        })
        throw new Error(
          `Git initialization failed: ${gitResult.error}. Project created in database (ID: ${projectId}) but local repository setup incomplete.`
        )
      }

      if (!gitResult.data.success) {
        throw new Error(
          `Git initialization failed. Project created in database (ID: ${projectId}) but local repository setup incomplete.`
        )
      }

      logger.info('Git repository initialized', {
        path: gitResult.data.path,
        lfs: gitResult.data.lfsAvailable,
        commit: gitResult.data.commitHash,
      })

      return {
        projectId,
        projectName: args.name,
        projectDescription: args.description,
        gitResult: gitResult.data,
      }
    },
    onSuccess: (data, variables) => {
      // Note: Convex queries update automatically via subscriptions
      // No need for manual invalidation

      // Show success toast with LFS warning if needed
      if (!data.gitResult.lfsAvailable) {
        toast.warning('Project created without Git LFS', {
          description:
            'Git LFS is not installed. Large files may impact performance.',
        })
      } else {
        toast.success('Project created successfully')
      }

      logger.info('Project creation completed', {
        projectId: data.projectId,
        name: variables.name,
      })
    },
    onError: (error: Error) => {
      logger.error('Failed to create project', { error: error.message })
      toast.error('Failed to create project', {
        description: error.message,
      })
    },
  })
}

/**
 * Update project metadata (name, description) in Convex.
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()
  const convexUpdate = useConvexMutation(api.projects.update)

  return useMutation({
    mutationFn: async (args: {
      id: Id<'projects'>
      name?: string
      description?: string
    }) => {
      logger.info('Updating project', { id: args.id })
      await convexUpdate(args)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: projectQueryKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() })
      toast.success('Project updated')
      logger.info('Project updated successfully', { id: variables.id })
    },
    onError: (error: Error) => {
      logger.error('Failed to update project', { error: error.message })
      toast.error('Failed to update project', {
        description: error.message,
      })
    },
  })
}

/**
 * Archive a project (soft delete) in Convex.
 */
export function useArchiveProject() {
  const queryClient = useQueryClient()
  const convexArchive = useConvexMutation(api.projects.archive)
  const currentProject = useProjectStore(state => state.currentProject)
  const setCurrentProject = useProjectStore(state => state.setCurrentProject)

  return useMutation({
    mutationFn: async (id: Id<'projects'>) => {
      logger.info('Archiving project', { id })
      await convexArchive({ id })
    },
    onSuccess: (_, id) => {
      // If the archived project was the current one, clear it
      if (currentProject?._id === id) {
        setCurrentProject(null)
        logger.info('Cleared current project after archiving')
      }

      queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() })
      toast.success('Project archived')
      logger.info('Project archived successfully', { id })
    },
    onError: (error: Error) => {
      logger.error('Failed to archive project', { error: error.message })
      toast.error('Failed to archive project', {
        description: error.message,
      })
    },
  })
}

/**
 * Check if Git LFS is available on the system.
 * Useful for showing warnings or installation prompts.
 */
export function useDetectGitLFS() {
  return useQuery({
    queryKey: ['git-lfs', 'detect'],
    queryFn: async (): Promise<boolean> => {
      logger.debug('Detecting Git LFS availability')
      const result = await commands.detectGitLfs()

      if (result.status === 'error') {
        logger.warn('Failed to detect Git LFS', { error: result.error })
        return false
      }

      logger.info('Git LFS detection result', { available: result.data })
      return result.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - LFS installation state rarely changes
  })
}
