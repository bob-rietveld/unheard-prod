// Convex Auth Configuration for Clerk JWT validation
// See: https://docs.convex.dev/auth/clerk

export default {
  providers: [
    {
      // CLERK_FRONTEND_API_URL
      // For development: https://your-app.clerk.accounts.dev
      // Get this from your Clerk Dashboard -> JWT Templates -> Convex
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: 'convex',
    },
  ],
}
