
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

// Define the type for the JWT payload
interface JwtPayload {
  id: number;
  email: string;
  role: string;
  name: string;
}

export async function GET() {
  try {
    // Await the cookies to access them properly
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify the JWT token and decode the payload
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    // Type assertion: cast payload to `unknown` first, then to `JwtPayload`
    const jwtPayload = payload as unknown as JwtPayload;

    // Get user details from the database based on the decoded token
    const user = await db.employees.findUnique({
      where: { id: jwtPayload.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        // Add other fields you want to return here
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return the user details
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    // Handle different types of errors more specifically
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      if (error.message.includes('invalid token')) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    console.error('Error verifying token:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}