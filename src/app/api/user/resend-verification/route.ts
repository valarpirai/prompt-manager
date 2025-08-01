import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { generateEmailVerificationToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        is_verified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.is_verified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      );
    }

    // Check for recent verification attempts (rate limiting)
    const recentVerification = await prisma.emailVerification.findFirst({
      where: {
        user_id: user.id,
        created_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        },
      },
    });

    if (recentVerification) {
      return NextResponse.json(
        {
          error:
            'Please wait 5 minutes before requesting another verification email',
        },
        { status: 429 }
      );
    }

    // Delete any existing verification tokens for this user
    await prisma.emailVerification.deleteMany({
      where: { user_id: user.id },
    });

    // Create new verification token
    const verificationToken = generateEmailVerificationToken();

    await prisma.emailVerification.create({
      data: {
        user_id: user.id,
        token: verificationToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email asynchronously
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      setImmediate(async () => {
        try {
          await sendVerificationEmail(user.email, verificationToken);
        } catch (error) {
          console.error('Failed to send verification email:', error);
        }
      });
    }

    return NextResponse.json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
