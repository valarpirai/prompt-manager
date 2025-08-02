'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Link from 'next/link';
import ClonePromptModal from '@/components/ClonePromptModal';
import LinkTeamModal from '@/components/LinkTeamModal';

interface Prompt {
  id: number;
  title: string;
  prompt_text: string;
  usage_count: number;
  upvote_count: number;
  downvote_count: number;
  visibility: 'PUBLIC' | 'PRIVATE' | 'TEAM';
  created_at: string;
  updated_at: string;
  tags: { id: number; name: string }[];
  owner: { id: number; display_name: string | null; email: string };
  team?: { id: number; name: string };
  votes: { vote_type: 'UPVOTE' | 'DOWNVOTE' }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    email: string;
  } | null>(null);
  const [availableTags, setAvailableTags] = useState<
    { id: number; name: string }[]
  >([]);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const tagsDropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    filter: 'all',
    tags: [] as string[],
    sortBy: 'updated_at',
    sortOrder: 'desc',
  });
  const [cloneModal, setCloneModal] = useState<{
    isOpen: boolean;
    prompt: Prompt | null;
  }>({
    isOpen: false,
    prompt: null,
  });
  const [linkTeamModal, setLinkTeamModal] = useState<{
    isOpen: boolean;
    prompt: Prompt | null;
  }>({
    isOpen: false,
    prompt: null,
  });
  const [importModal, setImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchCurrentUser();
    fetchTags();
    fetchPrompts();
  }, [pagination.page, filters, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagsDropdownRef.current &&
        !tagsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTagsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { apiClient } = await import('@/lib/auth-client');
      const response = await apiClient.get<{
        user: { id: number; email: string };
      }>('/users/me');

      if (response.ok && response.data) {
        setCurrentUser(response.data.user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const { apiClient } = await import('@/lib/auth-client');
      const response = await apiClient.get<{
        tags: { id: number; name: string }[];
      }>('/tags');

      if (response.ok && response.data) {
        setAvailableTags(response.data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('@/lib/auth-client');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        filterType: filters.filter,
      });

      // Add tags parameter if selected
      if (filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }

      const response = await apiClient.get<{
        prompts: Prompt[];
        pagination: Pagination;
      }>(`/prompts?${params}`);

      if (response.ok && response.data) {
        setPrompts(response.data.prompts);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleDelete = async (promptId: number) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const { apiClient } = await import('@/lib/auth-client');
      const response = await apiClient.delete(`/prompts/${promptId}`);

      if (response.ok) {
        fetchPrompts();
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  };

  const handleClone = async (title: string) => {
    if (!cloneModal.prompt) return;

    try {
      const { apiClient } = await import('@/lib/auth-client');
      const response = await apiClient.post<{ prompt: { id: number } }>(
        `/prompts/${cloneModal.prompt.id}/clone`,
        { title }
      );

      if (response.ok && response.data) {
        router.push(`/prompts/${response.data.prompt.id}`);
      } else {
        alert(response.error || 'Failed to clone prompt');
      }
    } catch (error) {
      console.error('Error cloning prompt:', error);
      alert('An error occurred while cloning the prompt');
    }
  };

  const handleLinkTeam = async (teamId: number | null) => {
    if (!linkTeamModal.prompt) return;

    try {
      const { apiClient } = await import('@/lib/auth-client');
      const response = await apiClient.put(
        `/prompts/${linkTeamModal.prompt.id}/link-team`,
        { teamId }
      );

      if (response.ok) {
        fetchPrompts(); // Refresh the list to show updated team info
      } else {
        alert(response.error || 'Failed to update team link');
      }
    } catch (error) {
      console.error('Error linking to team:', error);
      alert('An error occurred while updating the team link');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExport = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch('/api/prompts/export', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        const { refreshTokenIfNeeded } = await import('@/lib/auth-client');
        const refreshed = await refreshTokenIfNeeded();
        if (refreshed) {
          const newToken = localStorage.getItem('accessToken');
          const retryResponse = await fetch('/api/prompts/export', {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
          });
          if (retryResponse.ok) {
            const blob = await retryResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download =
              retryResponse.headers
                .get('Content-Disposition')
                ?.split('filename=')[1]
                ?.replace(/"/g, '') || 'prompts-export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            return;
          }
        }
        alert('Authentication failed. Please log in again.');
        return;
      }

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          response.headers
            .get('Content-Disposition')
            ?.split('filename=')[1]
            ?.replace(/"/g, '') || 'prompts-export.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to export prompts');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('An error occurred while exporting prompts');
    }
  };

  const handleImport = async (file: File) => {
    setImportLoading(true);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);

      let response = await fetch('/api/prompts/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        const { refreshTokenIfNeeded } = await import('@/lib/auth-client');
        const refreshed = await refreshTokenIfNeeded();
        if (refreshed) {
          const newToken = localStorage.getItem('accessToken');
          response = await fetch('/api/prompts/import', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
            body: formData,
          });
        } else {
          alert('Authentication failed. Please log in again.');
          return;
        }
      }

      const data = await response.json();

      if (response.ok) {
        alert(
          `Import completed! Imported: ${data.results.imported}, Skipped: ${data.results.skipped}${data.results.errors.length > 0 ? `\n\nErrors:\n${data.results.errors.slice(0, 5).join('\n')}${data.results.errors.length > 5 ? '\n...' : ''}` : ''}`
        );
        fetchPrompts(); // Refresh the list
      } else {
        alert(`Import failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('An error occurred while importing prompts');
    } finally {
      setImportLoading(false);
      setImportModal(false);
    }
  };

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(tagSearchInput.toLowerCase()) &&
      !filters.tags.includes(tag.name)
  );

  const handleTagSelect = (tagName: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: [...prev.tags, tagName],
    }));
    setTagSearchInput('');
    tagInputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Prompts</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage and organize your AI prompts
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2-8H7a2 2 0 00-2 2v11a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z"
                  />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => setImportModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 16l-3-3m0 0l3-3m-3 3h6"
                  />
                </svg>
                Import CSV
              </button>
              <Link
                href="/prompts/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                New Prompt
              </Link>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg mb-6">
            <div className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label
                      htmlFor="search"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Search prompts
                    </label>
                    <input
                      type="text"
                      id="search"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Search by title or content..."
                      value={filters.search}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="filter"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Filter by
                    </label>
                    <select
                      id="filter"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={filters.filter}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          filter: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All Prompts</option>
                      <option value="my-prompts">My Prompts</option>
                      <option value="PUBLIC">Public Prompts</option>
                      <option value="PRIVATE">Private Prompts</option>
                      <option value="TEAM">Team Prompts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tags
                    </label>
                    <div className="mt-1 relative" ref={tagsDropdownRef}>
                      <div
                        className="min-h-[38px] border border-gray-300 rounded-md shadow-sm bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                        onClick={() => {
                          setIsTagsDropdownOpen(true);
                          tagInputRef.current?.focus();
                        }}
                      >
                        <div className="flex flex-wrap gap-1 items-center">
                          {filters.tags.map((tagName) => (
                            <span
                              key={tagName}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tagName}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilters((prev) => ({
                                    ...prev,
                                    tags: prev.tags.filter(
                                      (t) => t !== tagName
                                    ),
                                  }));
                                }}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            ref={tagInputRef}
                            type="text"
                            className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm placeholder-gray-500"
                            placeholder={
                              filters.tags.length === 0
                                ? 'Type to search tags...'
                                : ''
                            }
                            value={tagSearchInput}
                            onChange={(e) => {
                              setTagSearchInput(e.target.value);
                              setIsTagsDropdownOpen(true);
                            }}
                            onFocus={() => setIsTagsDropdownOpen(true)}
                          />
                        </div>
                      </div>
                      {isTagsDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                          {filteredTags.length > 0 ? (
                            filteredTags.map((tag) => (
                              <div
                                key={tag.id}
                                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                                onClick={() => handleTagSelect(tag.name)}
                              >
                                {tag.name}
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              {tagSearchInput
                                ? 'No matching tags found'
                                : 'No more tags available'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="sortBy"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sort by
                    </label>
                    <select
                      id="sortBy"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={`${filters.sortBy}-${filters.sortOrder}`}
                      onChange={(e) => {
                        const [sortBy, sortOrder] = e.target.value.split('-');
                        setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
                      }}
                    >
                      <option value="updated_at-desc">Recently Updated</option>
                      <option value="created_at-desc">Recently Created</option>
                      <option value="title-asc">Title A-Z</option>
                      <option value="upvote_count-desc">Most Popular</option>
                      <option value="usage_count-desc">Most Used</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : prompts.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {prompts.map((prompt) => (
                  <li key={prompt.id}>
                    <div className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <Link
                              href={`/prompts/${prompt.id}`}
                              className="text-lg font-medium text-gray-900 hover:text-blue-600 truncate"
                            >
                              {prompt.title}
                            </Link>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                prompt.visibility === 'PUBLIC'
                                  ? 'bg-green-100 text-green-800'
                                  : prompt.visibility === 'TEAM'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {prompt.visibility}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                            {prompt.prompt_text.substring(0, 200)}...
                          </p>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                            <span>
                              By{' '}
                              {prompt.owner.display_name ||
                                prompt.owner.email.split('@')[0]}
                            </span>
                            <span>•</span>
                            <span>Used {prompt.usage_count} times</span>
                            <span>•</span>
                            <span>Updated {formatDate(prompt.updated_at)}</span>
                            <span>•</span>
                            <span className="flex items-center space-x-2">
                              <span className="flex items-center text-green-600">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                {prompt.upvote_count}
                              </span>
                              <span className="flex items-center text-red-600">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                {prompt.downvote_count}
                              </span>
                            </span>
                            {prompt.tags.length > 0 && (
                              <>
                                <span>•</span>
                                <div className="flex space-x-1">
                                  {prompt.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                  {prompt.tags.length > 3 && (
                                    <span className="text-xs text-gray-400">
                                      +{prompt.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                            {prompt.team && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  Team: {prompt.team.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Clone button - show for public prompts or owned prompts */}
                          {(prompt.visibility === 'PUBLIC' ||
                            currentUser?.id === prompt.owner.id) && (
                            <button
                              onClick={() =>
                                setCloneModal({ isOpen: true, prompt })
                              }
                              className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              title="Clone prompt"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          )}

                          {/* Team link button - only show for owners and not for private prompts */}
                          {currentUser?.id === prompt.owner.id &&
                            prompt.visibility !== 'PRIVATE' && (
                              <button
                                onClick={() =>
                                  setLinkTeamModal({ isOpen: true, prompt })
                                }
                                className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                title="Link to team"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                                  />
                                </svg>
                              </button>
                            )}

                          {/* Edit button - only show for owners */}
                          {currentUser?.id === prompt.owner.id && (
                            <Link
                              href={`/prompts/${prompt.id}/edit`}
                              className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              title="Edit prompt"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </Link>
                          )}

                          {/* Delete button - only show for owners */}
                          {currentUser?.id === prompt.owner.id && (
                            <button
                              onClick={() => handleDelete(prompt.id)}
                              className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              title="Delete prompt"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No prompts found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search
                    ? 'Try adjusting your search criteria.'
                    : 'Get started by creating your first prompt.'}
                </p>
                <div className="mt-6">
                  <Link
                    href="/prompts/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create Prompt
                  </Link>
                </div>
              </div>
            )}

            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(prev.pages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {(pagination.page - 1) * pagination.limit + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.total
                        )}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span>{' '}
                      results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: Math.max(1, prev.page - 1),
                          }))
                        }
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() =>
                              setPagination((prev) => ({ ...prev, page }))
                            }
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === pagination.page
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: Math.min(prev.pages, prev.page + 1),
                          }))
                        }
                        disabled={pagination.page === pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <ClonePromptModal
        isOpen={cloneModal.isOpen}
        onClose={() => setCloneModal({ isOpen: false, prompt: null })}
        onClone={handleClone}
        originalTitle={cloneModal.prompt?.title || ''}
      />

      <LinkTeamModal
        isOpen={linkTeamModal.isOpen}
        onClose={() => setLinkTeamModal({ isOpen: false, prompt: null })}
        onLink={handleLinkTeam}
        currentTeamId={linkTeamModal.prompt?.team?.id}
        promptTitle={linkTeamModal.prompt?.title || ''}
      />

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Import Prompts from CSV
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  CSV file should contain columns: Name, Text, and optionally
                  Visibility and Tags.
                </p>
                <p className="text-xs text-gray-500">
                  Tags should be separated by semicolons (;)
                </p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImport(file);
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={importLoading}
              />
              {importLoading && (
                <div className="mt-3 text-center">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">
                    Importing...
                  </span>
                </div>
              )}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setImportModal(false)}
                  disabled={importLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
