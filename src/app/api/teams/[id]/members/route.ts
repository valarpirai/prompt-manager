import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { validateEmail } from '@/lib/validation';

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

      const { email, role = 'VIEWER' } = await authReq.json();

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 }
        );
      }

      if (!validateEmail(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      if (!['ADMIN', 'VIEWER'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          display_name: true,
          is_verified: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!user.is_verified) {
        return NextResponse.json(
          { error: 'User email is not verified' },
          { status: 400 }
        );
      }

      // Check if user is already a member
      const existingMember = await prisma.teamMember.findFirst({
        where: {
          team_id: teamId,
          user_id: user.id,
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a team member' },
          { status: 409 }
        );
      }

      // Add user to team
      const teamMember = await prisma.teamMember.create({
        data: {
          team_id: teamId,
          user_id: user.id,
          role: role as 'ADMIN' | 'VIEWER',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              display_name: true,
            },
          },
        },
      });

      return NextResponse.json(
        {
          message: 'Team member added successfully',
          member: teamMember,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Add team member error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(req);
}
