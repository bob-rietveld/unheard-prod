import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient, Authenticated, Unauthenticated } from 'convex/react'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
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

    console.log('Starting Clerk initialization...')

    // Add timeout to detect hanging initialization
    const timeoutId = setTimeout(() => {
      console.error('Clerk initialization timeout after 10 seconds')
      setError(
        'Clerk initialization timed out. Check network and configuration.'
      )
    }, 10000)

    // Initialize Clerk with Tauri-specific configuration
    initClerk()
      .then(clerkInstance => {
        clearTimeout(timeoutId)
        console.log('Clerk initialized successfully')
        setClerk(clerkInstance)
      })
      .catch(err => {
        clearTimeout(timeoutId)
        console.error('Failed to initialize Clerk:', err)
        setError(err?.message || 'Failed to initialize authentication')
      })

    return () => clearTimeout(timeoutId)
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
    <ClerkProvider
      publishableKey={publishableKey}
      Clerk={clerk}
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ConvexAuthProvider>
        <QueryClientProvider client={queryClient}>
          {/* Use Convex's authentication components per Clerk docs */}
          <Authenticated>
            <App />
            {import.meta.env.DEV && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </Authenticated>
          <Unauthenticated>
            <SignInPage />
          </Unauthenticated>
        </QueryClientProvider>
      </ConvexAuthProvider>
    </ClerkProvider>
  )
}
