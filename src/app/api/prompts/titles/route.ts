import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthAndCors, AuthenticatedRequest } from '@/lib/middleware'

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const userId = req.user!.userId

    // Get prompts that the user can access
    const prompts = await prisma.prompt.findMany({
      where: {
        deleted_at: null,
        AND: [
          // User can access their own prompts, public prompts, or team prompts they're a member of
          {
            OR: [
              { owner_id: userId }, // Own prompts
              { visibility: 'PUBLIC' }, // Public prompts
              {
                AND: [
                  { visibility: 'TEAM' },
                  {
                    team: {
                      members: {
                        some: {
                          user_id: userId
                        }
                      }
                    }
                  }
                ]
              }
            ]
          },
          // Filter by search query if provided
          query ? {
            title: {
              contains: query,
              mode: 'insensitive'
            }
          } : {}
        ]
      },
      select: {
        id: true,
        title: true,
        visibility: true,
        owner: {
          select: {
            display_name: true,
            email: true
          }
        },
        team: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { usage_count: 'desc' },
        { updated_at: 'desc' }
      ],
      take: limit
    })

    const promptTitles = prompts.map(prompt => ({
      id: prompt.id,
      title: prompt.title,
      visibility: prompt.visibility,
      owner: prompt.owner.display_name || prompt.owner.email.split('@')[0],
      team: prompt.team?.name || null
    }))

    return NextResponse.json({
      success: true,
      prompts: promptTitles,
      total: promptTitles.length
    })

  } catch (error) {
    console.error('Error fetching prompt titles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withAuthAndCors(handler)
export const OPTIONS = withAuthAndCors(async () => new NextResponse(null, { status: 200 }))