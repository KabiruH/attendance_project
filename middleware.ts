import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const publicPaths = ['/login', '/signup'];
const protectedPaths = ['/dashboard', '/attendance', '/reports', '/profile', '/users'];
const adminOnlyPaths = ['/users'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isAdminPath = adminOnlyPaths.some(path => pathname.startsWith(path));

  const token = request.cookies.get('token');

  // No token — redirect to login if trying to access protected route
  if (!token) {
    if (isProtectedPath || isAdminPath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Unauthenticated users hitting '/' or any other unmatched path → login
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Has token — verify it
  try {
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    // Authenticated users hitting login/signup → send to dashboard
    if (isPublicPath) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Admin-only path check
    if (isAdminPath && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();

  } catch {
    // Invalid/expired token — clear it and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}