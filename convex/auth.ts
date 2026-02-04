import { v } from 'convex/values'
import { mutation, query, MutationCtx, QueryCtx } from './_generated/server'

/**
 * Get the current user's Clerk ID from the auth context.
 * Throws an error if the user is not authenticated.
 */
export async function getCurrentUserClerkId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthenticated: Must be signed in to perform this action')
  }
  // Use identity.subject which contains the Clerk user ID
  const clerkUserId = identity.subject
  if (!clerkUserId) {
    throw new Error('Invalid identity: missing subject')
  }
  return clerkUserId
}
