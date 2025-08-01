import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateTokens } from '@/lib/auth'
import { validateEmail } from '@/lib/validation'
import { generalRateLimit } from '@/lib/middleware'

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.ip || 'unknown'
    
    if (!generalRateLimit(clientIp)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        display_name: true,
        is_verified: true,
      }
    })

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isPasswordValid = await comparePassword(password, user.password)
    
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      isVerified: user.is_verified,
    })

    // Set CORS headers for extension requests
    const response = NextResponse.json({
      message: 'Extension login successful',
      success: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_verified: user.is_verified,
      },
      accessToken,
      refreshToken,
      // Include token expiry information for the extension
      tokenExpiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    })

    // Add CORS headers for Chrome extension
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return response

  } catch (error) {
    console.error('Extension login error:', error)
    const errorResponse = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    
    // Add CORS headers even for error responses
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return errorResponse
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}