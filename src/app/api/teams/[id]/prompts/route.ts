import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

async function checkTeamAdminPermission(teamId: number, userId: number) {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      user_id: userId,
      role: 'ADMIN',
    },
  });

  return !!teamMember;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const teamId = parseInt(id);

      if (isNaN(teamId)) {
        return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
      }

      const hasPermission = await checkTeamAdminPermission(
        teamId,
        authReq.user!.userId
      );
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }

      const { promptId } = await authReq.json();

      if (!promptId) {
        return NextResponse.json(
          { error: 'Prompt ID is required' },
          { status: 400 }
        );
      }

      // Check if prompt exists and user has access to it
      const prompt = await prisma.prompt.findFirst({
        where: {
          id: promptId,
          deleted_at: null,
          OR: [
            { owner_id: authReq.user!.userId },
            { visibility: 'PUBLIC' },
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
      });

      if (!prompt) {
        return NextResponse.json(
          { error: 'Prompt not found or access denied' },
          { status: 404 }
        );
      }

      // Check if prompt is already assigned to a team
      if (prompt.team_id) {
        return NextResponse.json(
          { error: 'Prompt is already assigned to a team' },
          { status: 409 }
        );
      }

      // Assign prompt to team
      const updatedPrompt = await prisma.prompt.update({
        where: { id: promptId },
        data: { team_id: teamId },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              display_name: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
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

      return NextResponse.json({
        message: 'Prompt assigned to team successfully',
        prompt: updatedPrompt,
      });
    } catch (error) {
      console.error('Assign prompt to team error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
