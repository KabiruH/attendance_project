// app/api/webauthn/verify-authentication/route.ts - Fixed type errors
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { 
  AuthenticationResponseJSON} from '@simplewebauthn/types';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { authenticationResponse, username } = await req.json();
    
    console.log('Verifying authentication for username:', username);
    console.log('Authentication response ID:', authenticationResponse.id.substring(0, 10) + '...');
    
    // Find the user
    const user = await prisma.users.findUnique({
      where: { id_number: username },
    });
    
    if (!user) {
      console.log(`User not found for ID number: ${username}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Get the expected challenge from the database
    const challengeRecord = await prisma.webAuthnCredentialChallenge.findUnique({
      where: { userId: user.id },
    });
    
    if (!challengeRecord || new Date() > challengeRecord.expires) {
      console.log('Challenge not found or expired');
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }
    
    // Find the credential that was used - using the same format as stored
    const credential = await prisma.webAuthnCredentials.findFirst({
      where: { 
        credentialId: authenticationResponse.id
      },
    });
    
    if (!credential) {
      console.log('Credential not found with direct ID match');
      
      // Try a different encoding as fallback
      try {
        const encodedId = Buffer.from(authenticationResponse.id, 'base64url').toString('base64url');
        console.log('Trying alternative encoding:', encodedId.substring(0, 10) + '...');
        
        const altCredential = await prisma.webAuthnCredentials.findFirst({
          where: { 
            credentialId: encodedId
          },
        });
        
        if (!altCredential) {
          console.log('No credential found with alternative encoding');
          return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
        }
        
        console.log('Found credential with alternative encoding');
        return verifyWithCredential(altCredential, user, challengeRecord.challenge, authenticationResponse);
      } catch (error) {
        console.error('Error with alternative encoding attempt:', error);
        return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
      }
    }
    
    return verifyWithCredential(credential, user, challengeRecord.challenge, authenticationResponse);
    
  } catch (error) {
    console.error('Error verifying authentication:', error);
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}

// Helper function to verify with a found credential
async function verifyWithCredential(
  credential: any,
  user: any,
  challenge: string,
  authenticationResponse: any
) {
  // Verify that the credential belongs to the user
  if (credential.userId !== user.id) {
    console.log(`Credential belongs to user ${credential.userId}, not ${user.id}`);
    return NextResponse.json(
      { error: 'Credential does not belong to user' },
      { status: 403 }
    );
  }
  
  console.log('Found valid credential and challenge, proceeding with verification');
  
  try {
    // For SimpleWebAuthn v13.1.1, the expected structure
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID || 'localhost',
      requireUserVerification: true,
      // In SimpleWebAuthn v13+, credential now expects:
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
      },
    });
    
    if (!verification.verified) {
      console.log('Verification failed');
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }
    
    console.log('Verification successful');
    
    // Update the counter
    await prisma.webAuthnCredentials.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });
    console.log('Updated credential counter');
    
    // Clean up the challenge
    await prisma.webAuthnCredentialChallenge.delete({
      where: { userId: user.id },
    });
    console.log('Cleaned up challenge');
    
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
      console.log('Employee record not found');
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
    console.error('Authentication verification error:', error);
    return NextResponse.json({ 
      error: 'Verification failed',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 400 });
  }
}