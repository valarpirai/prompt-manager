import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

async function checkPromptPermission(promptId: number, userId: number) {
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
    return { hasPermission: false, prompt: null };
  }

  // Check if user has view permission
  if (prompt.visibility === 'PUBLIC') {
    return { hasPermission: true, prompt };
  }

  if (prompt.owner_id === userId) {
    return { hasPermission: true, prompt };
  }

  if (prompt.team && prompt.team.members.length > 0) {
    return { hasPermission: true, prompt };
  }

  return { hasPermission: false, prompt: null };
}

export const GET = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
    try {
      const promptId = parseInt(params.id);

      if (isNaN(promptId)) {
        return NextResponse.json(
          { error: 'Invalid prompt ID' },
          { status: 400 }
        );
      }

      const { hasPermission } = await checkPromptPermission(
        promptId,
        req.user!.userId
      );

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Prompt not found or access denied' },
          { status: 404 }
        );
      }

      const versions = await prisma.promptVersion.findMany({
        where: { prompt_id: promptId },
        orderBy: { version: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              display_name: true,
              email: true,
            },
          },
          tags: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json({ versions });
    } catch (error) {
      console.error('Get prompt versions error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
