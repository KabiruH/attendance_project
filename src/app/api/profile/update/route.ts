// app/api/profile/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/auth';

export async function PUT(req: NextRequest) {
  try {
    // Verify authentication and get user
    const user = await requireAuth();
    
    // Get request body
    const body = await req.json();
    const { name, phone_number, gender } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Update user in database
    const updatedUser = await prisma.users.update({
      where: {
        id: parseInt(user.id),
      },
      data: {
        name,
        phone_number,
        gender,
        updated_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        id_number: true,
        role: true,
        phone_number: true,
        gender: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Verify authentication and get user
    const user = await requireAuth();

    const userProfile = await prisma.users.findUnique({
      where: {
        id: parseInt(user.id),
      },
      select: {
        id: true,
        name: true,
        id_number: true,
        role: true,
        phone_number: true,
        gender: true,
      },
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}