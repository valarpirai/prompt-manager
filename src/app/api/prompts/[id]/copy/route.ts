import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

async function checkPromptPermission(promptId: number, userId: number) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      team: {
        include: {
          members: {
            where: { user_id: userId }
          }
        }
      }
    }
  })

  if (!prompt || prompt.deleted_at) {
    return { hasPermission: false, prompt: null, error: 'Prompt not found' }
  }

  if (prompt.visibility === 'PUBLIC') {
    return { hasPermission: true, prompt, error: null }
  }

  if (prompt.owner_id === userId) {
    return { hasPermission: true, prompt, error: null }
  }

  if (prompt.team && prompt.team.members.length > 0) {
    return { hasPermission: true, prompt, error: null }
  }

  return { hasPermission: false, prompt: null, error: 'Permission denied' }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const promptId = parseInt(params.id)

      if (isNaN(promptId)) {
        return NextResponse.json({ error: 'Invalid prompt ID' }, { status: 400 })
      }

      const { hasPermission, error } = await checkPromptPermission(promptId, authReq.user!.userId)

      if (!hasPermission) {
        return NextResponse.json({ error }, { status: error === 'Prompt not found' ? 404 : 403 })
      }

      // Increment usage count when prompt is copied
      await prisma.prompt.update({
        where: { id: promptId },
        data: { usage_count: { increment: 1 } }
      })

      return NextResponse.json({ 
        message: 'Usage count updated',
        success: true 
      })

    } catch (error) {
      console.error('Copy prompt error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}