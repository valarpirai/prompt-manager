import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

async function checkPromptEditPermission(promptId: number, userId: number) {
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
    return { hasPermission: false, prompt: null }
  }

  // Owner can always edit
  if (prompt.owner_id === userId) {
    return { hasPermission: true, prompt }
  }

  // Team admins can edit
  if (prompt.team && prompt.team.members.length > 0) {
    const member = prompt.team.members[0]
    if (member.role === 'ADMIN') {
      return { hasPermission: true, prompt }
    }
  }

  return { hasPermission: false, prompt: null }
}

export const POST = withAuth(async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const promptId = parseInt(params.id)

    if (isNaN(promptId)) {
      return NextResponse.json({ error: 'Invalid prompt ID' }, { status: 400 })
    }

    const { hasPermission, prompt } = await checkPromptEditPermission(promptId, req.user!.userId)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const { version } = await req.json()

    if (!version || typeof version !== 'number') {
      return NextResponse.json({ error: 'Version number is required' }, { status: 400 })
    }

    // Get the version to revert to
    const targetVersion = await prisma.promptVersion.findFirst({
      where: {
        prompt_id: promptId,
        version: version
      },
      include: {
        tags: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Create new version with reverted content
    const newVersionNumber = prompt!.version + 1

    const updatedPrompt = await prisma.$transaction(async (tx) => {
      // Update the main prompt record
      const updated = await tx.prompt.update({
        where: { id: promptId },
        data: {
          title: targetVersion.title,
          prompt_text: targetVersion.prompt_text,
          version: newVersionNumber,
          tags: {
            set: targetVersion.tags.map(tag => ({ id: tag.id }))
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

      // Create new version record
      await tx.promptVersion.create({
        data: {
          prompt_id: promptId,
          title: targetVersion.title,
          prompt_text: targetVersion.prompt_text,
          version: newVersionNumber,
          created_by: req.user!.userId,
          tags: {
            connect: targetVersion.tags.map(tag => ({ id: tag.id }))
          }
        }
      })

      return updated
    })

    return NextResponse.json({
      message: `Reverted to version ${version}`,
      prompt: updatedPrompt
    })

  } catch (error) {
    console.error('Revert prompt version error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})