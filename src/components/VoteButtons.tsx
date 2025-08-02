'use client';

import { useState } from 'react';

interface VoteButtonsProps {
  promptId: number;
  initialUpvoteCount: number;
  initialDownvoteCount: number;
  initialUserVote: 'UPVOTE' | 'DOWNVOTE' | null;
  isOwner: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function VoteButtons({
  promptId,
  initialUpvoteCount,
  initialDownvoteCount,
  initialUserVote,
  isOwner,
  size = 'medium',
}: VoteButtonsProps) {
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [downvoteCount, setDownvoteCount] = useState(initialDownvoteCount);
  const [userVote, setUserVote] = useState<'UPVOTE' | 'DOWNVOTE' | null>(
    initialUserVote
  );
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    small: {
      button: 'p-1',
      icon: 'w-4 h-4',
      text: 'text-xs',
    },
    medium: {
      button: 'p-2',
      icon: 'w-5 h-5',
      text: 'text-sm',
    },
    large: {
      button: 'p-3',
      icon: 'w-6 h-6',
      text: 'text-base',
    },
  };

  const handleVote = async (voteType: 'UPVOTE' | 'DOWNVOTE') => {
    if (isOwner || loading) return;

    setLoading(true);
    try {
      const { apiClient } = await import('@/lib/auth-client');
      const response = await apiClient.post<{
        data: {
          upvote_count: number;
          downvote_count: number;
          userVote: 'UPVOTE' | 'DOWNVOTE' | null;
        };
      }>(`/prompts/${promptId}/vote`, { voteType });

      if (response.ok && response.data) {
        setUpvoteCount(response.data.data.upvote_count);
        setDownvoteCount(response.data.data.downvote_count);
        setUserVote(response.data.data.userVote);
      } else {
        console.error('Vote error:', response.error);
      }
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isOwner) {
    return (
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1 text-gray-500">
          <svg
            className={`${sizeClasses[size].icon} text-gray-400`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className={sizeClasses[size].text}>{upvoteCount}</span>
        </div>
        <div className="flex items-center space-x-1 text-gray-500">
          <svg
            className={`${sizeClasses[size].icon} text-gray-400`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className={sizeClasses[size].text}>{downvoteCount}</span>
        </div>
        <span className={`${sizeClasses[size].text} text-gray-400 italic`}>
          You own this prompt
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Upvote Button */}
      <button
        onClick={() => handleVote('UPVOTE')}
        disabled={loading}
        className={`
          ${sizeClasses[size].button} rounded-md transition-colors duration-200 flex items-center space-x-1
          ${
            userVote === 'UPVOTE'
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={userVote === 'UPVOTE' ? 'Remove upvote' : 'Upvote this prompt'}
      >
        <svg
          className={`${sizeClasses[size].icon} ${userVote === 'UPVOTE' ? 'text-green-600' : 'text-gray-500'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className={sizeClasses[size].text}>{upvoteCount}</span>
      </button>

      {/* Downvote Button */}
      <button
        onClick={() => handleVote('DOWNVOTE')}
        disabled={loading}
        className={`
          ${sizeClasses[size].button} rounded-md transition-colors duration-200 flex items-center space-x-1
          ${
            userVote === 'DOWNVOTE'
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={
          userVote === 'DOWNVOTE' ? 'Remove downvote' : 'Downvote this prompt'
        }
      >
        <svg
          className={`${sizeClasses[size].icon} ${userVote === 'DOWNVOTE' ? 'text-red-600' : 'text-gray-500'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className={sizeClasses[size].text}>{downvoteCount}</span>
      </button>
    </div>
  );
}
