import { auth0 } from '@/lib/auth0'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user: session.user })
  } catch {
    // Auth0 not configured or error
    return NextResponse.json(
      { error: 'Auth0 not configured' },
      { status: 500 }
    )
  }
}
