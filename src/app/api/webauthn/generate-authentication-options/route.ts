// app/api/webauthn/generate-authentication-options/route.ts
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    
    if (!username) {
      console.log('No username provided');
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    
    console.log(`Generating authentication options for username: ${username}`);
    
    // Determine RP ID based on environment
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    
    // Use localhost for local development, otherwise use the environment variable
    const rpID = isLocalhost ? 'localhost' : (process.env.WEBAUTHN_RP_ID || 'localhost');
    console.log(`Using RP ID: ${rpID} (host: ${host})`);
    
    // Find the user by ID number
    const user = await prisma.users.findUnique({
      where: { id_number: username },
      include: {
        webAuthnCredentials: true,
      }
    });
    
    if (!user) {
      console.log(`User not found for ID number: ${username}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has registered credentials
    if (!user.webAuthnCredentials || user.webAuthnCredentials.length === 0) {
      console.log(`No credentials found for user ID: ${user.id}`);
      return NextResponse.json(
        { error: 'No registered credentials found for user' },
        { status: 400 }
      );
    }
    
    console.log(`Found ${user.webAuthnCredentials.length} credentials for user ID: ${user.id}`);
    
    // Map credentials to the format expected by generateAuthenticationOptions
    const allowCredentials = user.webAuthnCredentials.map(cred => {
      const credential: {
        id: string;
        type: 'public-key';
        transports?: AuthenticatorTransportFuture[];
      } = {
        id: cred.credentialId,
        type: 'public-key',
      };
      
      // Add transports if available
      if (cred.transports) {
        try {
          credential.transports = JSON.parse(cred.transports) as AuthenticatorTransportFuture[];
        } catch (e) {
          console.warn(`Could not parse transports for credential ${cred.id}:`, e);
        }
      }
      
      console.log(`Added credential: ${credential.id.substring(0, 10)}...`);
      return credential;
    });
    
    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred', // Changed from 'required' to 'preferred' for better compatibility
      timeout: 60000, // 1 minute timeout
    });
    
    console.log('Generated options with challenge:', options.challenge.substring(0, 10) + '...');
    
    try {
      // Store or update the challenge
      await prisma.webAuthnCredentialChallenge.upsert({
        where: { userId: user.id },
        update: {
          challenge: options.challenge,
          expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
        create: {
          userId: user.id,
          challenge: options.challenge,
          expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });
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
    console.error('Error generating authentication options:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}