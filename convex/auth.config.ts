// Convex Auth Configuration
// This configures Convex to accept Clerk JWT tokens for authentication

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || 'https://clerk.your-domain.com',
      applicationID: 'convex',
    },
  ],
}
