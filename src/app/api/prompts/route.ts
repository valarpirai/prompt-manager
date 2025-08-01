import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { validatePromptTitle, validatePromptText, validateTags } from '@/lib/validation'
import { Visibility } from '@prisma/client'

export const GET = withAuth(async (req: AuthenticatedRequest) => {
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

    const skip = (page - 1) * limit

    const where: any = {
      deleted_at: null,
      OR: [
        { visibility: 'PUBLIC' },
        { owner_id: req.user!.userId },
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

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { prompt_text: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (visibility) {
      where.visibility = visibility
    }

    if (teamId) {
      where.team_id = parseInt(teamId)
    }

    if (tags.length > 0) {
      where.tags = {
        some: {
          name: {
            in: tags
          }
        }
      }
    }

    const orderBy: any = {}
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

    if (teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          team_id: teamId,
          user_id: req.user!.userId,
          role: {
            in: ['ADMIN', 'EDITOR']
          }
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
        team_id: teamId ? parseInt(teamId) : null,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})