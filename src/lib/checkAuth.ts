// lib/checkAuth.ts
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function checkAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    
    if (!token) {
      return { authenticated: false, error: 'No token found', status: 401 };
    }
    
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    
    // Check if the payload has the expected fields
    if (!payload.id || !payload.email || !payload.role) {
      console.error('Invalid token payload:', payload);
      return { authenticated: false, error: 'Invalid token payload', status: 401 };
    }

    // The User ID should now be directly available in the JWT payload
    const userId = payload.userId ? Number(payload.userId) : null;
    
    if (!userId) {
      console.warn('No userId found in JWT payload. Token might be from an older login.');
    }
    
    return { 
      authenticated: true, 
      user: {
        id: Number(payload.id),            // Employee ID
        email: String(payload.email),
        name: String(payload.name),
        role: String(payload.role),
        userId: userId,                     // User ID from JWT (Users table)
        id_number: payload.id_number ? String(payload.id_number) : undefined
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