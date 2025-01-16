// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth/auth'; // Update the import path as per your project structure

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  try {
    // If no token, redirect to login
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname); // Optional: Add redirection context
      return NextResponse.redirect(loginUrl);
    }

    // Verify the user using requireAuth (calls getUser)
    const user = await getUser();
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Attach user info to the request if needed
    request.headers.set('x-user-id', user.id);
    request.headers.set('x-user-email', user.email);

    return NextResponse.next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Redirect to login on error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/employees/:path*'], // Protect the /employees route and its subroutes
};
