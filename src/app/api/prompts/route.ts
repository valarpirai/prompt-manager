import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, withAuthAndCors, AuthenticatedRequest } from '@/lib/middleware'
import { validatePromptTitle, validatePromptText, validateTags } from '@/lib/validation'
import { Visibility } from '@prisma/client'

export const GET = withAuthAndCors(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const visibility = searchParams.get('visibility') as Visibility | null
    const teamId = searchParams.get('teamId')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const ownerFilter = searchParams.get('owner')
    const filterType = searchParams.get('filterType')
    
    // Chrome extension support: exact title matching
    const title = searchParams.get('title')
    const exact = searchParams.get('exact') === 'true'

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      deleted_at: null
    }

    // Chrome extension: exact title matching
    if (title && exact) {
      // For exact title matching, we override other filters and only check accessibility
      where.title = { equals: title, mode: 'insensitive' }
      
      // Only show prompts the user has access to
      where.OR = [
        { visibility: 'PUBLIC' },
        { owner_id: req.user!.userId },
        {
          AND: [
            { visibility: 'TEAM' },
            { team_id: { not: null } },
            {
              team: {
                members: {
                  some: {
                    user_id: req.user!.userId
                  }
                }
              }
            }
          ]
        }
      ]
      
      // For exact title matching, return the most recent accessible version
      const exactPrompts = await prisma.prompt.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        take: 1, // Get the most recent one
        include: {
          owner: {
            select: {
              id: true,
              display_name: true,
              email: true
            }
          },
          team: {
            select: {
              id: true,
              name: true
            }
          },
          tags: {
            select: {
              id: true,
              name: true
            }
          },
          votes: {
            where: {
              user_id: req.user!.userId
            },
            select: {
              vote_type: true
            }
          }
        }
      })
      
      return NextResponse.json({
        prompts: exactPrompts,
        pagination: {
          page: 1,
          limit: 1,
          total: exactPrompts.length,
          pages: 1
        }
      })
    }

    // Apply filter type logic
    if (filterType === 'all') {
      // All prompts: public prompts + all my prompts
      where.OR = [
        { visibility: 'PUBLIC' },
        { owner_id: req.user!.userId }
      ]
    } else if (filterType === 'my-prompts') {
      // My prompts: prompts created by me
      where.owner_id = req.user!.userId
    } else if (filterType === 'PUBLIC') {
      // Public prompts: all public prompts
      where.visibility = 'PUBLIC'
    } else if (filterType === 'PRIVATE') {
      // Private prompts: my private prompts
      where.AND = [
        { visibility: 'PRIVATE' },
        { owner_id: req.user!.userId }
      ]
    } else if (filterType === 'TEAM') {
      // Team prompts: prompts from my teams
      where.AND = [
        { visibility: 'TEAM' },
        { team_id: { not: null } },
        {
          team: {
            members: {
              some: {
                user_id: req.user!.userId
              }
            }
          }
        }
      ]
    } else {
      // Default: show accessible prompts (original logic)
      where.OR = [
        { visibility: 'PUBLIC' },
        { owner_id: req.user!.userId },
        {
          AND: [
            { visibility: 'TEAM' },
            { team_id: { not: null } },
            {
              team: {
                members: {
                  some: {
                    user_id: req.user!.userId
                  }
                }
              }
            }
          ]
        }
      ]
    }

    if (search) {
      // If we already have an OR condition from filtering, we need to combine it with search
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { prompt_text: { contains: search, mode: 'insensitive' } }
            ]
          }
        ]
        delete where.OR
      } else {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { prompt_text: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    if (teamId) {
      where.team_id = parseInt(teamId)
    }

    if (tags.length > 0) {
      const tagsCondition = {
        tags: {
          some: {
            name: {
              in: tags
            }
          }
        }
      }
      
      // Combine with existing conditions
      if (where.AND) {
        where.AND.push(tagsCondition)
      } else if (where.OR) {
        where.AND = [{ OR: where.OR }, tagsCondition]
        delete where.OR
      } else {
        Object.assign(where, tagsCondition)
      }
    }

    const orderBy: Record<string, string> = {}
    orderBy[sortBy] = sortOrder

    const [prompts, total] = await Promise.all([
      prisma.prompt.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          owner: {
            select: {
              id: true,
              display_name: true,
              email: true
            }
          },
          team: {
            select: {
              id: true,
              name: true
            }
          },
          tags: {
            select: {
              id: true,
              name: true
            }
          },
          votes: {
            where: {
              user_id: req.user!.userId
            },
            select: {
              vote_type: true
            }
          }
        }
      }),
      prisma.prompt.count({ where })
    ])

    return NextResponse.json({
      prompts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get prompts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { title, promptText, tags = [], visibility = 'PRIVATE', teamId } = await req.json()

    const titleValidation = validatePromptTitle(title)
    if (!titleValidation.valid) {
      return NextResponse.json({ error: titleValidation.error }, { status: 400 })
    }

    const textValidation = validatePromptText(promptText)
    if (!textValidation.valid) {
      return NextResponse.json({ error: textValidation.error }, { status: 400 })
    }

    const tagsValidation = validateTags(tags)
    if (!tagsValidation.valid) {
      return NextResponse.json({ error: tagsValidation.error }, { status: 400 })
    }

    // Validate team assignment and visibility rules
    if (visibility === 'PRIVATE' && teamId) {
      return NextResponse.json({ error: 'Private prompts cannot be assigned to teams' }, { status: 400 })
    }
    
    if (visibility === 'TEAM' && !teamId) {
      return NextResponse.json({ error: 'Team ID is required for TEAM visibility' }, { status: 400 })
    }

    let validatedTeamId = null
    if (teamId) {
      validatedTeamId = typeof teamId === 'string' ? parseInt(teamId) : teamId
      
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          team_id: validatedTeamId,
          user_id: req.user!.userId,
          role: 'ADMIN'
        }
      })

      if (!teamMember) {
        return NextResponse.json({ error: 'You do not have permission to create prompts for this team' }, { status: 403 })
      }
    }

    const tagRecords = await Promise.all(
      tags.map(async (tagName: string) => {
        return prisma.tag.upsert({
          where: { name: tagName.toLowerCase() },
          update: {},
          create: { name: tagName.toLowerCase() }
        })
      })
    )

    const prompt = await prisma.prompt.create({
      data: {
        title,
        prompt_text: promptText,
        visibility: visibility as Visibility,
        owner_id: req.user!.userId,
        created_by: req.user!.userId,
        team_id: validatedTeamId,
        tags: {
          connect: tagRecords.map(tag => ({ id: tag.id }))
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true
          }
        },
        team: {
          select: {
            id: true,
            name: true
          }
        },
        tags: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    await prisma.promptVersion.create({
      data: {
        prompt_id: prompt.id,
        title,
        prompt_text: promptText,
        version: 1,
        created_by: req.user!.userId,
        tags: {
          connect: tagRecords.map(tag => ({ id: tag.id }))
        }
      }
    })

    return NextResponse.json({
      message: 'Prompt created successfully',
      prompt
    }, { status: 201 })

  } catch (error) {
    console.error('Create prompt error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
})