# fn-1-phase-1-context-upload-git-integration.1 Dependencies & Clerk auth setup

## Description

Install dependencies and set up Clerk authentication via tauri-plugin-clerk. No Convex auth needed.

**Size:** S
**Files:** `package.json`, `convex/schema.ts`, `src/main.tsx`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`

## Approach

**Dependencies Installation**:

```bash
# Rust crates
cd src-tauri
cargo add git2 csv lopdf "calamine@0.26" --features xlsb
cargo add tauri-plugin-clerk tauri-plugin-http tauri-plugin-store

# npm packages
cd ..
npm install @clerk/clerk-react tauri-plugin-clerk
```

**Clerk Setup** (create account and get publishable key):

1. Sign up at [clerk.com](https://clerk.com)
2. Create new application
3. Enable email/password authentication
4. Copy publishable key to `.env`:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

**Tauri Plugin Registration**:

```rust
// src-tauri/src/main.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clerk::init())
        // ... other plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Tauri Capabilities** (add Clerk permissions):

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "clerk:default",
    "http:default",
    "http:allow-fetch",
    "store:default"
  ]
}
```

**main.tsx Integration** - Clerk provider:

```typescript
// src/main.tsx
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';
import { initClerk } from 'tauri-plugin-clerk';

const clerkPromise = initClerk();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      Clerk={clerkPromise}
    >
      <SignedIn>
        <App />
      </SignedIn>
      <SignedOut>
        <SignInPage />
      </SignedOut>
    </ClerkProvider>
  </React.StrictMode>
);
```

**SignInPage Component**:

```typescript
// src/components/auth/SignInPage.tsx
import { SignIn } from '@clerk/clerk-react';

export function SignInPage() {
  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn />
    </div>
  );
}
```

**Convex Schema** (no authTables - use clerkUserId):

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  contextFiles: defineTable({
    clerkUserId: v.string(), // Clerk user ID from frontend
    projectId: v.id('projects'),
    originalFilename: v.string(),
    storedFilename: v.string(),
    fileType: v.string(),
    detectedType: v.optional(v.string()),
    rows: v.optional(v.number()),
    columns: v.optional(v.array(v.string())),
    preview: v.optional(v.string()),
    pages: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    sizeBytes: v.number(),
    relativeFilePath: v.string(),
    isLFS: v.boolean(),
    uploadedAt: v.number(),
    syncStatus: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('error')
    ),
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId']),
})
```

**Convex Mutation** (accepts clerkUserId from frontend):

```typescript
// convex/contexts.ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    clerkUserId: v.string(), // From Clerk on frontend
    projectId: v.id('projects'),
    originalFilename: v.string(),
    storedFilename: v.string(),
    fileType: v.string(),
    detectedType: v.optional(v.string()),
    rows: v.optional(v.number()),
    columns: v.optional(v.array(v.string())),
    preview: v.optional(v.string()),
    pages: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    sizeBytes: v.number(),
    relativeFilePath: v.string(),
    isLFS: v.boolean(),
    uploadedAt: v.number(),
    syncStatus: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('error')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('contextFiles', args)
  },
})
```

**Getting Clerk User ID in Components**:

```typescript
import { useUser } from '@clerk/clerk-react'

function UploadComponent() {
  const { user } = useUser()
  const clerkUserId = user?.id // Use this when calling Convex mutations
}
```

## Key Context

- **tauri-plugin-clerk**: Bridges Clerk JS and Tauri for native auth
- **No Convex auth**: Simple clerkUserId string field (not Id<'users'>)
- **Session persistence**: Handled by tauri-plugin-store automatically
- **SignedIn/SignedOut**: Clerk components gate app UI
- **Email/password**: Phase 1 auth method (OAuth has plugin limitations)
- **Publishable key**: Store in .env, never commit to git

## Acceptance

- [ ] Rust crates installed (git2, csv, lopdf, calamine, tauri-plugin-clerk, tauri-plugin-http, tauri-plugin-store)
- [ ] @clerk/clerk-react and tauri-plugin-clerk npm packages installed
- [ ] Clerk app created with email/password enabled
- [ ] VITE_CLERK_PUBLISHABLE_KEY in .env
- [ ] Tauri plugins registered in main.rs
- [ ] Clerk permissions added to capabilities/default.json
- [ ] main.tsx wrapped with ClerkProvider and initClerk()
- [ ] SignedIn/SignedOut gates app UI
- [ ] SignInPage component created
- [ ] contextFiles schema uses clerkUserId: v.string()
- [ ] Convex mutation accepts clerkUserId from args
- [ ] npx convex dev runs without errors
- [ ] Schema deployed successfully
- [ ] User can sign in and session persists

## Done summary

Implemented Clerk authentication with Convex backend integration, installed file parsing dependencies, and established foundation for context file uploads with server-side security.

## Evidence

- Commits:
- Tests:
- PRs:
