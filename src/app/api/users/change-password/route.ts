// app/api/users/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db/db';

export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is an admin
    const cookieStore = await cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'userId and newPassword are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check target user exists
 const employee = await db.employees.findUnique({ where: { employee_id: Number(userId) } });

if (!employee) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

const hashedPassword = await bcrypt.hash(newPassword, 10);

await db.employees.update({
  where: { employee_id: Number(userId) },
  data: { password: hashedPassword },
});

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Admin change password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}