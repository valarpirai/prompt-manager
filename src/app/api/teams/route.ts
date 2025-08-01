import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { validateTeamName } from '@/lib/validation'

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where: {
          members: {
            some: {
              user_id: req.user!.userId
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          updated_at: 'desc'
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
      }),
      prisma.team.count({
        where: {
          members: {
            some: {
              user_id: req.user!.userId
            }
          }
        }
      })
    ])

    const teamsWithUserRole = teams.map(team => {
      const userMember = team.members.find(member => member.user_id === req.user!.userId)
      return {
        ...team,
        userRole: userMember?.role || 'VIEWER'
      }
    })

    return NextResponse.json({
      teams: teamsWithUserRole,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get teams error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { name, description } = await req.json()

    const nameValidation = validateTeamName(name)
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 })
    }

    if (description && description.length > 500) {
      return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 })
    }

    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          description: description || null
        }
      })

      await tx.teamMember.create({
        data: {
          team_id: newTeam.id,
          user_id: req.user!.userId,
          role: 'ADMIN'
        }
      })

      return tx.team.findUnique({
        where: { id: newTeam.id },
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
    })

    return NextResponse.json({
      message: 'Team created successfully',
      team: {
        ...team,
        userRole: 'ADMIN'
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Create team error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})