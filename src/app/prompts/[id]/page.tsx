'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navigation from '@/components/Navigation'
import VoteButtons from '@/components/VoteButtons'
import Link from 'next/link'

interface Prompt {
  id: number
  title: string
  prompt_text: string
  usage_count: number
  upvote_count: number
  downvote_count: number
  version: number
  visibility: 'PUBLIC' | 'PRIVATE' | 'TEAM'
  created_at: string
  updated_at: string
  owner: {
    id: number
    display_name: string | null
    email: string
  }
  team?: {
    id: number
    name: string
  }
  tags: {
    id: number
    name: string
  }[]
  votes: {
    vote_type: 'UPVOTE' | 'DOWNVOTE'
  }[]
}

export default function PromptViewPage() {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()
  const params = useParams()
  const promptId = params.id as string

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('accessToken')
    
    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      setCurrentUser(JSON.parse(userData))
    }

    fetchPrompt()
  }, [promptId, router])

  const fetchPrompt = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/prompts/${promptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPrompt(data.prompt)
      } else if (response.status === 404) {
        setError('Prompt not found')
      } else if (response.status === 403) {
        setError('You do not have permission to view this prompt')
      } else {
        setError('Failed to load prompt')
      }
    } catch (error) {
      console.error('Error fetching prompt:', error)
      setError('An error occurred while loading the prompt')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPrompt = async () => {
    if (!prompt) return

    setCopying(true)
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(prompt.prompt_text)
      
      // Update usage count on server
      const token = localStorage.getItem('accessToken')
      await fetch(`/api/prompts/${promptId}/copy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      // Update local state
      setPrompt(prev => prev ? { ...prev, usage_count: prev.usage_count + 1 } : null)
      
      // Show success feedback
      setTimeout(() => setCopying(false), 1000)
    } catch (error) {
      console.error('Failed to copy prompt:', error)
      setCopying(false)
    }
  }

  const handleDelete = async () => {
    if (!prompt || !confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        router.push('/prompts')
      } else {
        alert('Failed to delete prompt')
      }
    } catch (error) {
      console.error('Error deleting prompt:', error)
      alert('An error occurred while deleting the prompt')
    }
  }

  const canEdit = () => {
    if (!prompt || !currentUser) return false
    return prompt.owner.id === currentUser.id
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
              <div className="h-64 bg-gray-200 rounded mb-4"></div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.667-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
              <p className="mt-1 text-sm text-gray-500">{error}</p>
              <div className="mt-6">
                <Link
                  href="/prompts"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Back to Prompts
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!prompt) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900 truncate">
                      {prompt.title}
                    </h1>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      prompt.visibility === 'PUBLIC'
                        ? 'bg-green-100 text-green-800'
                        : prompt.visibility === 'TEAM'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {prompt.visibility}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                    <span>
                      By {prompt.owner.display_name || prompt.owner.email.split('@')[0]}
                    </span>
                    <span>Used {prompt.usage_count} times</span>
                    <span>Version {prompt.version}</span>
                    {prompt.team && (
                      <span>
                        Team: <Link href={`/teams/${prompt.team.id}`} className="text-blue-600 hover:text-blue-500">{prompt.team.name}</Link>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Created {formatDate(prompt.created_at)}
                    {prompt.updated_at !== prompt.created_at && (
                      <span> • Updated {formatDate(prompt.updated_at)}</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <VoteButtons
                      promptId={prompt.id}
                      initialUpvoteCount={prompt.upvote_count}
                      initialDownvoteCount={prompt.downvote_count}
                      initialUserVote={prompt.votes.length > 0 ? prompt.votes[0].vote_type : null}
                      isOwner={currentUser?.id === prompt.owner.id}
                      size="medium"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {copying ? (
                      <svg className="h-4 w-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                    {copying ? 'Copied!' : 'Copy'}
                  </button>
                  {canEdit() && (
                    <>
                      <Link
                        href={`/prompts/${prompt.id}/edit`}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Link>
                      <button
                        onClick={handleDelete}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {prompt.tags.length > 0 && (
            <div className="bg-white shadow rounded-lg mb-6">
              <div className="px-6 py-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prompt Content */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Prompt Content</h3>
                {canEdit() && (
                  <Link
                    href={`/prompts/${prompt.id}/versions`}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    View Version History
                  </Link>
                )}
              </div>
              <div className="relative">
                <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 rounded-lg p-4 border overflow-x-auto">
{prompt.prompt_text}
                </pre>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy to Clipboard
                </button>
                <Link
                  href={`/prompts/new?template=${prompt.id}`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  Use as Template
                </Link>
                <Link
                  href="/prompts"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Prompts
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}