// app/api/webauthn/generate-authentication-options/route.ts - Secure context fix
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import prisma from '@/lib/prisma';

// Define the expected type for allowCredentials items
type AllowCredentialItem = {
  id: string;
  transports?: AuthenticatorTransportFuture[] | undefined;
};

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    
    if (!username) {
      console.log('No username provided');
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    
    console.log(`Generating authentication options for username: ${username}`);
    
    // Extract origin from request for security validation
    const origin = req.headers.get('origin') || '';
    const host = req.headers.get('host') || '';
    console.log(`Request origin: ${origin}, host: ${host}`);
    
    // Determine correct RP ID based on the host
    // For development: localhost or IP address
    // For production: your actual domain
    const isLocalhost = host.includes('localhost') || /^127\.0\.0\.1/.test(host);
    const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}/.test(host);
    
    // Default fallback RP ID
    let rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
    
    // Set RP ID based on current environment
    if (isLocalhost) {
      rpID = 'localhost';
    } else if (isIPAddress) {
      // IP addresses are tricky with WebAuthn - depending on browser
      const ipMatch = host.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) {
        rpID = ipMatch[1];
        console.log(`Using IP address as RP ID: ${rpID}`);
      }
    } else {
      // Extract domain from host (remove port if present)
      const domainMatch = host.match(/^([^:]+)/);
      if (domainMatch) {
        rpID = domainMatch[1];
        console.log(`Using domain as RP ID: ${rpID}`);
      }
    }
    
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
    
    // Create an empty array of the correct type first
    const allowCredentials: AllowCredentialItem[] = [];
    
    // Then populate it with valid credentials
    for (const cred of user.webAuthnCredentials) {
      try {
        // Log credential details for debugging
        console.log(`Processing credential ${cred.id}, type: ${typeof cred.credentialId}`);
        
        const item: AllowCredentialItem = {
          id: cred.credentialId,
        };
        
        if (cred.transports) {
          try {
            item.transports = JSON.parse(cred.transports) as AuthenticatorTransportFuture[];
          } catch (e) {
            console.warn(`Could not parse transports for credential ${cred.id}:`, e);
          }
        }
        
        allowCredentials.push(item);
        console.log(`Added credential: ${item.id.substring(0, 10)}...`);
      } catch (error) {
        console.error('Error preparing credential:', error);
        // Skip this credential if there's an error
      }
    }
    
    if (allowCredentials.length === 0) {
      console.log('No valid credentials found');
      return NextResponse.json(
        { error: 'No valid credentials found for user' },
        { status: 400 }
      );
    }
    
    // Generate authentication options with proper typing
    const options = await generateAuthenticationOptions({
      // Use the dynamically determined RP ID
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000, // 1 minute timeout
    });
    
    try {
      // First check if there's an existing challenge for this user
      const existingChallenge = await prisma.webAuthnCredentialChallenge.findUnique({
        where: { userId: user.id },
      });
      
      if (existingChallenge) {
        // Update existing challenge
        await prisma.webAuthnCredentialChallenge.update({
          where: { userId: user.id },
          data: {
            challenge: options.challenge,
            expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });
      } else {
        // Create new challenge
        await prisma.webAuthnCredentialChallenge.create({
          data: {
            userId: user.id,
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
    console.error('Error generating authentication options:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}