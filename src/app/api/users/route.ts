// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { z } from 'zod';
import { verifyJwtToken } from '@/lib/auth/jwt';

// Validation schema for creating a user
const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  id_number: z.string().min(1, "ID number is required"),
  role: z.string().min(1, "Role is required"),
  phone_number: z.string().min(1, "Phone number is required"),
  gender: z.string().min(1, "Gender is required"),
  department: z.string().min(1, "Department is required"),
});

// Validation schema for updating a user
const updateUserSchema = z.object({
  id: z.number().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").optional(),
  id_number: z.string().min(1, "ID number is required").optional(),
  role: z.string().min(1, "Role is required").optional(),
  phone_number: z.string().min(1, "Phone number is required").optional(),
  gender: z.string().min(1, "Gender is required").optional(),
  department: z.string().min(1, "Department is required").optional(),
  is_active: z.boolean().optional(),
});

// GET method to fetch all users
export async function GET(request: Request) {
  try {
    // Get the token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = cookieHeader?.split(';')
      .find(cookie => cookie.trim().startsWith('token='))
      ?.split('=')[1];

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    // Verify token and check if admin
    const decodedToken = await verifyJwtToken(token);
    if (!decodedToken || decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 401 }
      );
    }

    const users = await db.users.findMany({
      include: {
        Employee: {
          select: {
            id_card_path: true,
            passport_photo: true,
            email: true,
            date_of_birth: true
          }
        }
      }
    });

    // Transform the data to a cleaner format
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      id_number: user.id_number,
      role: user.role,
      phone_number: user.phone_number,
      gender: user.gender,
      department: user.department,
      is_active: user.is_active,
      created_at: user.created_at,
      // Employee data if it exists
      email: user.Employee?.email || null,
      date_of_birth: user.Employee?.date_of_birth ? 
        user.Employee.date_of_birth.toISOString().split('T')[0] : null,
      id_card_path: user.Employee?.id_card_path || null,
      passport_photo: user.Employee?.passport_photo || null,
    }));

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
// POST method to create a user
export async function POST(request: Request) {
  try {
    // Get the token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = cookieHeader?.split(';')
      .find(cookie => cookie.trim().startsWith('token='))
      ?.split('=')[1];

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    // Verify token and check if admin
    const decodedToken = await verifyJwtToken(token);
    if (!decodedToken || decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Check if user with same ID number already exists
    const existingUser = await db.users.findUnique({
      where: {
        id_number: validatedData.id_number
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this ID number already exists" },
        { status: 409 }
      );
    }

    // Create the user
    const newUser = await db.users.create({
      data: {
        ...validatedData,
        created_by: decodedToken.email,
        is_active: true
      }
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          id_number: newUser.id_number,
          role: newUser.role
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "An error occurred while creating the user" },
      { status: 500 }
    );
  }
}

// PUT method to update a user
export async function PUT(request: Request) {
  try {
    // Get the token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = cookieHeader?.split(';')
      .find(cookie => cookie.trim().startsWith('token='))
      ?.split('=')[1];

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    // Verify token and check if admin
    const decodedToken = await verifyJwtToken(token);
    if (!decodedToken || decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Check if user exists
    const existingUser = await db.users.findUnique({
      where: { id: validatedData.id }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // If updating ID number, check if it's unique
    if (validatedData.id_number && validatedData.id_number !== existingUser.id_number) {
      const duplicateId = await db.users.findUnique({
        where: { id_number: validatedData.id_number }
      });

      if (duplicateId) {
        return NextResponse.json(
          { error: "ID number is already in use" },
          { status: 409 }
        );
      }
    }

    // Update the user
    const updatedUser = await db.users.update({
      where: { id: validatedData.id },
      data: {
        ...validatedData,
        id: undefined, // Remove id from data object as it's used in where clause
      },
      select: {
        id: true,
        name: true,
        id_number: true,
        role: true,
        phone_number: true,
        gender: true,
        department: true,
        is_active: true,
        created_at: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "An error occurred while updating the user" },
      { status: 500 }
    );
  }
}