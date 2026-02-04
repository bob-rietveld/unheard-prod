import { SignIn } from '@clerk/clerk-react'

export function SignInPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
