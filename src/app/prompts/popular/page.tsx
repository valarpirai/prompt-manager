'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

interface PopularPrompt {
  id: number;
  title: string;
  prompt_text: string;
  prompt_text_preview: string;
  usage_count: number;
  created_at: string;
  tags: { id: number; name: string }[];
  owner: { id: number; display_name: string | null; email: string };
}

export default function PopularPromptsPage() {
  const [prompts, setPrompts] = useState<PopularPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'all-time' | '7days' | '30days'>(
    'all-time'
  );
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    fetchPopularPrompts();
  }, [period, limit]);

  const fetchPopularPrompts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        period,
        limit: limit.toString(),
      });

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/prompts/popular?${params}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setPrompts(data.prompts);
      }
    } catch (error) {
      console.error('Error fetching popular prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '7days':
        return 'Last 7 Days';
      case '30days':
        return 'Last 30 Days';
      default:
        return 'All Time';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Popular Prompts
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Discover the most used and highly-rated prompts from the
                community
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
                className="block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all-time">All Time</option>
                <option value="30days">Last 30 Days</option>
                <option value="7days">Last 7 Days</option>
              </select>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value={10}>Top 10</option>
                <option value={25}>Top 25</option>
                <option value={50}>Top 50</option>
              </select>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : prompts.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {prompts.map((prompt, index) => (
                  <li key={prompt.id}>
                    <div className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/prompts/${prompt.id}`}
                              className="text-lg font-medium text-gray-900 hover:text-blue-600 truncate"
                            >
                              {prompt.title}
                            </Link>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <svg
                                  className="w-4 h-4 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                  />
                                </svg>
                                <span className="font-medium">
                                  {prompt.usage_count.toLocaleString()}
                                </span>
                                <span className="ml-1">uses</span>
                              </div>
                            </div>
                          </div>

                          <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                            {prompt.prompt_text_preview}
                          </p>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>
                                By{' '}
                                {prompt.owner.display_name ||
                                  prompt.owner.email.split('@')[0]}
                              </span>
                              <span>•</span>
                              <span>
                                Created {formatDate(prompt.created_at)}
                              </span>
                            </div>

                            {prompt.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {prompt.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {prompt.tags.length > 4 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    +{prompt.tags.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
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
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No popular prompts yet
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Be the first to create a popular prompt by sharing your
                  creations with the community!
                </p>
                <div className="mt-6">
                  <Link
                    href="/prompts/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create Your First Prompt
                  </Link>
                </div>
              </div>
            )}

            {prompts.length > 0 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <p>
                    Showing top {prompts.length} prompts for{' '}
                    <span className="font-medium">
                      {getPeriodLabel(period)}
                    </span>
                  </p>
                  <p>Rankings based on usage count and community engagement</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              How are prompts ranked?
            </h3>
            <div className="prose prose-sm text-gray-600">
              <p>
                Popular prompts are ranked based on their usage count - how many
                times they&apos;ve been viewed or copied by users. The ranking
                helps you discover high-quality, battle-tested prompts that the
                community finds valuable.
              </p>
              <ul className="mt-4 space-y-2">
                <li>
                  • <strong>All Time:</strong> Most used prompts since they were
                  created
                </li>
                <li>
                  • <strong>Last 30 Days:</strong> Trending prompts from the
                  past month
                </li>
                <li>
                  • <strong>Last 7 Days:</strong> Hot prompts from the past week
                </li>
              </ul>
              <p className="mt-4">
                Want to make your prompts popular? Create high-quality, useful
                prompts and set them to public visibility so the community can
                discover and use them.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
