'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthForm from '@/components/AuthForm'

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSignup = async (data: { 
    email: string
    password: string
    displayName?: string 
  }) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          throw new Error(result.details.join(', '))
        }
        throw new Error(result.error || 'Signup failed')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login?registered=true')
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Welcome to Prompt Manager!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account has been created successfully. You can start using the app right away!
            </p>
            <p className="mt-1 text-center text-xs text-gray-500">
              We've sent a verification email to secure your account - you can verify it later.
            </p>
            <p className="mt-4 text-center text-xs text-gray-500">
              Redirecting you to login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthForm
      mode="signup"
      onSubmit={handleSignup}
      loading={loading}
      error={error}
    />
  )
}