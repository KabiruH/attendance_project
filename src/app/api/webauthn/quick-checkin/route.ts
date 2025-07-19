// app/api/webauthn/quick-checkin/route.ts
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { db } from '@/lib/db/db';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    console.log('Quick check-in endpoint called');

    // Determine RP ID based on environment
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const rpID = isLocalhost ? 'localhost' : (process.env.WEBAUTHN_RP_ID || 'localhost');
    
    console.log(`Using RP ID: ${rpID}`);

    // Get all registered credentials for active users
    const credentials = await db.webAuthnCredentials.findMany({
      where: {
        user: {
          is_active: true
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            department: true
          }
        }
      }
    });

    console.log(`Found ${credentials.length} registered credentials`);

    if (credentials.length === 0) {
      return NextResponse.json(
        { error: 'No registered credentials found for any active users' },
        { status: 400 }
      );
    }

    // Map credentials to the format expected by generateAuthenticationOptions
    const allowCredentials = credentials.map((cred) => {
      const credential: {
        id: string;
        type: 'public-key';
        transports?: AuthenticatorTransportFuture[];
      } = {
        id: cred.credentialId, // Keep as base64url string
        type: 'public-key',
      };

      // Parse transports correctly (fix the double-JSON encoding issue)
      if (cred.transports) {
        try {
          // Handle potential double-JSON encoding
          let parsedTransports: any = cred.transports;
          if (typeof parsedTransports === 'string') {
            parsedTransports = JSON.parse(parsedTransports);
          }
          if (typeof parsedTransports === 'string') {
            parsedTransports = JSON.parse(parsedTransports);
          }
          credential.transports = parsedTransports as AuthenticatorTransportFuture[];
        } catch (e) {
          console.warn(`Could not parse transports for credential ${cred.id}:`, e);
          // Default to common transports if parsing fails
          credential.transports = ['internal'];
        }
      } else {
        // Default transports if none stored
        credential.transports = ['internal'];
      }

      console.log(`Credential ${cred.credentialId.substring(0, 12)}... has transports:`, credential.transports);
      return credential;
    });

    // Generate authentication options using SimpleWebAuthn
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    });

    // Generate a unique challenge ID for tracking
    const challengeId = crypto.randomUUID();
    console.log(`Generated challenge ID: ${challengeId}`);

    // Store the challenge in global memory (matching your existing pattern)
    if (!global.quickCheckInChallenges) {
      global.quickCheckInChallenges = new Map();
    }
    
    global.quickCheckInChallenges.set(challengeId, {
      challenge: options.challenge,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    console.log('Formatted allowCredentials:', allowCredentials.map(cred => ({
      idLength: cred.id.length,
      type: cred.type,
      transports: cred.transports
    })));

    console.log('Returning WebAuthn challenge data');

    // Return the authentication options with challenge ID
    return NextResponse.json({
      ...options,
      challengeId,
      rpId: rpID // Explicitly include rpId for frontend
    });

  } catch (error) {
    console.error('Error in quick check-in:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate authentication challenge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}