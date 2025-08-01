import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateEmailVerificationToken } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/email'
import { validateEmail, validatePassword } from '@/lib/validation'
import { generalRateLimit } from '@/lib/middleware'

export async function POST(req: NextRequest) {
  try {
    // Validate required environment variables
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const clientIp = req.ip || 'unknown'
    
    if (!generalRateLimit(clientIp)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { email, password, displayName } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({ 
        error: 'Password validation failed', 
        details: passwordValidation.errors 
      }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)

    // Create user and verification token in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          display_name: displayName?.trim() || null,
          is_verified: false,
        },
        select: {
          id: true,
          email: true,
          display_name: true,
          is_verified: true,
        }
      })

      const verificationToken = generateEmailVerificationToken()
      
      await tx.emailVerification.create({
        data: {
          user_id: user.id,
          token: verificationToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        }
      })

      return { user, verificationToken }
    })

    const { user, verificationToken } = result

    // Send verification email asynchronously (don't wait for it)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      setImmediate(async () => {
        try {
          await sendVerificationEmail(email, verificationToken)
        } catch (error) {
          console.error('Failed to send verification email:', error)
        }
      })
    }

    return NextResponse.json({
      message: 'User created successfully. Please check your email for verification.',
      user,
    }, { status: 201 })

  } catch (error: any) {
    console.error('Signup error:', error)
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }
    
    // Handle other database errors
    if (error.name === 'PrismaClientKnownRequestError') {
      console.error('Prisma error:', error.message, error.code)
      return NextResponse.json({ error: 'Database error occurred' }, { status: 500 })
    }
    
    // Handle validation or other errors
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}