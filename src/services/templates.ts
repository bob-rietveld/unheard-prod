import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import type { Id } from '../../convex/_generated/dataModel'

/**
 * Query keys for templates.
 * Follows TanStack Query best practices for cache management.
 */
export const templateKeys = {
  all: ['templates'] as const,
  list: (category?: string) =>
    category
      ? [...templateKeys.all, 'list', category]
      : ([...templateKeys.all, 'list'] as const),
  detail: (id: string) => [...templateKeys.all, id] as const,
  bySlug: (slug: string) => [...templateKeys.all, 'slug', slug] as const,
}

/**
 * Hook to fetch all published templates.
 * Optionally filter by category.
 *
 * Uses Convex real-time subscriptions via useConvex() hook.
 */
export function useTemplates(category?: string) {
  const convex = useConvex()

  return useQuery({
    queryKey: templateKeys.list(category),
    queryFn: async () => {
      logger.debug('Fetching templates', { category })
      return await convex.query(api.templates.list, { category })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to fetch a single template by ID.
 */
export function useTemplate(id: Id<'experimentTemplates'>) {
  const convex = useConvex()

  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      logger.debug('Fetching template', { id })
      return await convex.query(api.templates.get, { id })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to fetch a single template by slug.
 */
export function useTemplateBySlug(slug: string) {
  const convex = useConvex()

  return useQuery({
    queryKey: templateKeys.bySlug(slug),
    queryFn: async () => {
      logger.debug('Fetching template by slug', { slug })
      return await convex.query(api.templates.getBySlug, { slug })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

interface CreateTemplateArgs {
  name: string
  slug: string
  category: string
  description: string
  yamlContent: string
  version: string
  isPublished: boolean
}

/**
 * Hook to create a new template.
 * Admin/system use only.
 */
export function useCreateTemplate() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: CreateTemplateArgs) => {
      logger.debug('Creating template', { args })
      return await convex.mutation(api.templates.create, args)
    },
    onSuccess: () => {
      // Invalidate all template lists
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
      logger.info('Template created successfully')
      toast.success('Template created')
    },
    onError: (error: Error) => {
      logger.error('Failed to create template', { error: error.message })
      toast.error('Failed to create template', { description: error.message })
    },
  })
}

interface UpdateTemplateArgs {
  id: Id<'experimentTemplates'>
  name?: string
  description?: string
  yamlContent?: string
  version?: string
  isPublished?: boolean
}

/**
 * Hook to update an existing template.
 * Admin/system use only.
 */
export function useUpdateTemplate() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: UpdateTemplateArgs) => {
      logger.debug('Updating template', { args })
      return await convex.mutation(api.templates.update, args)
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific template and all lists
      queryClient.invalidateQueries({
        queryKey: templateKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
      logger.info('Template updated successfully')
      toast.success('Template updated')
    },
    onError: (error: Error) => {
      logger.error('Failed to update template', { error: error.message })
      toast.error('Failed to update template', { description: error.message })
    },
  })
}

/**
 * Hook to publish a template.
 */
export function usePublishTemplate() {
  const convex = useConvex()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: Id<'experimentTemplates'>) => {
      logger.debug('Publishing template', { id })
      return await convex.mutation(api.templates.publish, { id })
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
      logger.info('Template published successfully')
      toast.success('Template published')
    },
    onError: (error: Error) => {
      logger.error('Failed to publish template', { error: error.message })
      toast.error('Failed to publish template', { description: error.message })
    },
  })
}
