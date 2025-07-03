// /app/api/webauthn/generate-registration-options/route.ts
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';
import { checkAuth } from '@/lib/checkAuth';

export async function POST(req: Request) {
  try {
    // Check authentication using the same method as profile
    const authResult = await checkAuth();

    if (!authResult.authenticated || !authResult.user) {
      console.log('Generate registration options - Unauthorized:', authResult.error || 'No user in auth result');
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
    }

    const { userId } = await req.json();
    console.log(`Generating registration options for user ID: ${userId}`);

    // Convert string ID to number if needed
    const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;

    // Verify that the authenticated user matches the requested user
    if (userIdNum !== authResult.user.userId) {
      console.log(`User IDs do not match: ${userIdNum} vs ${authResult.user.userId}`);
      return NextResponse.json({ error: 'Unauthorized to register for this user' }, { status: 403 });
    }

    // Get existing credentials for this user
    const existingCredentials = await prisma.webAuthnCredentials.findMany({
      where: { userId: userIdNum },
    });

    console.log(`Found ${existingCredentials.length} existing credentials`);

    // Determine RP ID and RP Name based on environment
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    
    // Use appropriate values based on environment
    const rpID = isLocalhost ? 'localhost' : (process.env.WEBAUTHN_RP_ID || 'localhost');
    const rpName = 'Employee Attendance System';
    
    console.log(`Using RP ID: ${rpID} (host: ${host})`);

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: authResult.user.id_number ?? '',
      userDisplayName: authResult.user.name,
      attestationType: 'none', // Changed from 'indirect' to 'none'
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.credentialId, // Keep as string, no Buffer conversion
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store the challenge with the user ID
    await prisma.webAuthnCredentialChallenge.upsert({
      where: { userId: userIdNum },
      update: {
        challenge: options.challenge,
        expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
      create: {
        userId: userIdNum,
        challenge: options.challenge,
        expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    console.log('Stored challenge in database');

    return NextResponse.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}