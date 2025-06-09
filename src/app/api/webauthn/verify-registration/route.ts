// /app/api/webauthn/verify-registration/route.ts
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
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

    const { registrationResponse, userId } = await req.json();
    console.log(`Verifying registration for user ID: ${userId}`);

    // Convert string ID to number if needed
    const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;

    // Verify that the user matches the authenticated user
    if (userIdNum !== authResult.user.userId) {
      console.log(`User IDs do not match: ${userIdNum} vs ${authResult.user.userId}`);
      return NextResponse.json({ error: 'Unauthorized to register for this user' }, { status: 403 });
    }

    // Get the expected challenge from the database
    const challengeRecord = await prisma.webAuthnCredentialChallenge.findUnique({
      where: { userId: userIdNum },
    });

    if (!challengeRecord || new Date() > challengeRecord.expires) {
      console.log('Challenge not found or expired');
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }

    console.log('Found valid challenge, proceeding with verification');

    // Determine origin and RP ID based on environment
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    
    // Use appropriate values based on environment
    const expectedOrigin = isLocalhost 
      ? 'http://localhost:3000' 
      : (process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000');
    
    const expectedRPID = isLocalhost 
      ? 'localhost' 
      : (process.env.WEBAUTHN_RP_ID || 'localhost');
    
    console.log(`Verifying registration with origin: ${expectedOrigin}, RP ID: ${expectedRPID}`);

    // Verify the registration response
    try {
      const verification = await verifyRegistrationResponse({
        response: registrationResponse as RegistrationResponseJSON,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin,
        expectedRPID,
        requireUserVerification: true,
      });

      if (!verification.verified) {
        console.log('Verification failed');
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
      }

      console.log('Verification successful');
      const { registrationInfo } = verification;

      if (!registrationInfo) {
        return NextResponse.json({ error: 'Missing registration info' }, { status: 400 });
      }
      const { credential } = registrationInfo;
      const credentialID = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter;

      // Save the credential to the database
      const credentialIdBase64 = Buffer.from(credentialID).toString('base64url');
      console.log(`Saving credential ID: ${credentialIdBase64}`);

      const newCredential = await prisma.webAuthnCredentials.create({
        data: {
          userId: userIdNum,
          credentialId: credentialIdBase64,
          publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
          counter,
          transports: registrationResponse.response.transports
            ? JSON.stringify(registrationResponse.response.transports)
            : null,
        },
      });
      console.log(`Saved credential with ID: ${newCredential.id}`);

      // Clean up the challenge
      await prisma.webAuthnCredentialChallenge.delete({
        where: { userId: userIdNum },
      });
      console.log('Cleaned up challenge');

      return NextResponse.json({
        verified: true,
        message: 'Registration successful',
      });
    } catch (error) {
      console.error('Registration verification error:', error);
      return NextResponse.json({
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error verifying registration:', error);
    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 }
    );
  }
}