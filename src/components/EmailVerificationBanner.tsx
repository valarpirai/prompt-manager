'use client'

import { useState, useEffect } from 'react'

interface EmailVerificationBannerProps {
  userEmail: string
  isVerified: boolean
}

export default function EmailVerificationBanner({ userEmail, isVerified }: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Only show banner if email is not verified
    setIsVisible(!isVerified)
  }, [isVerified])

  const handleResendVerification = async () => {
    setIsResending(true)
    setMessage('')

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/user/resend-verification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Verification email sent! Please check your inbox.')
      } else {
        setMessage(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      console.error('Error resending verification:', error)
      setMessage('An error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.667-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">
                <strong>Email verification required.</strong> Please verify your email address ({userEmail}) to access all features.
              </p>
              {message && (
                <p className={`text-sm mt-1 ${message.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending && (
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-yellow-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isResending ? 'Sending...' : 'Resend Email'}
              </button>
              <button
                onClick={handleDismiss}
                className="text-yellow-400 hover:text-yellow-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}