// app/api/biometric/enroll/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { z } from 'zod';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';

const biometricEnrollSchema = z.object({
  biometric_data: z.string().min(1, "Biometric data is required"),
  device_info: z.object({
    device_id: z.string(),
    device_name: z.string(),
    os_version: z.string(),
    app_version: z.string().optional(),
  }).optional(),
});

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Mobile App';
  
  try {
    // Verify JWT token
    const authResult = await verifyMobileJWT(request);
    if (!authResult.success || !authResult.payload) {
      return NextResponse.json(
        { 
          success: false,
          error: "Authentication required" 
        },
        { status: 401 }
      );
    }

    const { userId } = authResult.payload;
    const body = await request.json();
    const validatedData = biometricEnrollSchema.parse(body);

    // Check if user already has biometric enrollment
    const existingEnrollment = await db.biometricEnrollments.findFirst({
      where: { 
        user_id: userId,
        is_active: true 
      }
    });

    if (existingEnrollment) {
      // Update existing enrollment
      await db.biometricEnrollments.update({
        where: { id: existingEnrollment.id },
        data: {
          enrolled_at: new Date(),
          device_info: validatedData.device_info,
          ip_address: clientIP,
          user_agent: userAgent
        }
      });
    } else {
      // Create new enrollment
      await db.biometricEnrollments.create({
        data: {
          user_id: userId,
          biometric_hash: validatedData.biometric_data, // In production, hash this
          enrolled_at: new Date(),
          device_info: validatedData.device_info,
          ip_address: clientIP,
          user_agent: userAgent,
          is_active: true
        }
      });
    }

    // Log the enrollment
    await db.biometricLogs.create({
      data: {
        user_id: userId,
        action: 'enrollment',
        status: 'success',
        ip_address: clientIP,
        user_agent: userAgent,
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: "Biometric enrollment successful"
    });

  } catch (error) {
    console.error('Biometric enrollment error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: error.issues[0].message 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: "Enrollment failed" 
      },
      { status: 500 }
    );
  }
}

// app/api/biometric/status/route.ts
export async function GET(request: Request) {
  try {
    // Verify JWT token
    const authResult = await verifyMobileJWT(request);
    if (!authResult.success || !authResult.payload) {
      return NextResponse.json(
        { 
          success: false,
          error: "Authentication required" 
        },
        { status: 401 }
      );
    }

    const { userId } = authResult.payload;

    // Check biometric enrollment status
    const enrollment = await db.biometricEnrollments.findFirst({
      where: { 
        user_id: userId,
        is_active: true 
      },
      select: {
        id: true,
        enrolled_at: true,
        device_info: true,
        is_active: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        enrolled: !!enrollment,
        enrollment_date: enrollment?.enrolled_at,
        device_info: enrollment?.device_info
      }
    });

  } catch (error) {
    console.error('Biometric status error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to get biometric status" 
      },
      { status: 500 }
    );
  }
}

// Helper function to get client IP
function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (real) {
    return real;
  }
  if (clientIP) {
    return clientIP;
  }
  
  return 'unknown';
}