// /app/api/webauthn/generate-registration-options/route.ts - Fixed userID type
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';
import { checkAuth } from '@/lib/checkAuth';

export async function POST(req: Request) {
  try {
    // Use the same auth check as profile route
    const authResult = await checkAuth();

    if (!authResult.authenticated || !authResult.user) {
      console.log('Unauthorized:', authResult.error || 'No user in auth result');
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
    }

    const { userId } = await req.json();
    console.log(`Received registration request for userId: ${userId}`);

    // Convert string ID to number if needed
    const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;

    // Verify that the user exists and matches the authenticated user's ID
    if (userIdNum !== authResult.user.userId) {
      console.log(`User IDs do not match: ${userIdNum} vs ${authResult.user.userId}`);
      return NextResponse.json({ error: 'Unauthorized to register for this user' }, { status: 403 });
    }

    const dbUser = await prisma.users.findUnique({
      where: { id: userIdNum },
    });

    if (!dbUser) {
      console.log(`User not found in database: ${userIdNum}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get existing credentials for exclusion list
    const existingCredentials = await prisma.webAuthnCredentials.findMany({
      where: { userId: userIdNum },
    });
    console.log(`Found ${existingCredentials.length} existing credentials`);

    // Convert to correct format for excludeCredentials
    const excludeCredentials = existingCredentials.map(cred => ({
      id: (cred.credentialId, 'base64url'),
      type: 'public-key' as const,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    }));

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: 'Attendance System',
      rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
      userID: Buffer.from(dbUser.id.toString()),
      userName: dbUser.name,
      userDisplayName: dbUser.name,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
        residentKey: 'required',
      },
    });
    console.log('Generated registration options');

    // Store challenge in database
    try {
      // First check if there's an existing challenge for this user
      const existingChallenge = await prisma.webAuthnCredentialChallenge.findUnique({
        where: { userId: userIdNum },
      });

      if (existingChallenge) {
        // Update existing challenge
        await prisma.webAuthnCredentialChallenge.update({
          where: { userId: userIdNum },
          data: {
            challenge: options.challenge,
            expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });
      } else {
        // Create new challenge
        await prisma.webAuthnCredentialChallenge.create({
          data: {
            userId: userIdNum,
            challenge: options.challenge,
            expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });
      }
      console.log('Stored challenge in database');
    } catch (error) {
      console.error('Error storing challenge:', error);
      return NextResponse.json(
        { error: 'Failed to store challenge' },
        { status: 500 }
      );
    }

    return NextResponse.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}