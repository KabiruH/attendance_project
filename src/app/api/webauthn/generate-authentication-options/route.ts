// /app/api/webauthn/generate-authentication-options/route.ts - for SimpleWebAuthn v13.1.1
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    
    // Find the user by ID number
    const user = await prisma.users.findUnique({
      where: { id_number: username },
      include: {
        webAuthnCredentials: true,
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has registered credentials
    if (!user.webAuthnCredentials || user.webAuthnCredentials.length === 0) {
      return NextResponse.json(
        { error: 'No registered credentials found for user' },
        { status: 400 }
      );
    }
    
    // Get credentials for this user - updated for v13.1.1
    const allowCredentials = user.webAuthnCredentials.map(cred => ({
      id: (cred.credentialId, 'base64url'),
      type: 'public-key' as const,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    }));
    
    const options = await generateAuthenticationOptions({
      rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
      allowCredentials,
      userVerification: 'preferred',
    });
    
    // Store the challenge in the database
    await prisma.$transaction(async (tx) => {
      // First check if there's an existing challenge for this user
      const existingChallenge = await tx.webAuthnCredentialChallenge.findUnique({
        where: { userId: user.id },
      });
      
      if (existingChallenge) {
        // Update existing challenge
        await tx.webAuthnCredentialChallenge.update({
          where: { userId: user.id },
          data: {
            challenge: options.challenge,
            expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });
      } else {
        // Create new challenge
        await tx.webAuthnCredentialChallenge.create({
          data: {
            userId: user.id,
            challenge: options.challenge,
            expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });
      }
    });
    
    return NextResponse.json(options);
  } catch (error) {
    console.error('Error generating authentication options:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}