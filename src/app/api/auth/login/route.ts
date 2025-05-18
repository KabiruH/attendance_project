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
    const validatedData = loginSchema.parse(body);
   
    // Find employee with their user information
    const employee = await db.employees.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        employee_id: true,  // This is the foreign key to Users table
        user: {
          select: {
            id: true,          // Added: Get the Users.id
            is_active: true,
            role: true,        // Get role from Users table
            id_number: true    // Added: Get the id_number for reference
          }
        }
      },
    });

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

    // Create JWT token with BOTH Employee ID and User ID
    const token = await new SignJWT({
      id: employee.id,                      // Employees.id for attendance records
      email: employee.email,
      role: employee.user.role,             // Role from Users table
      name: employee.name,
      userId: employee.user.id,             // ADDED: User ID from Users table for WebAuthn
      id_number: employee.user.id_number    // ADDED: ID number for reference
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    // Set HTTP-only cookie
    const response = NextResponse.json({
      user: {
        id: employee.id,               // Employees.id for attendance records
        email: employee.email,
        name: employee.name,
        role: employee.user.role,      // Role from Users table
        userId: employee.user.id       // ADDED: Include userId in response too
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