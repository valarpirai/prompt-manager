import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { hashPassword } from '@/lib/auth'
import { validatePassword } from '@/lib/validation'

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        is_verified: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            owned_prompts: {
              where: { deleted_at: null }
            },
            team_memberships: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Get user profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { displayName, currentPassword, newPassword } = await req.json()

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        password: true,
        display_name: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: any = {}

    // Update display name if provided
    if (displayName !== undefined) {
      if (displayName && displayName.length > 100) {
        return NextResponse.json({ error: 'Display name must be 100 characters or less' }, { status: 400 })
      }
      updateData.display_name = displayName?.trim() || null
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set new password' }, { status: 400 })
      }

      // Verify current password
      const { comparePassword } = await import('@/lib/auth')
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password!)
      
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }

      // Validate new password
      const passwordValidation = validatePassword(newPassword)
      if (!passwordValidation.valid) {
        return NextResponse.json({ 
          error: 'New password validation failed', 
          details: passwordValidation.errors 
        }, { status: 400 })
      }

      updateData.password = await hashPassword(newPassword)
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        display_name: true,
        is_verified: true,
        updated_at: true
      }
    })

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Update user profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})