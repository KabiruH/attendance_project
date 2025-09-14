// lib/auth/superadmin-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth/jwt';

const db = new PrismaClient();

export interface UserPayload {
  id: number;
  email: string;
  role: string;
  name: string;
}

// SuperAdmin roles - these exist outside of organizations
export const SUPERADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin'
} as const;

/**
 * Check if user is a superadmin
 */
export const isSuperAdmin = (user: UserPayload): boolean => {
  return user && Object.values(SUPERADMIN_ROLES).includes(user.role as any);
};

/**
 * Get current user using your existing JWT system
 */
export const getCurrentUser = async (req: NextRequest): Promise<UserPayload> => {
  // Extract token from cookies (using your existing pattern)
  const cookieHeader = req.headers.get('cookie');
  const token = cookieHeader?.split(';')
    .find(cookie => cookie.trim().startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    throw new Error('No token provided');
  }

  // Verify token using your existing verifyJwtToken function
  const decodedToken = await verifyJwtToken(token);
  
  if (!decodedToken) {
    throw new Error('Invalid token');
  }

  const userId = Number(decodedToken.id);

  // Get employee data with user relation to get complete user info
  const employeeData = await db.employees.findUnique({
    where: { id: userId },
    include: { user: true }
  });

  if (!employeeData) {
    throw new Error('Employee not found');
  }

  return {
    id: employeeData.id,
    email: employeeData.email,
    role: employeeData.user.role, // Get role from Users table
    name: employeeData.name
  };
};

/**
 * Middleware to check SuperAdmin access
 */
export const withSuperAdminAuth = async (req: NextRequest) => {
  try {
    const user = await getCurrentUser(req);
    
    if (!user || !isSuperAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'SuperAdmin access required' },
        { status: 403 }
      );
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('SuperAdmin auth error:', error);
    
    let message = 'Authentication failed';
    let status = 401;

    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        message = 'Token expired';
      } else if (error.message.includes('invalid token') || error.message.includes('Invalid token')) {
        message = 'Invalid token';
      } else if (error.message.includes('No token provided')) {
        message = 'No authentication token provided';
      } else if (error.message.includes('Employee not found')) {
        message = 'User account not found';
        status = 404;
      } else {
        message = error.message;
      }
    }

    return NextResponse.json(
      { error: 'Unauthorized', message },
      { status }
    );
  }
};

/**
 * Higher-order function to protect SuperAdmin routes
 */
export const protectSuperAdminRoute = <T extends any[]>(
  handler: (req: NextRequest, user: UserPayload, ...args: T) => Promise<NextResponse>
) => {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await withSuperAdminAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }

    const { user } = authResult;
    return handler(req, user, ...args);
  };
};

// Also create a regular user auth utility for comparison
export const getCurrentUserRegular = async (req: NextRequest): Promise<UserPayload> => {
  // Extract token from cookies (using your existing pattern)
  const cookieHeader = req.headers.get('cookie');
  const token = cookieHeader?.split(';')
    .find(cookie => cookie.trim().startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    throw new Error('No token provided');
  }

  // Verify token using your existing verifyJwtToken function
  const decodedToken = await verifyJwtToken(token);
  
  if (!decodedToken) {
    throw new Error('Invalid token');
  }

  const userId = Number(decodedToken.id);

  // Get employee data with user relation
  const employeeData = await db.employees.findUnique({
    where: { id: userId },
    include: { user: true }
  });

  if (!employeeData) {
    throw new Error('Employee not found');
  }

  return {
    id: employeeData.id,
    email: employeeData.email,
    role: employeeData.user.role,
    name: employeeData.name
  };
};

/**
 * Middleware to check regular user access
 */
export const withUserAuth = async (req: NextRequest) => {
  try {
    const user = await getCurrentUserRegular(req);
    return { user, error: null };
  } catch (error) {
    console.error('User auth error:', error);
    
    let message = 'Authentication failed';
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        message = 'Token expired';
      } else if (error.message.includes('invalid token') || error.message.includes('Invalid token')) {
        message = 'Invalid token';
      } else if (error.message.includes('No token provided')) {
        message = 'No authentication token provided';
      }
    }

    return NextResponse.json(
      { error: 'Unauthorized', message },
      { status: 401 }
    );
  }
};

// Check if current user is SuperAdmin (for frontend)
// app/api/auth/is-superadmin/route.ts
export async function createIsSuperAdminRoute() {
  return async function GET(req: NextRequest) {
    const authResult = await withUserAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    
    return NextResponse.json({
      isSuperAdmin: isSuperAdmin(user),
      role: user.role,
      name: user.name
    });
  };
}