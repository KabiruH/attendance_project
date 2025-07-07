// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/db';
import { z } from 'zod';
import { SignJWT } from 'jose';

// Schema for password login
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Schema for biometric login
const biometricLoginSchema = z.object({
  userId: z.number(),
  email: z.string().email("Invalid email address"),
  biometricAuth: z.boolean(),
});

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  let body: any = null;
  
  try {
    body = await request.json();
    
    // Check if this is biometric authentication
    if (body.biometricAuth === true) {
      return handleBiometricLogin(body, clientIP, userAgent);
    } else {
      return handlePasswordLogin(body, clientIP, userAgent);
    }
  } catch (error) {
    console.error('Detailed login error:', error);
    
    // Log the error attempt if we have email
    if (body?.email) {
      await logLoginAttempt({
        email: body.email,
        ip_address: clientIP,
        user_agent: userAgent,
        status: 'failed',
        failure_reason: 'server_error',
        login_method: body.biometricAuth ? 'biometric' : 'password'
      });
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}

async function handlePasswordLogin(body: any, clientIP: string, userAgent: string) {
  const validatedData = loginSchema.parse(body);
  
  // Find employee with their user information
  const employee = await db.employees.findUnique({
    where: { email: validatedData.email },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      employee_id: true,
      user: {
        select: {
          id: true,
          is_active: true,
          role: true,
          id_number: true
        }
      }
    },
  });
  
  // Log attempt - user not found
  if (!employee) {
    await logLoginAttempt({
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'failed',
      failure_reason: 'user_not_found',
      login_method: 'password'
    });
    
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }
  
  // Log attempt - account inactive
  if (!employee.user?.is_active) {
    await logLoginAttempt({
      user_id: employee.user?.id,
      employee_id: employee.id,
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'blocked',
      failure_reason: 'account_inactive',
      login_method: 'password'
    });
    
    return NextResponse.json(
      { error: "Your account has been deactivated. Please contact administrator." },
      { status: 403 }
    );
  }
  
  // Verify password
  const passwordMatch = await bcrypt.compare(
    validatedData.password,
    employee.password
  );
  
  // Log attempt - wrong password
  if (!passwordMatch) {
    await logLoginAttempt({
      user_id: employee.user?.id,
      employee_id: employee.id,
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'failed',
      failure_reason: 'invalid_password',
      login_method: 'password'
    });
    
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }
  
  // Log successful login
  await logLoginAttempt({
    user_id: employee.user?.id,
    employee_id: employee.id,
    email: validatedData.email,
    ip_address: clientIP,
    user_agent: userAgent,
    status: 'success',
    login_method: 'password'
  });
  
  return createAuthResponse(employee);
}

async function handleBiometricLogin(body: any, clientIP: string, userAgent: string) {
  const validatedData = biometricLoginSchema.parse(body);
  
  const employee = await db.employees.findUnique({
    where: { email: validatedData.email },
    select: {
      id: true,
      email: true,
      name: true,
      employee_id: true,
      user: {
        select: {
          id: true,
          is_active: true,
          role: true,
          id_number: true
        }
      }
    },
  });
  
  // Log attempt - user not found
  if (!employee) {
    await logLoginAttempt({
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'failed',
      failure_reason: 'user_not_found',
      login_method: 'biometric'
    });
    
    return NextResponse.json(
      { error: "User not found" },
      { status: 401 }
    );
  }
  
  // Verify that the userId matches
  if (employee.user?.id !== validatedData.userId) {
    await logLoginAttempt({
      user_id: employee.user?.id,
      employee_id: employee.id,
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'failed',
      failure_reason: 'biometric_mismatch',
      login_method: 'biometric'
    });
    
    return NextResponse.json(
      { error: "Authentication mismatch" },
      { status: 401 }
    );
  }
  
  // Check if user is active
  if (!employee.user?.is_active) {
    await logLoginAttempt({
      user_id: employee.user?.id,
      employee_id: employee.id,
      email: validatedData.email,
      ip_address: clientIP,
      user_agent: userAgent,
      status: 'blocked',
      failure_reason: 'account_inactive',
      login_method: 'biometric'
    });
    
    return NextResponse.json(
      { error: "Your account has been deactivated. Please contact administrator." },
      { status: 403 }
    );
  }
  
  // Log successful biometric login
  await logLoginAttempt({
    user_id: employee.user?.id,
    employee_id: employee.id,
    email: validatedData.email,
    ip_address: clientIP,
    user_agent: userAgent,
    status: 'success',
    login_method: 'biometric'
  });
  
  return createAuthResponse(employee);
}

async function createAuthResponse(employee: any) {
  // Ensure JWT_SECRET is defined
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }
  
  // Create JWT token with BOTH Employee ID and User ID
  const token = await new SignJWT({
    id: employee.id,
    email: employee.email,
    role: employee.user.role,
    name: employee.name,
    userId: employee.user.id,
    id_number: employee.user.id_number
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  
  // Set HTTP-only cookie
  const response = NextResponse.json({
    user: {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.user.role,
      userId: employee.user.id
    },
    message: "Logged in successfully",
  }, {
    status: 200
  });
  
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
  
  return response;
}

// Helper function to log login attempts
async function logLoginAttempt({
  user_id = null,
  employee_id = null,
  email,
  ip_address,
  user_agent,
  status,
  failure_reason = null,
  login_method
}: {
  user_id?: number | null;
  employee_id?: number | null;
  email: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failed' | 'blocked';
  failure_reason?: string | null;
  login_method: 'password' | 'biometric';
}) {
  try {
    await db.loginLogs.create({
      data: {
        user_id,
        employee_id,
        email,
        ip_address,
        user_agent,
        status,
        failure_reason,
        login_method
      }
    });
  } catch (error) {
    console.error('Failed to log login attempt:', error);
    // Don't throw error - logging failure shouldn't break login flow
  }
}

// Helper function to get client IP
function getClientIP(request: Request): string {
  // Check various headers for IP address
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