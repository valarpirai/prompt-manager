import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthAndCors, AuthenticatedRequest } from '@/lib/middleware';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuthAndCors(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const promptId = parseInt(id);

      if (!promptId || isNaN(promptId)) {
        return NextResponse.json(
          { error: 'Invalid prompt ID' },
          { status: 400 }
        );
      }

      // First verify the prompt exists and user has access to it
      const prompt = await prisma.prompt.findFirst({
        where: {
          id: promptId,
          deleted_at: null,
          OR: [
            { visibility: 'PUBLIC' },
            { owner_id: authReq.user!.userId },
            {
              AND: [
                { visibility: 'TEAM' },
                { team_id: { not: null } },
                {
                  team: {
                    members: {
                      some: {
                        user_id: authReq.user!.userId,
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      if (!prompt) {
        return NextResponse.json(
          { error: 'Prompt not found or access denied' },
          { status: 404 }
        );
      }

      // Increment usage count
      const updatedPrompt = await prisma.prompt.update({
        where: { id: promptId },
        data: {
          usage_count: {
            increment: 1,
          },
        },
        select: {
          id: true,
          usage_count: true,
        },
      });

      return NextResponse.json({
        message: 'Usage count updated successfully',
        usage_count: updatedPrompt.usage_count,
      });
    } catch (error) {
      console.error('Update usage count error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
