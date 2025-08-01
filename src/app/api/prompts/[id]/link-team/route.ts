import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

async function checkPromptOwnership(promptId: number, userId: number) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      owner_id: true,
      deleted_at: true,
    },
  });

  if (!prompt || prompt.deleted_at) {
    return { hasPermission: false, error: 'Prompt not found' };
  }

  if (prompt.owner_id !== userId) {
    return {
      hasPermission: false,
      error: 'Only prompt owners can link prompts to teams',
    };
  }

  return { hasPermission: true, error: null };
}

async function checkTeamMembership(teamId: number, userId: number) {
  const member = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      user_id: userId,
      role: 'ADMIN',
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!member) {
    return {
      hasPermission: false,
      error: 'Team not found or insufficient permissions',
    };
  }

  return { hasPermission: true, team: member.team, error: null };
}

export async function PUT(
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

      const { teamId } = await authReq.json();

      // Check if user owns the prompt
      const promptCheck = await checkPromptOwnership(
        promptId,
        authReq.user!.userId
      );
      if (!promptCheck.hasPermission) {
        return NextResponse.json(
          { error: promptCheck.error },
          { status: promptCheck.error === 'Prompt not found' ? 404 : 403 }
        );
      }

      if (teamId) {
        // Validate teamId is a number
        const validatedTeamId =
          typeof teamId === 'string' ? parseInt(teamId) : teamId;

        if (isNaN(validatedTeamId)) {
          return NextResponse.json(
            { error: 'Invalid team ID' },
            { status: 400 }
          );
        }

        // Linking to a team - check team membership and permissions
        const teamCheck = await checkTeamMembership(
          validatedTeamId,
          authReq.user!.userId
        );
        if (!teamCheck.hasPermission) {
          return NextResponse.json({ error: teamCheck.error }, { status: 403 });
        }

        // Link prompt to team
        const updatedPrompt = await prisma.prompt.update({
          where: { id: promptId },
          data: { team_id: validatedTeamId },
          include: {
            owner: {
              select: {
                id: true,
                display_name: true,
                email: true,
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
          message: 'Prompt linked to team successfully',
          prompt: updatedPrompt,
        });
      } else {
        // Unlinking from team (setting team_id to null)
        const updatedPrompt = await prisma.prompt.update({
          where: { id: promptId },
          data: { team_id: null },
          include: {
            owner: {
              select: {
                id: true,
                display_name: true,
                email: true,
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
          message: 'Prompt unlinked from team successfully',
          prompt: updatedPrompt,
        });
      }
    } catch (error) {
      console.error('Link prompt to team error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
