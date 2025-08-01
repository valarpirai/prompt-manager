import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: number;
    email: string;
    isVerified: boolean;
  };
}

export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const authorization = req.headers.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];
    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (!payload.isVerified) {
      return NextResponse.json(
        { error: 'Email not verified' },
        { status: 403 }
      );
    }

    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.user = {
      userId: payload.userId,
      email: payload.email,
      isVerified: payload.isVerified,
    };

    return handler(authenticatedReq);
  };
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (identifier: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;

    const userRequests = requests.get(identifier);

    if (!userRequests || userRequests.resetTime < windowStart) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (userRequests.count >= maxRequests) {
      return false;
    }

    userRequests.count++;
    return true;
  };
}

export const generalRateLimit = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
);

export const llmRateLimit = createRateLimiter(
  3600000, // 1 hour
  parseInt(process.env.RATE_LIMIT_LLM_MAX_REQUESTS || '10')
);

// CORS headers for Chrome extension support
export function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  return response;
}

// Enhanced withAuth that includes CORS support for extension requests
export function withAuthAndCors(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const authorization = req.headers.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
      return addCorsHeaders(errorResponse);
    }

    const token = authorization.split(' ')[1];
    const payload = verifyAccessToken(token);

    if (!payload) {
      const errorResponse = NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
      return addCorsHeaders(errorResponse);
    }

    if (!payload.isVerified) {
      const errorResponse = NextResponse.json(
        { error: 'Email not verified' },
        { status: 403 }
      );
      return addCorsHeaders(errorResponse);
    }

    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.user = {
      userId: payload.userId,
      email: payload.email,
      isVerified: payload.isVerified,
    };

    const response = await handler(authenticatedReq);
    return addCorsHeaders(response);
  };
}
