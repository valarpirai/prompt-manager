import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from './auth'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: number
    email: string
    isVerified: boolean
  }
}

export function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const authorization = req.headers.get('authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authorization.split(' ')[1]
    const payload = verifyAccessToken(token)

    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    if (!payload.isVerified) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 403 })
    }

    const authenticatedReq = req as AuthenticatedRequest
    authenticatedReq.user = {
      userId: payload.userId,
      email: payload.email,
      isVerified: payload.isVerified,
    }

    return handler(authenticatedReq)
  }
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return (identifier: string): boolean => {
    const now = Date.now()
    const windowStart = now - windowMs

    const userRequests = requests.get(identifier)
    
    if (!userRequests || userRequests.resetTime < windowStart) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs })
      return true
    }

    if (userRequests.count >= maxRequests) {
      return false
    }

    userRequests.count++
    return true
  }
}

export const generalRateLimit = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
)

export const llmRateLimit = createRateLimiter(
  3600000, // 1 hour
  parseInt(process.env.RATE_LIMIT_LLM_MAX_REQUESTS || '10')
)