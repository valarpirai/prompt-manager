'use client'

import { useState } from 'react'

interface DashboardEmailNotificationProps {
  userEmail: string
  isVerified: boolean
  onVerificationUpdate?: (isVerified: boolean) => void
}

export default function DashboardEmailNotification({ 
  userEmail, 
  isVerified, 
  onVerificationUpdate 
}: DashboardEmailNotificationProps) {
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState('')
  const [isDismissed, setIsDismissed] = useState(false)

  // Don't show if already verified or dismissed
  if (isVerified || isDismissed) return null

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
    setIsDismissed(true)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Verify your email address
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  We&apos;ve sent a verification email to <strong>{userEmail}</strong>. 
                  Please check your inbox and click the verification link to secure your account.
                </p>
                {message && (
                  <p className={`mt-2 ${message.includes('sent') ? 'text-green-700' : 'text-red-700'}`}>
                    {message}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <div className="flex space-x-3">
                  <button
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending && (
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isResending ? 'Sending...' : 'Resend verification email'}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={handleDismiss}
                className="inline-flex text-blue-400 hover:text-blue-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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