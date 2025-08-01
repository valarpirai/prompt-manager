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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; promptId: string } }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const teamId = parseInt(params.id);
      const promptId = parseInt(params.promptId);

      if (isNaN(teamId) || isNaN(promptId)) {
        return NextResponse.json(
          { error: 'Invalid team or prompt ID' },
          { status: 400 }
        );
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

      // Check if prompt is assigned to this team
      const prompt = await prisma.prompt.findFirst({
        where: {
          id: promptId,
          team_id: teamId,
          deleted_at: null,
        },
      });

      if (!prompt) {
        return NextResponse.json(
          { error: 'Prompt not found in this team' },
          { status: 404 }
        );
      }

      // Remove prompt from team (but don't delete the prompt)
      await prisma.prompt.update({
        where: { id: promptId },
        data: { team_id: null },
      });

      return NextResponse.json({
        message: 'Prompt removed from team successfully',
      });
    } catch (error) {
      console.error('Remove prompt from team error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
