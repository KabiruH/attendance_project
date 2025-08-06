// app/api/auth/mobile-login/route.ts 
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/db';
import { z } from 'zod';
import { SignJWT } from 'jose';

// Schema for mobile login with password
const mobileLoginSchema = z.object({
  id_number: z.string().min(1, "ID number is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Mobile App';
  let body: any = null;
  
  try {
    body = await request.json();
    const validatedData = mobileLoginSchema.parse(body);
    
    // Find user by ID number and include employee relationship
    const user = await db.users.findUnique({
      where: { id_number: validatedData.id_number },
      select: {
        id: true,
        name: true,
        id_number: true,
        role: true,
        phone_number: true,
        department: true,
        gender: true,
        email: true,
        is_active: true,
        Employee: {
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            date_of_birth: true,
            employee_id: true
          }
        }
      },
    });
    
    // Log attempt - user not found
    if (!user) {
      await logMobileLoginAttempt({
        id_number: validatedData.id_number,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'failed',
        failure_reason: 'user_not_found',
        login_method: 'mobile_password'
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid credentials. Please check your ID number and password." 
        },
        { status: 401 }
      );
    }
    
    // Check if employee record exists (required for password)
    if (!user.Employee) {
      await logMobileLoginAttempt({
        user_id: user.id,
        id_number: validatedData.id_number,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'failed',
        failure_reason: 'no_employee_record',
        login_method: 'mobile_password'
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: "Employee account not fully set up. Please contact administrator." 
        },
        { status: 401 }
      );
    }
    
    // Log attempt - account inactive
    if (!user.is_active) {
      await logMobileLoginAttempt({
        user_id: user.id,
        employee_id: user.Employee.id,
        id_number: validatedData.id_number,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'blocked',
        failure_reason: 'account_inactive',
        login_method: 'mobile_password'
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: "Your account has been deactivated. Please contact administrator." 
        },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(
      validatedData.password,
      user.Employee.password
    );
    
    // Log attempt - wrong password
    if (!passwordMatch) {
      await logMobileLoginAttempt({
        user_id: user.id,
        employee_id: user.Employee.id,
        id_number: validatedData.id_number,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'failed',
        failure_reason: 'invalid_password',
        login_method: 'mobile_password'
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid credentials. Please check your ID number and password." 
        },
        { status: 401 }
      );
    }

    // Check if biometrics are enrolled for this user
    const biometricEnrollment = await db.biometricEnrollments.findFirst({
      where: { 
        user_id: user.id,
        is_active: true 
      }
    });

    // Log successful login
    await logMobileLoginAttempt({
      user_id: user.id,
      employee_id: user.Employee.id,
      id_number: validatedData.id_number,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'success',
      login_method: 'mobile_password'
    });

    // Create JWT token
    const token = await createMobileJWT({
      userId: user.id,
      employeeId: user.Employee.id,
      email: user.Employee.email || user.email || '',
      role: user.role,
      name: user.name,
      id_number: user.id_number
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          id_number: user.id_number,
          role: user.role,
          phone_number: user.phone_number,
          department: user.department,
          gender: user.gender,
          email: user.email,
          is_active: user.is_active
        },
        employee: {
          id: user.Employee.id,
          name: user.Employee.name,
          email: user.Employee.email,
          date_of_birth: user.Employee.date_of_birth,
          employee_id: user.Employee.employee_id
        },
        token: token,
        biometric_enrolled: !!biometricEnrollment
      }
    }, {
      status: 200
    });

  } catch (error) {
    console.error('Mobile login error:', error);
    
    // Log the error attempt if we have id_number
    if (body?.id_number) {
      await logMobileLoginAttempt({
        id_number: body.id_number,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'failed',
        failure_reason: 'server_error',
        login_method: 'mobile_password'
      });
    }
    
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
        error: "An error occurred during login. Please try again." 
      },
      { status: 500 }
    );
  }
}

// Create JWT token for mobile app
async function createMobileJWT(payload: {
  userId: number;
  employeeId: number;
  email: string;
  role: string;
  name: string;
  id_number: string;
}) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  const token = await new SignJWT({
    id: payload.employeeId,
    userId: payload.userId,
    employeeId: payload.employeeId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    id_number: payload.id_number,
    type: 'mobile' // Distinguish mobile tokens
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d') // Longer expiry for mobile
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    
  return token;
}

// Mobile-specific login logging
async function logMobileLoginAttempt({
  user_id = null,
  employee_id = null,
  id_number,
  ip_address,
  user_agent,
  status,
  failure_reason = null,
  login_method
}: {
  user_id?: number | null;
  employee_id?: number | null;
  id_number: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failed' | 'blocked';
  failure_reason?: string | null;
  login_method: string;
}) {
  try {
    await db.loginLogs.create({
      data: {
        user_id,
        employee_id,
        email: `mobile_${id_number}`, // Use ID number prefixed for mobile logins
        ip_address,
        user_agent,
        status,
        failure_reason,
        login_method
      }
    });
  } catch (error) {
    console.error('Failed to log mobile login attempt:', error);
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