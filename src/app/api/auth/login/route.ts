// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/db';
import { z } from 'zod';
import { SignJWT } from 'jose';

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Login request body:', body);

    const validatedData = loginSchema.parse(body);
    
    // Find employee with user status
    const employee = await db.employees.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        user: {
          select: {
            is_active: true
          }
        }
      },
    });

    console.log('Employee found:', employee ? 'Yes' : 'No');

    if (!employee) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!employee.user?.is_active) {
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

    console.log('Password match:', passwordMatch);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Ensure JWT_SECRET is defined
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({
      id: employee.id,
      email: employee.email,
      role: employee.role,
      name: employee.name
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    console.log('Token generated successfully');

    // Set HTTP-only cookie
    const response = NextResponse.json({
      user: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
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
      path: '/', // Ensure cookie is set for entire site
    });

    return response;
   
  } catch (error) {
    console.error('Detailed login error:', error);
   
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