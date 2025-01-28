// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Arrays of public and protected paths
const publicPaths = ['/login', '/signup', '/'];
const protectedPaths = ['/dashboard', '/attendance', '/reports', '/profile', '/users'];
const adminOnlyPaths = ['/users'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check path types
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isAdminPath = adminOnlyPaths.some(path => pathname.startsWith(path));

  try {
    // Get token from cookies
    const token = request.cookies.get('token');

    if (!token && (isProtectedPath || isAdminPath)) {
      // Redirect to login if trying to access protected route without token
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (token && isPublicPath) {
      // Redirect to dashboard if trying to access public route with token
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (token && (isProtectedPath || isAdminPath)) {
      try {
        // Verify the token and decode its payload
        const { payload } = await jwtVerify(
          token.value,
          new TextEncoder().encode(process.env.JWT_SECRET)
        );

        // Check role for admin paths
        if (isAdminPath && payload.role !== 'admin') {
          // Redirect non-admin users to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Token is valid and role check passed (if required), allow access
        return NextResponse.next();
      } catch (error) {
        // Token is invalid, redirect to login
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // Allow access to public routes
    return NextResponse.next();
  } catch (error) {
    // Handle any errors by redirecting to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handles separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}