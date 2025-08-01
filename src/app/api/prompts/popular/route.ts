import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'all-time' // 'all-time', '7days', '30days'
    const limit = parseInt(searchParams.get('limit') || '10')

    let dateFilter: any = {}

    if (period === '7days') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      dateFilter = { created_at: { gte: sevenDaysAgo } }
    } else if (period === '30days') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      dateFilter = { created_at: { gte: thirtyDaysAgo } }
    }

    const popularPrompts = await prisma.prompt.findMany({
      where: {
        visibility: 'PUBLIC',
        deleted_at: null,
        ...dateFilter
      },
      take: limit,
      orderBy: {
        usage_count: 'desc'
      },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true
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

    const promptsWithPreview = popularPrompts.map(prompt => ({
      ...prompt,
      prompt_text_preview: prompt.prompt_text.length > 200 
        ? prompt.prompt_text.substring(0, 200) + '...'
        : prompt.prompt_text
    }))

    return NextResponse.json({
      prompts: promptsWithPreview,
      period,
      total: promptsWithPreview.length
    })

  } catch (error) {
    console.error('Get popular prompts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})