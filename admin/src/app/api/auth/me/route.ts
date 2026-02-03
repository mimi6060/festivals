import { getSession } from '@auth0/nextjs-auth0'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user: session.user })
  } catch (error) {
    // Auth0 not configured
    return NextResponse.json(
      { error: 'Auth0 not configured' },
      { status: 500 }
    )
  }
}
