// app/api/webauthn/verify-authentication/route.ts
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { authenticationResponse, username } = await req.json();
    
    console.log(`Verifying authentication for username: ${username}`);
    
    // Find the user
    const user = await prisma.users.findUnique({
      where: { id_number: username },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Get the expected challenge
    const challengeRecord = await prisma.webAuthnCredentialChallenge.findUnique({
      where: { userId: user.id },
    });
    
    if (!challengeRecord || new Date() > challengeRecord.expires) {
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }
    
    // Get the credential being used
    const credentialId = authenticationResponse.id;
    const credential = await prisma.webAuthnCredentials.findUnique({
      where: { credentialId },
    });
    
    if (!credential || credential.userId !== user.id) {
      return NextResponse.json(
        { error: 'Credential not found or does not belong to user' },
        { status: 400 }
      );
    }
    
    console.log('Found credential, verifying response...');
    
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
    
    console.log(`Verifying with origin: ${expectedOrigin}, RP ID: ${expectedRPID}`);
    
    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse as AuthenticationResponseJSON,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false, // Set to false for better compatibility
      credential: {
        id: credential.credentialId,
        publicKey: Uint8Array.from(Buffer.from(credential.publicKey, 'base64url')),
        counter: credential.counter,
      },
    });
    
    if (!verification.verified) {
      console.log('Verification failed');
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }
    
    console.log('Verification successful');
    
    // Update counter
    await prisma.webAuthnCredentials.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });
    
    // Clean up the challenge
    await prisma.webAuthnCredentialChallenge.delete({
      where: { userId: user.id },
    });
    
    // Get employee info for the response
    const employee = await prisma.employees.findUnique({
      where: { employee_id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        employee_id: true,
      },
    });
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      verified: true,
      user: {
        id: employee.id,              // Primary key from Employees table (this is what login uses)
        employee_id: employee.employee_id, // References Users.id
        name: employee.name,          // Name from Employees table
        email: employee.email,        // Email from Employees table
        role: user.role,              // Role from Users table
      },
    });
  } catch (error) {
    console.error('Error verifying authentication:', error);
    return NextResponse.json(
      { 
        error: 'Failed to verify authentication',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}