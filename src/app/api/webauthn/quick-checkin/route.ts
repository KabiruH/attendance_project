// app/api/auth/webauthn/quick-checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import crypto from 'crypto';

// POST /api/auth/webauthn/quick-checkin - Initiate WebAuthn authentication for quick check-in
export async function POST(request: NextRequest) {
  try {
    // Generate a random challenge
    const challenge = crypto.randomBytes(32);
    const challengeId = crypto.randomUUID();

    // Get all WebAuthn credentials for potential authentication
    const credentials = await db.webAuthnCredentials.findMany({
      where: {
        user: {
          is_active: true
        }
      },
      select: {
        credentialId: true,
        transports: true,
        userId: true,
        user: {
          select: {
            name: true,
            role: true,
            department: true
          }
        }
      }
    });

    if (credentials.length === 0) {
      return NextResponse.json(
        { error: 'No registered biometric credentials found' },
        { status: 400 }
      );
    }

    // Store the challenge temporarily in memory (in production, use Redis)
    global.quickCheckInChallenges = global.quickCheckInChallenges || new Map();
    global.quickCheckInChallenges.set(challengeId, {
      challenge: challenge.toString('base64'),
      timestamp: Date.now(),
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    // Clean up old challenges
    const now = Date.now();
    for (const [id, data] of global.quickCheckInChallenges.entries()) {
      if (data.expires < now) {
        global.quickCheckInChallenges.delete(id);
      }
    }

    // Format credentials for WebAuthn
    const allowCredentials = credentials.map(cred => ({
      id: Array.from(Buffer.from(cred.credentialId, 'base64')),
      type: 'public-key',
      transports: cred.transports ? cred.transports.split(',') : ['internal']
    }));

    console.log(`Generated challenge for quick check-in: ${challengeId}`);
    console.log(`Found ${credentials.length} registered credentials`);

    return NextResponse.json({
      challenge: Array.from(challenge),
      allowCredentials,
      challengeId,
      timeout: 60000,
      userVerification: 'preferred'
    });

  } catch (error) {
    console.error('WebAuthn quick check-in initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}