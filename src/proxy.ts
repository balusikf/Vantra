import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // API handlers verify the user themselves and can refresh their own cookies.
  // Do not perform a second Auth round trip here or trust a client-supplied user header.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next({ request })
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const complete = (response: NextResponse) => {
    // Preserve refreshed/cleared session cookies on redirects and API errors too.
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  if (!user && request.nextUrl.pathname.startsWith('/api/')) {
    return complete(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return complete(NextResponse.redirect(url))
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.search = ''
    return complete(NextResponse.redirect(url))
  }

  return complete(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
