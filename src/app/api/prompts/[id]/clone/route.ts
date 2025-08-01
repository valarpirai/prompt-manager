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
      },
      tags: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  if (!prompt || prompt.deleted_at) {
    return { hasPermission: false, prompt: null, error: 'Prompt not found' }
  }

  // Can clone if prompt is public or user has access
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await params
      const promptId = parseInt(id)

      if (isNaN(promptId)) {
        return NextResponse.json({ error: 'Invalid prompt ID' }, { status: 400 })
      }

      const { hasPermission, prompt, error } = await checkPromptPermission(promptId, authReq.user!.userId)

      if (!hasPermission) {
        return NextResponse.json({ error }, { status: error === 'Prompt not found' ? 404 : 403 })
      }

      const { title } = await authReq.json()

      // Create a clone of the prompt
      const clonedPrompt = await prisma.prompt.create({
        data: {
          title: title || `${prompt!.title} (Copy)`,
          prompt_text: prompt!.prompt_text,
          visibility: 'PRIVATE', // Always create clones as private initially
          owner_id: authReq.user!.userId,
          created_by: authReq.user!.userId,
          version: 1,
          usage_count: 0,
          tags: {
            connect: prompt!.tags.map(tag => ({ id: tag.id }))
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
          tags: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create initial version record
      await prisma.promptVersion.create({
        data: {
          prompt_id: clonedPrompt.id,
          title: clonedPrompt.title,
          prompt_text: clonedPrompt.prompt_text,
          version: 1,
          created_by: authReq.user!.userId,
          tags: {
            connect: prompt!.tags.map(tag => ({ id: tag.id }))
          }
        }
      })

      return NextResponse.json({
        message: 'Prompt cloned successfully',
        prompt: clonedPrompt
      })

    } catch (error) {
      console.error('Clone prompt error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(req)
}