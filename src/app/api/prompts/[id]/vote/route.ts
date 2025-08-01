import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { VoteType } from '@prisma/client';

async function checkPromptAccess(promptId: number, userId: number) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      team: {
        include: {
          members: {
            where: { user_id: userId },
          },
        },
      },
    },
  });

  if (!prompt || prompt.deleted_at) {
    return { hasAccess: false, prompt: null, error: 'Prompt not found' };
  }

  // Owner cannot vote on their own prompt
  if (prompt.owner_id === userId) {
    return {
      hasAccess: false,
      prompt: null,
      error: 'Cannot vote on your own prompt',
    };
  }

  // Check visibility permissions
  if (prompt.visibility === 'PUBLIC') {
    return { hasAccess: true, prompt, error: null };
  }

  if (
    prompt.visibility === 'TEAM' &&
    prompt.team &&
    prompt.team.members.length > 0
  ) {
    return { hasAccess: true, prompt, error: null };
  }

  return { hasAccess: false, prompt: null, error: 'Permission denied' };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const promptId = parseInt(id);

      if (isNaN(promptId)) {
        return NextResponse.json(
          { error: 'Invalid prompt ID' },
          { status: 400 }
        );
      }

      const { voteType } = await authReq.json();

      if (!voteType || !['UPVOTE', 'DOWNVOTE'].includes(voteType)) {
        return NextResponse.json(
          { error: 'Invalid vote type. Must be UPVOTE or DOWNVOTE' },
          { status: 400 }
        );
      }

      const { hasAccess, error } = await checkPromptAccess(
        promptId,
        authReq.user!.userId
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error },
          { status: error === 'Prompt not found' ? 404 : 403 }
        );
      }

      // Use transaction to handle vote creation/update and count updates
      const result = await prisma.$transaction(async (tx) => {
        // Check if user already voted
        const existingVote = await tx.promptVote.findUnique({
          where: {
            user_id_prompt_id: {
              user_id: authReq.user!.userId,
              prompt_id: promptId,
            },
          },
        });

        let upvoteChange = 0;
        let downvoteChange = 0;

        if (existingVote) {
          // User is changing their vote or removing it
          if (existingVote.vote_type === voteType) {
            // Same vote type - remove the vote
            await tx.promptVote.delete({
              where: {
                user_id_prompt_id: {
                  user_id: authReq.user!.userId,
                  prompt_id: promptId,
                },
              },
            });

            if (voteType === 'UPVOTE') {
              upvoteChange = -1;
            } else {
              downvoteChange = -1;
            }
          } else {
            // Different vote type - update the vote
            await tx.promptVote.update({
              where: {
                user_id_prompt_id: {
                  user_id: authReq.user!.userId,
                  prompt_id: promptId,
                },
              },
              data: {
                vote_type: voteType as VoteType,
              },
            });

            if (voteType === 'UPVOTE') {
              upvoteChange = 1;
              downvoteChange = -1;
            } else {
              upvoteChange = -1;
              downvoteChange = 1;
            }
          }
        } else {
          // New vote
          await tx.promptVote.create({
            data: {
              user_id: authReq.user!.userId,
              prompt_id: promptId,
              vote_type: voteType as VoteType,
            },
          });

          if (voteType === 'UPVOTE') {
            upvoteChange = 1;
          } else {
            downvoteChange = 1;
          }
        }

        // Update prompt vote counts
        const updatedPrompt = await tx.prompt.update({
          where: { id: promptId },
          data: {
            upvote_count: {
              increment: upvoteChange,
            },
            downvote_count: {
              increment: downvoteChange,
            },
          },
          select: {
            id: true,
            upvote_count: true,
            downvote_count: true,
          },
        });

        return {
          promptId,
          upvote_count: updatedPrompt.upvote_count,
          downvote_count: updatedPrompt.downvote_count,
          userVote:
            upvoteChange !== 0 || downvoteChange !== 0
              ? upvoteChange > 0 ||
                (upvoteChange === 0 && existingVote?.vote_type !== voteType)
                ? 'UPVOTE'
                : 'DOWNVOTE'
              : null,
        };
      });

      return NextResponse.json({
        message: 'Vote updated successfully',
        data: result,
      });
    } catch (error) {
      console.error('Vote error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const promptId = parseInt(id);

      if (isNaN(promptId)) {
        return NextResponse.json(
          { error: 'Invalid prompt ID' },
          { status: 400 }
        );
      }

      const { hasAccess, error } = await checkPromptAccess(
        promptId,
        authReq.user!.userId
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error },
          { status: error === 'Prompt not found' ? 404 : 403 }
        );
      }

      // Get user's vote if any
      const userVote = await prisma.promptVote.findUnique({
        where: {
          user_id_prompt_id: {
            user_id: authReq.user!.userId,
            prompt_id: promptId,
          },
        },
      });

      // Get prompt vote counts
      const prompt = await prisma.prompt.findUnique({
        where: { id: promptId },
        select: {
          id: true,
          upvote_count: true,
          downvote_count: true,
        },
      });

      return NextResponse.json({
        promptId,
        upvote_count: prompt?.upvote_count || 0,
        downvote_count: prompt?.downvote_count || 0,
        userVote: userVote?.vote_type || null,
      });
    } catch (error) {
      console.error('Get vote error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
