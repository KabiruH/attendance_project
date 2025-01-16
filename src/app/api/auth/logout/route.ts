// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Get the cookieStore and await it
  const cookieStore = await cookies();
  
  // Delete the token cookie
  cookieStore.delete('token');
  
  return NextResponse.json({
    message: "Logged out successfully"
  });
}