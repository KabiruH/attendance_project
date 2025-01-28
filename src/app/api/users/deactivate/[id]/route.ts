// app/api/users/deactivate/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { verifyJwtToken } from '@/lib/auth/jwt';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get and verify admin token
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

    const decodedToken = await verifyJwtToken(token);
    if (!decodedToken || decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 401 }
      );
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // Update both Users and Employees tables
    const updatedUser = await db.users.update({
      where: { id: userId },
      data: { is_active: false },
    });

    return NextResponse.json({
      message: "User deactivated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: "Failed to deactivate user" },
      { status: 500 }
    );
  }
}