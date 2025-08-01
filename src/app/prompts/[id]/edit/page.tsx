'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navigation from '@/components/Navigation'

interface Prompt {
  id: number
  title: string
  prompt_text: string
  visibility: 'PUBLIC' | 'PRIVATE' | 'TEAM'
  tags: { id: number; name: string }[]
  team?: { id: number; name: string }
  owner: { id: number }
}

interface Team {
  id: number
  name: string
  userRole: 'ADMIN' | 'VIEWER'
}

export default function EditPromptPage() {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    promptText: '',
    tags: [] as string[],
    visibility: 'PRIVATE' as 'PUBLIC' | 'PRIVATE' | 'TEAM',
    teamId: ''
  })
  const [tagInput, setTagInput] = useState('')
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
    fetchTeams()
  }, [promptId, router])

  const fetchPrompt = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/prompts/${promptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const prompt = data.prompt
        
        // Check if user can edit this prompt
        const userData = localStorage.getItem('user')
        if (userData) {
          const user = JSON.parse(userData)
          if (prompt.owner.id !== user.id) {
            setError('You do not have permission to edit this prompt')
            return
          }
        }

        setPrompt(prompt)
        setFormData({
          title: prompt.title,
          promptText: prompt.prompt_text,
          tags: prompt.tags.map((tag: any) => tag.name),
          visibility: prompt.visibility,
          teamId: prompt.team?.id?.toString() || ''
        })
      } else if (response.status === 404) {
        setError('Prompt not found')
      } else if (response.status === 403) {
        setError('You do not have permission to edit this prompt')
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

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Only show teams where user can edit (admin only)
        const editableTeams = data.teams.filter((team: Team) => 
          team.userRole === 'ADMIN'
        )
        setTeams(editableTeams)
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    if (!formData.promptText.trim()) {
      setError('Prompt text is required')
      return
    }

    if (formData.visibility === 'TEAM' && !formData.teamId) {
      setError('Please select a team for TEAM visibility')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          promptText: formData.promptText.trim(),
          tags: formData.tags,
          visibility: formData.visibility,
          teamId: formData.teamId || undefined
        })
      })

      const data = await response.json()

      if (response.ok) {
        router.push(`/prompts/${promptId}`)
      } else {
        setError(data.error || 'Failed to update prompt')
      }
    } catch (error) {
      console.error('Error updating prompt:', error)
      setError('An error occurred while updating the prompt')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value }
    
    // Enforce visibility-team constraints
    if (field === 'visibility') {
      if (value === 'PRIVATE') {
        // Clear team assignment for private prompts
        newFormData.teamId = ''
      }
    }
    
    setFormData(newFormData)
    if (error) {
      setError('')
    }
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().toLowerCase()
      if (!formData.tags.includes(newTag) && formData.tags.length < 10) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }))
        setTagInput('')
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
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
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Go Back
                </button>
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
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Edit Prompt</h1>
            <p className="mt-1 text-sm text-gray-600">
              Make changes to your prompt. This will create a new version.
            </p>
          </div>

          <div className="bg-white shadow rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  maxLength={100}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formData.title.length}/100 characters
                </p>
              </div>

              <div>
                <label htmlFor="promptText" className="block text-sm font-medium text-gray-700">
                  Prompt Content *
                </label>
                <textarea
                  id="promptText"
                  required
                  rows={12}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                  value={formData.promptText}
                  onChange={(e) => handleChange('promptText', e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <div className="mt-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600 focus:outline-none"
                        >
                          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                            <path fillRule="evenodd" d="M5.354 4L8 6.646 6.646 8 4 5.354 1.354 8 0 6.646 2.646 4 0 1.354 1.354 0 4 2.646 6.646 0 8 1.354 5.354 4z" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Type a tag and press Enter..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    disabled={formData.tags.length >= 10}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Press Enter to add tags. Maximum 10 tags allowed.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
                  Visibility
                </label>
                <select
                  id="visibility"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.visibility}
                  onChange={(e) => handleChange('visibility', e.target.value)}
                >
                  <option value="PRIVATE">Private - Only visible to you</option>
                  <option value="PUBLIC">Public - Visible to everyone, only you can edit</option>
                  <option value="TEAM">Team - Only team members can access</option>
                </select>
              </div>

              {teams.length > 0 && formData.visibility !== 'PRIVATE' && (
                <div>
                  <label htmlFor="teamId" className="block text-sm font-medium text-gray-700">
                    {formData.visibility === 'TEAM' ? 'Select Team *' : 'Assign to Team (Optional)'}
                  </label>
                  <select
                    id="teamId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={formData.teamId}
                    onChange={(e) => handleChange('teamId', e.target.value)}
                  >
                    <option value="">{formData.visibility === 'TEAM' ? 'Select a team...' : 'No team'}</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id.toString()}>
                        {team.name} ({team.userRole})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.visibility === 'TEAM' 
                      ? 'Required for team visibility. Only teams where you can edit are shown.'
                      : 'Optional for public prompts. Only teams where you can edit are shown.'
                    }
                  </p>
                </div>
              )}
              
              {formData.visibility === 'PRIVATE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Team Assignment
                  </label>
                  <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-gray-600">
                      Private prompts cannot be assigned to teams. Only you will have access to this prompt.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Version Control
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Saving changes will create a new version of this prompt. The previous version will be preserved in the version history.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push(`/prompts/${promptId}`)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.title.trim() || !formData.promptText.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}