// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { hash } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    // Validate token and check expiration
    const resetRequest = await db.passwordReset.findUnique({
      where: { 
        token,
        expires: { gt: new Date() },
        used: false 
      },
      include: { employee: true }
    });

    // Invalid or expired token
    if (!resetRequest) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 10);

    // Update user password and mark token as used
    await db.$transaction(async (tx) => {
      // Update user's password
      await tx.employees.update({
        where: { id: resetRequest.employee_id },
        data: { password: hashedPassword }
      });

      // Mark reset token as used
      await tx.passwordReset.update({
        where: { id: resetRequest.id },
        data: { used: true }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Password successfully reset'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}