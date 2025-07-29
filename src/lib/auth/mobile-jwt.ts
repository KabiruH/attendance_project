// lib/auth/mobile-jwt.ts - JWT Helper for Mobile Authentication
import { jwtVerify } from 'jose';

interface MobileJWTPayload {
  id: number;
  userId: number;
  employeeId?: number;
  email: string;
  role: string;
  name: string;
  id_number: string;
  type: string;
  exp: number;
  iat: number;
}

export async function verifyMobileJWT(request: Request): Promise<{
  success: boolean;
  payload?: MobileJWTPayload;
  error?: string;
}> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'No valid authorization header found'
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return {
        success: false,
        error: 'Server configuration error'
      };
    }

    // Verify the JWT token
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    // Type assertion and validation
    const mobilePayload = payload as unknown as MobileJWTPayload;
    
    // Verify this is a mobile token
    if (mobilePayload.type !== 'mobile') {
      return {
        success: false,
        error: 'Invalid token type'
      };
    }

    return {
      success: true,
      payload: mobilePayload
    };

  } catch (error: any) {
    console.error('JWT verification error:', error);
    
    if (error.code === 'ERR_JWT_EXPIRED') {
      return {
        success: false,
        error: 'Token has expired'
      };
    }
    
    return {
      success: false,
      error: 'Invalid token'
    };
  }
}