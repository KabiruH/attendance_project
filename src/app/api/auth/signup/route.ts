// app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/db';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  id_number: z.string().min(1, "ID number is required"),
  role: z.enum(["admin", "manager", "employee"]),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  date_of_birth: z.string().transform((str) => new Date(str)),
  id_card_path: z.string().min(1, "ID card upload is required"),
  passport_photo: z.string().min(1, "Passport photo upload is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = signupSchema.parse(body);
    
    // First, verify against Users table
    const existingUser = await db.users.findFirst({
      where: {
        AND: [
          { id_number: validatedData.id_number },
          { role: validatedData.role },
          { name: validatedData.name },
          { is_active: true }
        ]
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Unable to verify your details. Please contact admin." },
        { status: 400 }
      );
    }

    // Check if employee account already exists
    const existingEmployee = await db.employees.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { employee_id: existingUser.id }
        ]
      }
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: "Account already exists with these details" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    try {
      // Create employee record
      const employee = await db.employees.create({
        data: {
          employee_id: existingUser.id,  // Link to Users table
          name: validatedData.name,
          id_number: validatedData.id_number,
          role: validatedData.role,
          email: validatedData.email,
          password: hashedPassword,
          date_of_birth: validatedData.date_of_birth,
          id_card_path: validatedData.id_card_path,
          passport_photo: validatedData.passport_photo,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
        }
      });

      console.log('Employee account created successfully:', { id: employee.id, email: employee.email });

      return NextResponse.json({
        user: employee,
        message: "Account created successfully"
      }, { status: 201 });

    } catch (createError) {
      console.error('Error creating employee account:', createError);
      return NextResponse.json(
        {
          error: "Failed to create employee account",
          details: createError instanceof Error ? createError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Signup error:', error);

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