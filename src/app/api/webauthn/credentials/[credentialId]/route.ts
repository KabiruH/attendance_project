// /app/api/webauthn/credentials/[credentialId]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAuth } from '@/lib/checkAuth';

export async function DELETE(
  request: Request,
  { params }: { params: { credentialId: string } }
) {
  try {
    // Use the same auth check as profile route
    const authResult = await checkAuth();
    
    if (!authResult.authenticated || !authResult.user) {
      console.log('Unauthorized:', authResult.error || 'No user in auth result');
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
    }

    const credentialId = params.credentialId;
    console.log(`Attempting to delete credential ID: ${credentialId}`);
    
    // Find the credential
    const credential = await prisma.webAuthnCredentials.findUnique({
      where: { credentialId },
      select: { userId: true },
    });

    if (!credential) {
      console.log('Credential not found');
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    // Check if the credential belongs to the logged-in user
    if (credential.userId !== authResult.user.userId) {
      console.log(`Credential belongs to user ${credential.userId}, not ${authResult.user.userId}`);
      return NextResponse.json(
        { error: 'Unauthorized to delete this credential' },
        { status: 403 }
      );
    }

    // Delete the credential
    await prisma.webAuthnCredentials.delete({
      where: { credentialId },
    });

    console.log('Credential deleted successfully');
    return NextResponse.json({ 
      success: true,
      message: 'Credential deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting credential:', error);
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    );
  }
}