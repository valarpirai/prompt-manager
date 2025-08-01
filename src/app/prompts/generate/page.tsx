'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

interface GeneratedPrompt {
  generatedPrompt: string
  suggestedTitle: string
  suggestedTags: string[]
  originalDescription: string
}

export default function GeneratePromptPage() {
  const [description, setDescription] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: description.trim(),
          context: context.trim()
        })
      })

      const data = await response.json()

      if (response.ok) {
        setGeneratedPrompt(data)
        setEditedPrompt(data.generatedPrompt)
        setEditedTitle(data.suggestedTitle)
        setEditedTags(data.suggestedTags)
      } else {
        alert(data.error || 'Failed to generate prompt')
      }
    } catch (error) {
      console.error('Error generating prompt:', error)
      alert('An error occurred while generating the prompt')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().toLowerCase()
      if (!editedTags.includes(newTag) && editedTags.length < 10) {
        setEditedTags([...editedTags, newTag])
        setTagInput('')
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove))
  }

  const handleSave = async () => {
    if (!editedTitle.trim() || !editedPrompt.trim()) {
      alert('Please provide both a title and prompt text')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editedTitle.trim(),
          promptText: editedPrompt.trim(),
          tags: editedTags,
          visibility
        })
      })

      const data = await response.json()

      if (response.ok) {
        router.push(`/prompts/${data.prompt.id}`)
      } else {
        alert(data.error || 'Failed to save prompt')
      }
    } catch (error) {
      console.error('Error saving prompt:', error)
      alert('An error occurred while saving the prompt')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setGeneratedPrompt(null)
    setEditedPrompt('')
    setEditedTitle('')
    setEditedTags([])
    setDescription('')
    setContext('')
    setTagInput('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Generate AI Prompt</h1>
            <p className="mt-1 text-sm text-gray-600">
              Describe what you want your AI prompt to do, and our AI will generate a detailed prompt for you.
            </p>
          </div>

          {!generatedPrompt ? (
            <div className="bg-white shadow rounded-lg p-6">
              <form onSubmit={handleGenerate} className="space-y-6">
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Describe what you want your AI prompt to accomplish (e.g., &quot;Java code review&quot;, &quot;Creative writing assistant&quot;)
                  </p>
                  <textarea
                    id="description"
                    required
                    rows={3}
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter a brief description of what your prompt should do..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500 text-right">
                    {description.length}/500 characters
                  </p>
                </div>

                <div>
                  <label htmlFor="context" className="block text-sm font-medium text-gray-700">
                    Additional Context (Optional)
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Provide any additional context, requirements, or examples that might help generate a better prompt
                  </p>
                  <textarea
                    id="context"
                    rows={4}
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Additional context, requirements, or examples..."
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    maxLength={1000}
                  />
                  <p className="mt-1 text-xs text-gray-500 text-right">
                    {context.length}/1000 characters
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.push('/prompts')}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !description.trim()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {loading ? 'Generating...' : 'Generate Prompt'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Generated Prompt</h2>
                  <button
                    onClick={handleReset}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Generate New
                  </button>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Original Description:</h3>
                  <p className="text-sm text-gray-600">{generatedPrompt.originalDescription}</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="editedTitle" className="block text-sm font-medium text-gray-700">
                      Title *
                    </label>
                    <input
                      type="text"
                      id="editedTitle"
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label htmlFor="editedPrompt" className="block text-sm font-medium text-gray-700">
                      Prompt Content *
                    </label>
                    <textarea
                      id="editedPrompt"
                      required
                      rows={12}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                      Tags
                    </label>
                    <div className="mt-1">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editedTags.map((tag) => (
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
                        id="tagInput"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Type a tag and press Enter..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        disabled={editedTags.length >= 10}
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
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
                    >
                      <option value="PRIVATE">Private - Only visible to you</option>
                      <option value="PUBLIC">Public - Visible to everyone</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editedTitle.trim() || !editedPrompt.trim()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {saving ? 'Saving...' : 'Save Prompt'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}