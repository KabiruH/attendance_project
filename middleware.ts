// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Arrays of public and protected paths
const publicPaths = ['/login', '/signup', '/'];
const protectedPaths = ['/dashboard', '/attendance', '/reports', '/profile', '/users'];
const adminOnlyPaths = ['/users'];
const superAdminPaths = ['/superadmin']; // Add SuperAdmin paths

/**
 * Get organization from request based on domain/subdomain
 */
async function getOrganizationFromRequest(request: NextRequest) {
  const host = request.nextUrl.hostname;
  
  if (!host) {
    return null;
  }

  let organization = null;

  // Check if it's a custom domain (like abcschool.edu)
  if (!host.includes('localhost') && !host.includes('vercel.app') && !host.includes('yourapp.com')) {
    // Custom domain lookup
    organization = await db.organizations.findFirst({
      where: { 
        domain: host,
        is_active: true 
      }
    });
  } else {
    // Subdomain lookup (like abc-school.yourapp.com)
    const subdomain = host.split('.')[0];
    
    // Skip organization detection for main app or localhost
    if (subdomain === 'localhost' || subdomain === 'www' || host === 'yourapp.com') {
      return null;
    }
    
    organization = await db.organizations.findFirst({
      where: { 
        subdomain: subdomain,
        is_active: true 
      }
    });
  }

  return organization;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check path types
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isAdminPath = adminOnlyPaths.some(path => pathname.startsWith(path));
  const isSuperAdminPath = superAdminPaths.some(path => pathname.startsWith(path));

  try {
    // Get organization from domain/subdomain (for tenant isolation)
    let organization = null;
    try {
      organization = await getOrganizationFromRequest(request);
    } catch (error) {
      console.error('Organization detection error:', error);
      // Continue without organization context for SuperAdmin routes
      if (!isSuperAdminPath) {
        return NextResponse.json(
          { error: 'Organization not found' }, 
          { status: 404 }
        );
      }
    }

    // Get token from cookies
    const token = request.cookies.get('token');

    if (!token && (isProtectedPath || isAdminPath || isSuperAdminPath)) {
      // Redirect to login if trying to access protected route without token
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (token && isPublicPath) {
      // Redirect to dashboard if trying to access public route with token
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (token && (isProtectedPath || isAdminPath || isSuperAdminPath)) {
      try {
        // Verify the token and decode its payload
        const { payload } = await jwtVerify(
          token.value,
          new TextEncoder().encode(process.env.JWT_SECRET!)
        );

        // Check role for admin paths
        if (isAdminPath && payload.role !== 'admin') {
          // Redirect non-admin users to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Check role for SuperAdmin paths
        if (isSuperAdminPath && !['super_admin', 'org_manager'].includes(payload.role as string)) {
          // Redirect non-SuperAdmin users to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Create response and add organization context headers
        const response = NextResponse.next();
        
        // Add tenant information to headers for API routes to use
        if (organization) {
          response.headers.set('x-organization-id', organization.id.toString());
          response.headers.set('x-organization-slug', organization.slug);
          response.headers.set('x-organization-name', organization.name);
        }

        // Add user context for SuperAdmin routes
        if (isSuperAdminPath) {
          response.headers.set('x-user-role', payload.role as string);
          response.headers.set('x-user-id', payload.id as string);
        }

        return response;
      } catch (error) {
        // Token is invalid, redirect to login
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // For public routes, still add organization context if available
    if (organization) {
      const response = NextResponse.next();
      response.headers.set('x-organization-id', organization.id.toString());
      response.headers.set('x-organization-slug', organization.slug);
      response.headers.set('x-organization-name', organization.name);
      return response;
    }

    // Allow access to public routes
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    // Handle any errors by redirecting to login for protected routes
    if (isProtectedPath || isAdminPath || isSuperAdminPath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
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