'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

interface PromptVersion {
  id: number;
  prompt_id: number;
  title: string;
  prompt_text: string;
  version: number;
  created_at: string;
  creator: {
    id: number;
    display_name: string | null;
    email: string;
  };
  tags: {
    id: number;
    name: string;
  }[];
}

export default function PromptVersionsPage() {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    email: string;
  } | null>(null);
  const router = useRouter();
  const params = useParams();
  const promptId = params.id as string;

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }

    fetchVersions();
  }, [promptId, router]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/prompts/${promptId}/versions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions);
      } else if (response.status === 404) {
        setError('Prompt not found');
      } else if (response.status === 403) {
        setError('You do not have permission to view this prompt');
      } else {
        setError('Failed to load version history');
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
      setError('An error occurred while loading version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (version: number) => {
    if (
      !confirm(
        `Are you sure you want to revert to version ${version}? This will create a new version with the reverted content.`
      )
    ) {
      return;
    }

    setReverting(version);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/prompts/${promptId}/revert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version }),
      });

      if (response.ok) {
        router.push(`/prompts/${promptId}`);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to revert to this version');
      }
    } catch (error) {
      console.error('Error reverting version:', error);
      alert('An error occurred while reverting to this version');
    } finally {
      setReverting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLatestVersion = (version: number) => {
    return (
      versions.length > 0 &&
      version === Math.max(...versions.map((v) => v.version))
    );
  };

  const canEdit = () => {
    if (!versions.length || !currentUser) return false;
    // For simplicity, assume if user can view versions, they can edit
    // In a real app, you'd check ownership/permissions properly
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.667-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
              <p className="mt-1 text-sm text-gray-500">{error}</p>
              <div className="mt-6">
                <Link
                  href={`/prompts/${promptId}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Back to Prompt
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Version History
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  View and manage different versions of this prompt
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href={`/prompts/${promptId}`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to Prompt
                </Link>
              </div>
            </div>
          </div>

          {/* Version List */}
          <div className="space-y-6">
            {versions.map((version) => (
              <div
                key={version.id}
                className="bg-white shadow rounded-lg overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Version {version.version}
                      </h3>
                      {isLatestVersion(version.version) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      {!isLatestVersion(version.version) && canEdit() && (
                        <button
                          onClick={() => handleRevert(version.version)}
                          disabled={reverting === version.version}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {reverting === version.version ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Reverting...
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-4 w-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                />
                              </svg>
                              Revert to This Version
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                    <span>
                      By{' '}
                      {version.creator.display_name ||
                        version.creator.email.split('@')[0]}
                    </span>
                    <span>{formatDate(version.created_at)}</span>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Title
                    </h4>
                    <p className="text-sm text-gray-700">{version.title}</p>
                  </div>

                  {version.tags.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {version.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Content
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <pre className="whitespace-pre-wrap text-sm text-gray-900 overflow-x-auto max-h-64 overflow-y-auto">
                        {version.prompt_text}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {versions.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No versions found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                This prompt doesn&apos;t have any version history yet.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
