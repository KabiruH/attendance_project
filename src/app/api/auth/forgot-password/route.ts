// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        success: false,
        message: 'Please provide a valid email address'
      }, { status: 400 });
    }
   
    const employee = await db.employees.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, name: true }
    });

    // Always return success to prevent email enumeration attacks
    if (!employee) {
      console.log('Password reset requested for non-existent email:', email);
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent'
      });
    }

    // Check for recent reset requests (rate limiting)
    const recentReset = await db.passwordReset.findFirst({
      where: {
        employee_id: employee.id,
        created_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    });

    if (recentReset) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent'
      });
    }

    // Invalidate any existing unused tokens for this user
    await db.passwordReset.updateMany({
      where: {
        employee_id: employee.id,
        used: false
      },
      data: {
        used: true // Mark old tokens as used
      }
    });

    // Generate new token
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.passwordReset.create({
      data: {
        employee_id: employee.id,
        token,
        expires
      }
    });

    // Send email
    const emailResult = await sendPasswordResetEmail(
      employee.email,
      token,
      employee.name
    );

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Still return success to user for security
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}