import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import {
  validatePromptTitle,
  validatePromptText,
  validateTags,
} from '@/lib/validation';
import { Visibility } from '@prisma/client';

async function checkPromptPermission(
  promptId: number,
  userId: number,
  action: 'view' | 'edit' | 'delete'
) {
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
    return { hasPermission: false, prompt: null, error: 'Prompt not found' };
  }

  // Owner always has full access
  if (prompt.owner_id === userId) {
    return { hasPermission: true, prompt, error: null };
  }

  // Public prompts: anyone can view, only owner can edit/delete
  if (prompt.visibility === 'PUBLIC' && action === 'view') {
    return { hasPermission: true, prompt, error: null };
  }

  // Team prompts: only team members can access based on their role
  if (prompt.visibility === 'TEAM') {
    if (!prompt.team_id || !prompt.team || prompt.team.members.length === 0) {
      return {
        hasPermission: false,
        prompt: null,
        error: 'Team prompt is not properly configured',
      };
    }

    const member = prompt.team.members[0];
    if (action === 'view' || (action === 'edit' && member.role === 'ADMIN')) {
      return { hasPermission: true, prompt, error: null };
    }
  }

  // Private prompts: only owner has access (already checked above)

  return { hasPermission: false, prompt: null, error: 'Permission denied' };
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

      const { hasPermission, prompt, error } = await checkPromptPermission(
        promptId,
        authReq.user!.userId,
        'view'
      );

      if (!hasPermission) {
        return NextResponse.json(
          { error },
          { status: error === 'Prompt not found' ? 404 : 403 }
        );
      }

      const fullPrompt = await prisma.prompt.findUnique({
        where: { id: promptId },
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
          votes: {
            where: {
              user_id: authReq.user!.userId,
            },
            select: {
              vote_type: true,
            },
          },
        },
      });

      return NextResponse.json({ prompt: fullPrompt });
    } catch (error) {
      console.error('Get prompt error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
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

      const { hasPermission, prompt, error } = await checkPromptPermission(
        promptId,
        authReq.user!.userId,
        'edit'
      );

      if (!hasPermission) {
        return NextResponse.json(
          { error },
          { status: error === 'Prompt not found' ? 404 : 403 }
        );
      }

      const {
        title,
        promptText,
        tags = [],
        visibility,
        teamId,
      } = await authReq.json();

      const titleValidation = validatePromptTitle(title);
      if (!titleValidation.valid) {
        return NextResponse.json(
          { error: titleValidation.error },
          { status: 400 }
        );
      }

      const textValidation = validatePromptText(promptText);
      if (!textValidation.valid) {
        return NextResponse.json(
          { error: textValidation.error },
          { status: 400 }
        );
      }

      const tagsValidation = validateTags(tags);
      if (!tagsValidation.valid) {
        return NextResponse.json(
          { error: tagsValidation.error },
          { status: 400 }
        );
      }

      // Validate team assignment and visibility rules
      if (visibility === 'PRIVATE' && teamId) {
        return NextResponse.json(
          { error: 'Private prompts cannot be assigned to teams' },
          { status: 400 }
        );
      }

      if (visibility === 'TEAM' && !teamId) {
        return NextResponse.json(
          { error: 'Team ID is required for TEAM visibility' },
          { status: 400 }
        );
      }

      // Validate team permissions if teamId is provided
      let validatedTeamId = null;
      if (teamId) {
        validatedTeamId =
          typeof teamId === 'string' ? parseInt(teamId) : teamId;

        const teamMember = await prisma.teamMember.findFirst({
          where: {
            team_id: validatedTeamId,
            user_id: authReq.user!.userId,
            role: 'ADMIN',
          },
        });

        if (!teamMember) {
          return NextResponse.json(
            {
              error:
                'You do not have permission to assign prompts to this team',
            },
            { status: 403 }
          );
        }
      }

      const tagRecords = await Promise.all(
        tags.map(async (tagName: string) => {
          return prisma.tag.upsert({
            where: { name: tagName.toLowerCase() },
            update: {},
            create: { name: tagName.toLowerCase() },
          });
        })
      );

      const newVersion = prompt!.version + 1;

      const updatedPrompt = await prisma.$transaction(async (tx) => {
        const updated = await tx.prompt.update({
          where: { id: promptId },
          data: {
            title,
            prompt_text: promptText,
            version: newVersion,
            ...(visibility && { visibility: visibility as Visibility }),
            team_id: validatedTeamId,
            tags: {
              set: tagRecords.map((tag) => ({ id: tag.id })),
            },
          },
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

        await tx.promptVersion.create({
          data: {
            prompt_id: promptId,
            title,
            prompt_text: promptText,
            version: newVersion,
            created_by: authReq.user!.userId,
            tags: {
              connect: tagRecords.map((tag) => ({ id: tag.id })),
            },
          },
        });

        return updated;
      });

      return NextResponse.json({
        message: 'Prompt updated successfully',
        prompt: updatedPrompt,
      });
    } catch (error) {
      console.error('Update prompt error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}

export async function DELETE(
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

      const { hasPermission, error } = await checkPromptPermission(
        promptId,
        authReq.user!.userId,
        'delete'
      );

      if (!hasPermission) {
        return NextResponse.json(
          { error },
          { status: error === 'Prompt not found' ? 404 : 403 }
        );
      }

      await prisma.prompt.update({
        where: { id: promptId },
        data: { deleted_at: new Date() },
      });

      return NextResponse.json({ message: 'Prompt deleted successfully' });
    } catch (error) {
      console.error('Delete prompt error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
