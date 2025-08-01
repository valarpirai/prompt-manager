import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'all-time' // 'all-time', '7days', '30days'
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'combined' // 'usage', 'upvotes', 'combined'

    let dateFilter: { created_at?: { gte: Date } } = {}

    if (period === '7days') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      dateFilter = { created_at: { gte: sevenDaysAgo } }
    } else if (period === '30days') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      dateFilter = { created_at: { gte: thirtyDaysAgo } }
    }

    let orderBy: { usage_count?: 'desc' | 'asc'; upvote_count?: 'desc' | 'asc' } | Array<{ usage_count?: 'desc' | 'asc'; upvote_count?: 'desc' | 'asc' }> = { usage_count: 'desc' }
    
    if (sortBy === 'upvotes') {
      orderBy = { upvote_count: 'desc' }
    } else if (sortBy === 'combined') {
      // For combined score, we'll fetch all and sort in application
      orderBy = [
        { upvote_count: 'desc' },
        { usage_count: 'desc' }
      ]
    }

    const popularPrompts = await prisma.prompt.findMany({
      where: {
        visibility: 'PUBLIC',
        deleted_at: null,
        ...dateFilter
      },
      take: sortBy === 'combined' ? limit * 2 : limit,
      orderBy,
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

    let sortedPrompts = popularPrompts

    if (sortBy === 'combined') {
      // Calculate combined score: upvotes * 2 + usage_count
      sortedPrompts = popularPrompts
        .map(prompt => ({
          ...prompt,
          combined_score: (prompt.upvote_count * 2) + prompt.usage_count
        }))
        .sort((a, b) => b.combined_score - a.combined_score)
        .slice(0, limit)
    }

    const promptsWithPreview = sortedPrompts.map(prompt => ({
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