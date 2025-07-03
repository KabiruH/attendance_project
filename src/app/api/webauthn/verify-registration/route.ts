// /app/api/webauthn/verify-registration/route.ts - DEBUG VERSION
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import prisma from '@/lib/prisma';
import { checkAuth } from '@/lib/checkAuth';

export async function POST(req: Request) {
  try {
    console.log('=== VERIFY REGISTRATION START ===');
    
    // Use the same auth check as profile route
    const authResult = await checkAuth();
    console.log('Auth result:', {
      authenticated: authResult.authenticated,
      user: authResult.user ? {
        userId: authResult.user.userId,
        id_number: authResult.user.id_number,
        name: authResult.user.name
      } : null
    });

    if (!authResult.authenticated || !authResult.user) {
      console.log('Unauthorized:', authResult.error || 'No user in auth result');
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
    }

    const requestBody = await req.json();
    console.log('Request body keys:', Object.keys(requestBody));
    console.log('Request body:', {
      hasRegistrationResponse: !!requestBody.registrationResponse,
      id_number: requestBody.id_number,
      registrationResponseType: typeof requestBody.registrationResponse
    });

    const { registrationResponse, id_number } = requestBody;

    if (!id_number) {
      console.log('ERROR: No id_number provided in request');
      return NextResponse.json({ error: 'id_number is required' }, { status: 400 });
    }

    console.log('Looking up user with id_number:', id_number);
    const user = await prisma.users.findUnique({
      where: { id_number },
      include: {
        webAuthnCredentials: true
      }
    });

    if (!user) {
      console.log('ERROR: User not found for id_number:', id_number);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('Found user:', {
      id: user.id,
      id_number: user.id_number,
      name: user.name,
      existingCredentials: user.webAuthnCredentials.length
    });

    if (user.id !== authResult.user.userId) {
      console.log('ERROR: User ID mismatch:', {
        userIdFromDB: user.id,
        userIdFromAuth: authResult.user.userId
      });
      return NextResponse.json({ error: 'Unauthorized to register for this user' }, { status: 403 });
    }

    // Get the expected challenge from the database
    const challengeRecord = await prisma.webAuthnCredentialChallenge.findUnique({
      where: { userId: user.id },
    });

    console.log('Challenge record:', {
      found: !!challengeRecord,
      userId: challengeRecord?.userId,
      expires: challengeRecord?.expires,
      isExpired: challengeRecord ? new Date() > challengeRecord.expires : null
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

      console.log('Verification result:', {
        verified: verification.verified,
        hasRegistrationInfo: !!verification.registrationInfo
      });

      if (!verification.verified) {
        console.log('Verification failed');
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
      }

      console.log('Verification successful');
      const { registrationInfo } = verification;

      if (!registrationInfo) {
        console.log('ERROR: Missing registration info');
        return NextResponse.json({ error: 'Missing registration info' }, { status: 400 });
      }
      
      const { credential } = registrationInfo;
      const credentialID = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter;

      // Save the credential to the database
      const credentialIdBase64 = Buffer.from(credentialID).toString('base64url');
      console.log(`Saving credential with details:`, {
        userId: user.id,
        credentialIdBase64: credentialIdBase64.substring(0, 20) + '...',
        counter,
        hasTransports: !!registrationResponse.response.transports
      });

      const newCredential = await prisma.webAuthnCredentials.create({
        data: {
          userId: user.id,
          credentialId: credentialIdBase64,
          publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
          counter,
          transports: registrationResponse.response.transports
            ? JSON.stringify(registrationResponse.response.transports)
            : null,
        },
      });
      
      console.log(`✅ Successfully saved credential:`, {
        id: newCredential.id,
        userId: newCredential.userId,
        credentialId: newCredential.credentialId.substring(0, 20) + '...',
        created_at: newCredential.created_at
      });

      // Verify the credential was actually saved
      const savedCredential = await prisma.webAuthnCredentials.findUnique({
        where: { id: newCredential.id }
      });
      console.log('Verification - credential exists in DB:', !!savedCredential);

      // Check all credentials for this user
      const allUserCredentials = await prisma.webAuthnCredentials.findMany({
        where: { userId: user.id },
        select: { id: true, credentialId: true, created_at: true }
      });
      console.log(`User now has ${allUserCredentials.length} total credentials`);

      // Clean up the challenge
      await prisma.webAuthnCredentialChallenge.delete({
        where: { userId: user.id },
      });
      console.log('✅ Cleaned up challenge');

      return NextResponse.json({
        verified: true,
        message: 'Registration successful',
        debug: {
          userId: user.id,
          credentialId: newCredential.id,
          totalCredentials: allUserCredentials.length
        }
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