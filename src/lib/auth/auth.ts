// lib/auth.ts
import { jwtVerify } from 'jose';

function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

interface SignUpData {
  name: string;
  email: string;
  password: string;
  role: string;
  id_number: string;
  date_of_birth: string;
  id_card_path: string;
  passport_photo: string;
}

interface LoginData {
  email: string;
  password: string;
}

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  name: string;
}

// Updated signup function with new fields
export async function signUp(data: SignUpData) {
  const response = await fetch('api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// New login function
export async function login(data: LoginData) {
  const response = await fetch('api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Get current user
export async function getUser(): Promise<UserPayload | null> {
    const token = getCookie('token');
  
    if (!token) return null;
  
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET)
      );
  
      if (
        typeof payload.id === 'string' &&
        typeof payload.email === 'string' &&
        typeof payload.role === 'string' &&
        typeof payload.name === 'string'
      ) {
        return {
          id: payload.id,
          email: payload.email,
          role: payload.role,
          name: payload.name,
        } as UserPayload;
      } else {
        console.error('Invalid token payload:', payload);
        return null;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
}

// Logout
export async function logout() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }

  return response.json();
}

// Middleware helper to protect routes
export async function requireAuth() {
  const user = await getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}