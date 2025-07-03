// app/api/webauthn/generate-authentication-options/route.ts - DEBUG VERSION
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    console.log('=== GENERATE AUTHENTICATION OPTIONS START ===');
    
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { username } = requestBody;
   
    if (!username) {
      console.log('ERROR: No username provided');
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
   
    console.log(`Looking up user with username/id_number: "${username}"`);
   
    // Determine RP ID based on environment
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
   
    const rpID = isLocalhost ? 'localhost' : (process.env.WEBAUTHN_RP_ID || 'localhost');
    console.log(`Using RP ID: ${rpID} (host: ${host})`);
   
    // Find the user by ID number
    const user = await prisma.users.findUnique({
      where: { id_number: username },
      include: {
        webAuthnCredentials: {
          select: {
            id: true,
            credentialId: true,
            transports: true,
            created_at: true,
            counter: true
          }
        }
      }
    });
   
    if (!user) {
      console.log(`ERROR: User not found for ID number: "${username}"`);
      
      // Debug: Check if user exists with different casing or spacing
      const allUsers = await prisma.users.findMany({
        select: { id: true, id_number: true, name: true }
      });
      console.log('All users in database:', allUsers);
      
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
   
    console.log(`✅ Found user:`, {
      id: user.id,
      id_number: user.id_number,
      name: user.name,
      credentialsFromRelation: user.webAuthnCredentials?.length || 0
    });
   
    // Debug: Double-check with direct query
    const directCredentialsQuery = await prisma.webAuthnCredentials.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        credentialId: true,
        transports: true,
        created_at: true,
        counter: true
      }
    });
    
    console.log(`Direct query found ${directCredentialsQuery.length} credentials for userId ${user.id}:`);
    directCredentialsQuery.forEach((cred, index) => {
      console.log(`  Credential ${index + 1}:`, {
        id: cred.id,
        credentialId: cred.credentialId.substring(0, 20) + '...',
        created_at: cred.created_at,
        hasTransports: !!cred.transports
      });
    });
   
    // Debug: Check ALL credentials in database
    const allCredentials = await prisma.webAuthnCredentials.findMany({
      select: {
        id: true,
        userId: true,
        credentialId: true,
        created_at: true
      }
    });
    console.log(`📊 Database contains ${allCredentials.length} total credentials across all users:`);
    allCredentials.forEach((cred, index) => {
      console.log(`  ${index + 1}. UserId: ${cred.userId}, CredId: ${cred.credentialId.substring(0, 15)}..., Created: ${cred.created_at}`);
    });
   
    // Use the direct query results as they're more reliable
    const credentialsToUse = directCredentialsQuery;
   
    // Check if user has registered credentials
    if (!credentialsToUse || credentialsToUse.length === 0) {
      console.log(`❌ No credentials found for user ID: ${user.id}`);
      
      return NextResponse.json({
        error: 'No registered credentials found for user',
        debug: {
          userId: user.id,
          id_number: user.id_number,
          totalCredentialsInDB: allCredentials.length,
          credentialsForThisUser: credentialsToUse.length,
          userExists: true
        }
      }, { status: 400 });
    }
   
    console.log(`✅ Found ${credentialsToUse.length} credentials for user ID: ${user.id}`);
   
    // Map credentials to the format expected by generateAuthenticationOptions
    const allowCredentials = credentialsToUse.map((cred, index) => {
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
          console.log(`  Credential ${index + 1} transports:`, credential.transports);
        } catch (e) {
          console.warn(`Could not parse transports for credential ${cred.id}:`, e);
        }
      }
     
      console.log(`  Adding credential ${index + 1}: ${credential.id.substring(0, 15)}...`);
      return credential;
    });
   
    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    });
   
    console.log(`✅ Generated options:`, {
      challenge: options.challenge.substring(0, 15) + '...',
      rpId: options.rpId,
      allowCredentialsCount: options.allowCredentials?.length || 0
    });
   
    try {
      // Store or update the challenge
      await prisma.webAuthnCredentialChallenge.upsert({
        where: { userId: user.id },
        update: {
          challenge: options.challenge,
          expires: new Date(Date.now() + 5 * 60 * 1000),
        },
        create: {
          userId: user.id,
          challenge: options.challenge,
          expires: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      console.log('✅ Stored challenge in database');
    } catch (error) {
      console.error('❌ Error storing challenge:', error);
      return NextResponse.json(
        { error: 'Failed to store challenge' },
        { status: 500 }
      );
    }
   
    console.log('=== GENERATE AUTHENTICATION OPTIONS SUCCESS ===');
    return NextResponse.json(options);
  } catch (error) {
    console.error('❌ Error generating authentication options:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}