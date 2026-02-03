import { auth0 } from '@/lib/auth0'

// Auth0 v4 route handler
// The Auth0Client handles all auth routes automatically
export const GET = auth0.handleAuth()
export const POST = auth0.handleAuth()
