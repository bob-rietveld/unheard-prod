import { v } from 'convex/values'
import { mutation, query, MutationCtx, QueryCtx } from './_generated/server'

/**
 * Get the current user's Clerk ID from the auth context.
 * Throws an error if the user is not authenticated.
 */
export async function getCurrentUserClerkId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthenticated: Must be signed in to perform this action')
  }
  // Clerk identity tokenIdentifier format: "https://clerk-domain.clerk.accounts.dev|user_xxx"
  // Extract the user ID after the pipe
  const clerkUserId = identity.tokenIdentifier.split('|')[1]
  if (!clerkUserId) {
    throw new Error('Invalid Clerk identity format')
  }
  return clerkUserId
}
