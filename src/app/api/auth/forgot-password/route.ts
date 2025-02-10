// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    const user = await db.employees.findUnique({ 
      where: { email },
      select: { id: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        message: 'If an account exists, a reset link will be sent' 
      });
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.passwordReset.create({
      data: {
        employee_id: user.id,
        token,
        expires
      }
    });

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Click here to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`
    });

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset link will be sent'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}