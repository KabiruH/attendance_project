// /app/api/webauthn/credentials/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAuth } from '@/lib/checkAuth';

export async function GET() {
  try {
    // Use the same auth check as profile route
    const authResult = await checkAuth();
   
    if (!authResult.authenticated || !authResult.user) {
      console.log('Unauthorized:', authResult.error || 'No user in auth result');
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
    }

    // Add this specific check for userId
    if (!authResult.user.userId) {
      console.log('No userId found for authenticated user');
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    // Find all credentials for this user
    const credentials = await prisma.webAuthnCredentials.findMany({
      where: { userId: authResult.user.userId }, // Now TypeScript knows this is not null
      select: {
        id: true,
        credentialId: true,
        created_at: true,
      },
    });

    console.log(`Found ${credentials.length} credentials for user ID: ${authResult.user.userId}`);
    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}