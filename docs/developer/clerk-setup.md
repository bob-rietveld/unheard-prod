# Clerk Authentication Setup

This project uses [Clerk](https://clerk.com) for authentication via the [tauri-plugin-clerk](https://github.com/Nipsuli/tauri-plugin-clerk) plugin.

## Initial Setup

### 1. Create a Clerk Account

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Choose "Email & Password" as the authentication method for Phase 1

### 2. Get Your Publishable Key

1. In the Clerk Dashboard, navigate to "API Keys"
2. Copy your "Publishable Key" (starts with `pk_test_...` for test/development)
3. Add it to your `.env.local` file:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
```

### 3. Configure JWT for Convex

1. In Clerk Dashboard, go to "JWT Templates"
2. Create a new template or use existing "Convex" template
3. Note the "Issuer" domain (e.g., `https://your-app.clerk.accounts.dev`)
4. Add it to your `.env.local` file:

```bash
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
```

This allows Convex to validate Clerk JWT tokens for server-side authentication.

### 3. Configure Authentication Settings

In your Clerk Dashboard:

1. Go to "User & Authentication" → "Email & Password"
2. Enable "Password" authentication
3. Configure password requirements as needed
4. Optionally enable email verification

## Architecture

### Session Persistence

The application uses `tauri-plugin-store` to persist Clerk sessions across app restarts. The session is stored in a secure local store managed by Tauri.

**Important**: The Clerk authentication flow works as follows:

1. **Environment loading**: In development, Rust loads `../.env.local` using `dotenvy` to read `VITE_CLERK_PUBLISHABLE_KEY`
2. **Rust plugin initialization**: Reads the key from environment and initializes `tauri-plugin-clerk`
3. **JS side initialization**: `initClerk()` fetches the Clerk instance from the plugin (with the key from step 1)
4. **ClerkProvider**: Wraps the app with the Clerk instance from `initClerk()`

The publishable key must be set in `.env.local` for development. The Rust code explicitly loads this file in debug builds using the `dotenvy` crate.

**Production builds**: Set `VITE_CLERK_PUBLISHABLE_KEY` as an environment variable in your deployment system (CI/CD, hosting platform, etc.) so it's available when the Rust code runs. The `dotenvy` loading is only active in development builds.

### Authentication Flow

```
User opens app
  ↓
ClerkLoader initializes Clerk instance via initClerk()
  ↓
If signed out → Show SignInPage (Clerk's SignIn component)
  ↓
User signs in with email/password
  ↓
Clerk session stored in tauri-plugin-store
  ↓
SignedIn component renders App
  ↓
User closes app
  ↓
User reopens app → Session restored from store
```

### User ID Mapping

- **Frontend**: Use `useUser()` from `@clerk/clerk-react` to get user information
- **Convex**: All tables use `clerkUserId: v.string()` field
- **Mutations**: DO NOT pass `clerkUserId` from frontend - it is derived server-side from authenticated identity

Example:

```typescript
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

function MyComponent() {
  const createContext = useMutation(api.contexts.create)

  const handleUpload = async (file: File) => {
    // clerkUserId is automatically derived server-side from auth context
    await createContext({
      projectId: selectedProjectId,
      // ... other fields (NO clerkUserId)
    })
  }
}
```

### Server-Side Authentication

All Convex mutations verify the user's identity server-side using Clerk JWT tokens:

1. `ConvexProviderWithClerk` passes Clerk auth tokens to Convex
2. Convex validates the JWT and extracts the Clerk user ID
3. Mutations use `getCurrentUserClerkId(ctx)` to get the authenticated user
4. User cannot spoof their identity or access other users' data

## OAuth Support (Phase 2)

OAuth providers (Google, GitHub, etc.) are planned for Phase 2. The current tauri-plugin-clerk version has limitations with OAuth flows in Tauri, which will be addressed in a future update.

## Troubleshooting

### "Loading authentication..." stuck

- Check that `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
- Verify the key is valid in Clerk Dashboard
- Check browser console for errors

### Session not persisting

- Ensure `tauri-plugin-store` is initialized BEFORE `tauri-plugin-clerk` in `lib.rs`
- Check that `.with_tauri_store()` is called in the Clerk plugin builder

### TypeScript errors

- Ensure `@clerk/clerk-react` and `tauri-plugin-clerk` are installed
- Run `npm install` to install dependencies
- Restart your TypeScript server

## References

- [Clerk Documentation](https://clerk.com/docs)
- [tauri-plugin-clerk GitHub](https://github.com/Nipsuli/tauri-plugin-clerk)
- [Clerk React SDK](https://clerk.com/docs/references/react/overview)
