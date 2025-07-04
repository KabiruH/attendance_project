// lib/auth.ts
import { jwtVerify } from 'jose';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
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

interface BiometricAuthData {
  id_number: string;
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

// Original login function
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

// New biometric authentication function
export async function biometricAuth(data: BiometricAuthData) {
  try {
    // Step 1: Request authentication options from server
    const optionsResponse = await fetch('/api/webauthn/generate-authentication-options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: data.id_number }),
    });
    
    if (!optionsResponse.ok) {
      const errorData = await optionsResponse.json();
      throw new Error(errorData.error || 'Failed to get authentication options');
    }
    
    const options = await optionsResponse.json();
    
    // Step 2: Start the authentication process in the browser using WebAuthn
    // Dynamically import to avoid issues with SSR
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const authenticationResponse = await startAuthentication(options);
    
    // Step 3: Send the response to the server for verification
    const verificationResponse = await fetch('/api/webauthn/verify-authentication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authenticationResponse,
        username: data.id_number,
      }),
    });
    
    if (!verificationResponse.ok) {
      const errorData = await verificationResponse.json();
      throw new Error(errorData.error || 'Authentication failed');
    }
    
    const verificationResult = await verificationResponse.json();
    
    if (verificationResult.verified) {
      // Step 4: Get the JWT token using the verified user info
      const loginResponse = await fetch('/api/auth/biometric-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: verificationResult.user.id,
          name: verificationResult.user.name,
          email: verificationResult.user.email,
          role: verificationResult.user.role,
        }),
      });
      
      if (!loginResponse.ok) {
        const error = await loginResponse.json();
        throw new Error(error.error || 'Failed to create session');
      }
      
      return loginResponse.json();
    } else {
      throw new Error('Authentication verification failed');
    }
  } catch (error: any) {
    console.error('Biometric authentication error:', error);
    throw error;
  }
}

// Check if WebAuthn is supported in this browser
export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.PublicKeyCredential;
}

// Get current user
export async function getUser(): Promise<UserPayload | null> {
  const token = getCookie('token');

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET || '')
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