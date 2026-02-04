import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutationHook,
} from 'convex/react'
import type { FunctionReference } from 'convex/server'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Wrapper around Convex query that integrates with TanStack Query.
 * Provides unified loading/error states and caching layer.
 *
 * @param queryKey - TanStack Query cache key
 * @param convexQuery - Convex query function from api
 * @param args - Arguments to pass to the Convex query
 * @returns TanStack Query result with Convex data
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useConvexData(
 *   ['projects', 'list'],
 *   api.projects.list,
 *   {}
 * )
 * ```
 */
export function useConvexData<T>(
  queryKey: readonly unknown[],
  convexQuery: FunctionReference<'query'>,
  args: Record<string, unknown>
) {
  const convexData = useConvexQuery(convexQuery, args)

  return useQuery({
    queryKey: [...queryKey, args],
    queryFn: () => {
      if (convexData === undefined) throw new Error('Loading')
      return convexData as T
    },
    enabled: convexData !== undefined,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Wrapper around Convex mutation that integrates with TanStack Query.
 * Handles cache invalidation and success callbacks.
 *
 * @param convexMutation - Convex mutation function from api
 * @param options - Configuration options
 * @param options.onSuccess - Callback on successful mutation
 * @param options.invalidateKeys - Query keys to invalidate after mutation
 * @returns TanStack Query mutation result
 *
 * @example
 * ```typescript
 * const createProject = useConvexMutation(api.projects.create, {
 *   invalidateKeys: [['projects', 'list']],
 *   onSuccess: () => toast.success('Project created')
 * })
 * ```
 */
export function useConvexMutation<TArgs, TResult>(
  convexMutation: FunctionReference<'mutation'>,
  options?: {
    onSuccess?: (data: TResult) => void
    invalidateKeys?: readonly unknown[][]
  }
) {
  const convexMutate = useConvexMutationHook(convexMutation)
  const queryClient = useQueryClient()

  return useMutation<TResult, Error, TArgs>({
    mutationFn: async (args: TArgs): Promise<TResult> => {
      return (await convexMutate(args)) as TResult
    },
    onSuccess: (data: TResult) => {
      options?.invalidateKeys?.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      options?.onSuccess?.(data)
    },
  })
}
