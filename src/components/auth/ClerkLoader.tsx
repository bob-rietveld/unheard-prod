import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react'
import { initClerk } from 'tauri-plugin-clerk'
import type { Clerk } from '@clerk/clerk-js'
import App from '@/App'
import { queryClient } from '@/lib/query-client'
import { SignInPage } from './SignInPage'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

export function ClerkLoader() {
  const [clerk, setClerk] = React.useState<Clerk | null>(null)

  React.useEffect(() => {
    initClerk().then(setClerk)
  }, [])

  if (!clerk) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading authentication...</p>
      </div>
    )
  }

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
      Clerk={clerk}
    >
      <ConvexProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          <SignedIn>
            <App />
            <ReactQueryDevtools initialIsOpen={false} />
          </SignedIn>
          <SignedOut>
            <SignInPage />
          </SignedOut>
        </QueryClientProvider>
      </ConvexProvider>
    </ClerkProvider>
  )
}
