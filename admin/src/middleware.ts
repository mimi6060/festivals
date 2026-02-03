import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = [
  '/api/auth',
  '/login',
  '/_next',
  '/favicon.ico',
  '/public',
  '/api/health',
]

// Check if the path is public
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route))
}

// Check if Auth0 is properly configured
function isAuth0Configured(): boolean {
  return !!(
    process.env.AUTH0_SECRET &&
    process.env.AUTH0_BASE_URL &&
    process.env.AUTH0_ISSUER_BASE_URL &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET
  )
}

// Check if we're in production
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  const auth0Configured = isAuth0Configured()
  const isProd = isProduction()

  // In production, Auth0 must be configured
  if (isProd && !auth0Configured) {
    // Redirect to an error page or return 503
    return new NextResponse(
      JSON.stringify({ error: 'Authentication service not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // In development without Auth0, allow access with mock user header
  if (!auth0Configured) {
    const response = NextResponse.next()
    response.headers.set('X-Auth-Mode', 'dev-mock')
    response.headers.set('X-Mock-User-Id', 'dev-user-1')
    response.headers.set('X-Mock-User-Email', 'dev@festival.local')
    response.headers.set('X-Mock-User-Name', 'Dev User')
    response.headers.set('X-Mock-User-Roles', 'ADMIN')
    return response
  }

  // For Auth0 v4, check session by verifying cookie presence
  // The actual authentication is handled by Auth0 SDK in the route handlers
  const sessionCookie = req.cookies.get('appSession')

  if (!sessionCookie) {
    // Redirect to login if no session
    const loginUrl = new URL('/api/auth/login', req.url)
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
