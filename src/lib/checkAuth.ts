// lib/auth/checkAuth.ts
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

export async function checkAuth() {
  try {
    const cookieStore =await cookies();
    const token = cookieStore.get('token');
    
    if (!token) {
      return { authenticated: false, error: 'No token found', status: 401 };
    }
    
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    
    const userId = Number(payload.id);
    
    // Get employee data with user relation
    const employeeData = await db.employees.findUnique({
      where: {
        id: userId
      },
      include: {
        user: true  // Include the related user data
      }
    });
    
    if (!employeeData) {
      return { authenticated: false, error: 'Employee not found', status: 404 };
    }
    
    return { 
      authenticated: true, 
      user: {
        id: employeeData.id,
        name: employeeData.name,
        email: employeeData.email,
        role: employeeData.role,
        userId: employeeData.user.id, // This is the Users table ID
        id_number: employeeData.user.id_number
      }
    };
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        return { authenticated: false, error: 'Token expired', status: 401 };
      }
      if (error.message.includes('invalid token')) {
        return { authenticated: false, error: 'Invalid token', status: 401 };
      }
    }
    
    return { authenticated: false, error: 'Authentication failed', status: 500 };
  }
}