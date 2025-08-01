import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

async function checkTeamAdminPermission(teamId: number, userId: number) {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      user_id: userId,
      role: 'ADMIN'
    }
  })

  return !!teamMember
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const teamId = parseInt(params.id)
      const targetUserId = parseInt(params.userId)

      if (isNaN(teamId) || isNaN(targetUserId)) {
        return NextResponse.json({ error: 'Invalid team or user ID' }, { status: 400 })
      }

      const hasPermission = await checkTeamAdminPermission(teamId, authReq.user!.userId)
      if (!hasPermission) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      const { role } = await authReq.json()

      if (!role || !['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
        return NextResponse.json({ error: 'Valid role is required' }, { status: 400 })
      }

      // Check if member exists
      const existingMember = await prisma.teamMember.findFirst({
        where: {
          team_id: teamId,
          user_id: targetUserId
        }
      })

      if (!existingMember) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
      }

      // Prevent removing the last admin
      if (existingMember.role === 'ADMIN' && role !== 'ADMIN') {
        const adminCount = await prisma.teamMember.count({
          where: {
            team_id: teamId,
            role: 'ADMIN'
          }
        })

        if (adminCount <= 1) {
          return NextResponse.json({ 
            error: 'Cannot change role - team must have at least one admin' 
          }, { status: 400 })
        }
      }

      // Update member role
      const updatedMember = await prisma.teamMember.update({
        where: { id: existingMember.id },
        data: { role: role as 'ADMIN' | 'EDITOR' | 'VIEWER' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              display_name: true
            }
          }
        }
      })

      return NextResponse.json({
        message: 'Member role updated successfully',
        member: updatedMember
      })

    } catch (error) {
      console.error('Update team member error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const teamId = parseInt(params.id)
      const targetUserId = parseInt(params.userId)

      if (isNaN(teamId) || isNaN(targetUserId)) {
        return NextResponse.json({ error: 'Invalid team or user ID' }, { status: 400 })
      }

      // Allow users to remove themselves OR admins to remove others
      const isRemovingSelf = targetUserId === authReq.user!.userId
      const hasAdminPermission = await checkTeamAdminPermission(teamId, authReq.user!.userId)

      if (!isRemovingSelf && !hasAdminPermission) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
      }

      // Check if member exists
      const existingMember = await prisma.teamMember.findFirst({
        where: {
          team_id: teamId,
          user_id: targetUserId
        }
      })

      if (!existingMember) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
      }

      // Prevent removing the last admin
      if (existingMember.role === 'ADMIN') {
        const adminCount = await prisma.teamMember.count({
          where: {
            team_id: teamId,
            role: 'ADMIN'
          }
        })

        if (adminCount <= 1) {
          return NextResponse.json({ 
            error: 'Cannot remove the last admin from the team' 
          }, { status: 400 })
        }
      }

      // Remove member from team
      await prisma.teamMember.delete({
        where: { id: existingMember.id }
      })

      return NextResponse.json({
        message: isRemovingSelf ? 'Left team successfully' : 'Member removed successfully'
      })

    } catch (error) {
      console.error('Remove team member error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}