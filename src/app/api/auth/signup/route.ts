import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/db';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "employee"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
   
    // Validate request body
    const validatedData = signupSchema.parse(body);
    
    // Check if user already exists
    try {
      const existingUser = await db.employees.findUnique({
        where: { email: validatedData.email }
      });
      
      if (existingUser) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        );
      }
    } catch (dbError) {
    
      return NextResponse.json(
        { 
          error: "Database error during user check",
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    console.log('Database connection test:', !!db?.employees);
    try {
      // Verify all required fields are present
      const userData = {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
      };
      
//Insert User into DB
      const user = await db.employees.create({
        data: userData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
        }
      });

      console.log('User created successfully:', { id: user.id, email: user.email });
      
      return NextResponse.json({
        user,
        message: "Account created successfully"
      }, { status: 201 });

    } catch (createError) {
    console.error('Error creating user:', createError);

      return NextResponse.json(
        { 
          error: "Failed to create user account",
          details: createError instanceof Error ? createError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}