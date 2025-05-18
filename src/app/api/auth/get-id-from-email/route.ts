// app/api/auth/get-id-from-email/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/db';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    // Find employee with their user information
    const employee = await db.employees.findUnique({
      where: { email },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            id_number: true,
            is_active: true,
          }
        }
      },
    });

    if (!employee || !employee.user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is active
    if (!employee.user.is_active) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact administrator." },
        { status: 403 }
      );
    }

    // Return the ID number needed for biometric verification
    return NextResponse.json({
      idNumber: employee.user.id_number,
      employeeId: employee.id,
      userId: employee.user.id
    });
   
  } catch (error) {
    console.error('Error retrieving user ID:', error);
    return NextResponse.json(
      { error: "Failed to retrieve user information" },
      { status: 500 }
    );
  }
}