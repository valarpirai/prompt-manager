import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateEmailVerificationToken } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/email'
import { validateEmail, validatePassword } from '@/lib/validation'
import { generalRateLimit } from '@/lib/middleware'

export async function POST(req: NextRequest) {
  try {
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

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        display_name: displayName,
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
    
    await prisma.emailVerification.create({
      data: {
        user_id: user.id,
        token: verificationToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }
    })

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendVerificationEmail(email, verificationToken)
      } catch (error) {
        console.error('Failed to send verification email:', error)
      }
    }

    return NextResponse.json({
      message: 'User created successfully. Please check your email for verification.',
      user,
    }, { status: 201 })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}