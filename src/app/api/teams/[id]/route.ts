import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { validateTeamName } from '@/lib/validation'

async function checkTeamPermission(teamId: number, userId: number, requiredRole?: 'ADMIN' | 'EDITOR') {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      user_id: userId
    },
    include: {
      team: true
    }
  })

  if (!teamMember) {
    return { hasPermission: false, team: null, userRole: null }
  }

  if (requiredRole) {
    const hasPermission = teamMember.role === 'ADMIN' || 
                         (requiredRole === 'EDITOR' && teamMember.role === 'EDITOR')
    return { 
      hasPermission, 
      team: teamMember.team, 
      userRole: teamMember.role 
    }
  }

  return { 
    hasPermission: true, 
    team: teamMember.team, 
    userRole: teamMember.role 
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params
      const teamId = parseInt(id)

      if (isNaN(teamId)) {
        return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 })
      }

      const { hasPermission, team, userRole } = await checkTeamPermission(
        teamId, 
        authReq.user!.userId
      )

      if (!hasPermission) {
        return NextResponse.json({ error: 'Team not found or access denied' }, { status: 404 })
      }

      const fullTeam = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  display_name: true
                }
              }
            },
            orderBy: {
              created_at: 'asc'
            }
          },
          prompts: {
            where: {
              deleted_at: null
            },
            select: {
              id: true,
              title: true,
              usage_count: true,
              visibility: true,
              created_at: true,
              updated_at: true,
              tags: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              updated_at: 'desc'
            },
            take: 10
          },
          _count: {
            select: {
              prompts: {
                where: {
                  deleted_at: null
                }
              },
              members: true
            }
          }
        }
      })

      return NextResponse.json({
        team: {
          ...fullTeam,
          userRole
        }
      })

    } catch (error) {
      console.error('Get team error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params
      const teamId = parseInt(id)

      if (isNaN(teamId)) {
        return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 })
      }

      const { hasPermission } = await checkTeamPermission(
        teamId, 
        authReq.user!.userId, 
        'ADMIN'
      )

      if (!hasPermission) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      const { name, description } = await authReq.json()

      if (name) {
        const nameValidation = validateTeamName(name)
        if (!nameValidation.valid) {
          return NextResponse.json({ error: nameValidation.error }, { status: 400 })
        }
      }

      if (description && description.length > 500) {
        return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 })
      }

      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description: description || null })
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  display_name: true
                }
              }
            }
          },
          _count: {
            select: {
              prompts: true,
              members: true
            }
          }
        }
      })

      return NextResponse.json({
        message: 'Team updated successfully',
        team: {
          ...updatedTeam,
          userRole: 'ADMIN'
        }
      })

    } catch (error) {
      console.error('Update team error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params
      const teamId = parseInt(id)

      if (isNaN(teamId)) {
        return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 })
      }

      const { hasPermission } = await checkTeamPermission(
        teamId, 
        authReq.user!.userId, 
        'ADMIN'
      )

      if (!hasPermission) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      await prisma.$transaction(async (tx) => {
        // Update prompts to remove team association
        await tx.prompt.updateMany({
          where: { team_id: teamId },
          data: { team_id: null }
        })

        // Delete team members
        await tx.teamMember.deleteMany({
          where: { team_id: teamId }
        })

        // Delete team
        await tx.team.delete({
          where: { id: teamId }
        })
      })

      return NextResponse.json({ message: 'Team deleted successfully' })

    } catch (error) {
      console.error('Delete team error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}