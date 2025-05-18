// /app/api/webauthn/verify-authentication/route.ts - Corrected for SimpleWebAuthn v13.1.1
import { NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  VerifiedAuthenticationResponse
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { authenticationResponse, username } = await req.json();

    // Find the user
    const user = await prisma.users.findUnique({
      where: { id_number: username },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the expected challenge from the database
    const challengeRecord = await prisma.webAuthnCredentialChallenge.findUnique({
      where: { userId: user.id },
    });

    if (!challengeRecord || new Date() > challengeRecord.expires) {
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }

    // Find the credential that was used
    const credential = await prisma.webAuthnCredentials.findFirst({
      where: {
        credentialId: Buffer.from(authenticationResponse.id, 'base64url').toString('base64url')
      },
    });

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
    }

    // Verify that the credential belongs to the user
    if (credential.userId !== user.id) {
      return NextResponse.json(
        { error: 'Credential does not belong to user' },
        { status: 403 }
      );
    }

    // For v13.1.1, the verification options use 'credential' instead of 'authenticator'
    let verification: VerifiedAuthenticationResponse;

    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse as AuthenticationResponseJSON,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
        expectedRPID: process.env.WEBAUTHN_RP_ID || 'localhost',
        requireUserVerification: true,
        // The key change: use 'credential' instead of 'authenticator'
        credential: {
          id: Buffer.from(credential.credentialId, 'base64url').toString('base64url'),
          publicKey: Buffer.from(credential.publicKey, 'base64url'),
          counter: credential.counter,
        },
      });
    } catch (error) {
      console.error('Authentication verification error:', error);
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    // Update the counter
    await prisma.webAuthnCredentials.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Clean up the challenge
    await prisma.webAuthnCredentialChallenge.delete({
      where: { userId: user.id },
    });

    // Get the employee associated with this user for authentication
    const employee = await prisma.employees.findUnique({
      where: { employee_id: user.id },
      select: {
        id: true,
        name: true,
        role: true,
        email: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Return user information for session
    return NextResponse.json({
      verified: true,
      user: {
        id: user.id,
        name: user.name,
        email: employee.email,
        role: user.role,
        employeeId: employee.id
      }
    });
  } catch (error) {
    console.error('Error verifying authentication:', error);
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}