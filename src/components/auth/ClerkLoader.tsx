import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react'
import { initClerk } from 'tauri-plugin-clerk'
import type { Clerk } from '@clerk/clerk-js'
import App from '@/App'
import { queryClient } from '@/lib/query-client'
import { SignInPage } from './SignInPage'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

// Wrapper component to provide useAuth hook to ConvexProviderWithClerk
function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    // eslint-disable-next-line react-compiler/react-compiler
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}

export function ClerkLoader() {
  const [clerk, setClerk] = React.useState<Clerk | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

  React.useEffect(() => {
    if (!publishableKey || publishableKey === 'pk_test_placeholder') {
      setError('VITE_CLERK_PUBLISHABLE_KEY is not configured')
      return
    }

    // Initialize Clerk - the plugin gets the key from Rust side
    // but we override it with the JS-side ClerkProvider publishableKey prop
    initClerk()
      .then(setClerk)
      .catch((err) => {
        console.error('Failed to initialize Clerk:', err)
        setError(err?.message || 'Failed to initialize authentication')
      })
  }, [publishableKey])

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive font-semibold">Authentication Error</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <p className="text-muted-foreground text-xs">
          Check console for details and verify VITE_CLERK_PUBLISHABLE_KEY is set
        </p>
      </div>
    )
  }

  if (!clerk) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading authentication...</p>
      </div>
    )
  }

  return (
    // publishableKey must match the one used by the Rust plugin
    <ClerkProvider publishableKey={publishableKey} Clerk={clerk}>
      <ConvexAuthProvider>
        <QueryClientProvider client={queryClient}>
          <SignedIn>
            <App />
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
          </SignedIn>
          <SignedOut>
            <SignInPage />
          </SignedOut>
        </QueryClientProvider>
      </ConvexAuthProvider>
    </ClerkProvider>
  )
}
