// app/api/superadmin/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { withSuperAdminAuth } from '@/lib/auth/superadmin-auth';
import { createOrganization } from '@/lib/superAdmin';

const db = new PrismaClient();

export async function GET(req: NextRequest) {
  // Check SuperAdmin access
  const authResult = await withSuperAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // List all organizations
     const organizations = await db.organizations.findMany({
      where: { 
        organization_type: 'client' 
      },
      include: {
        _count: {
          select: {
            users: true,
            classes: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Check SuperAdmin access
  const authResult = await withSuperAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user: superAdmin } = authResult;

  try {
    const body = await req.json();
    const {
      name,
      slug,
      domain,
      subdomain,
      logo_url,
      center_latitude,
      center_longitude,
      max_distance_meters,
      geofencing_enabled
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const organization = await createOrganization({
      name,
      slug,
      domain,
      subdomain,
      logo_url,
      center_latitude,
      center_longitude,
      max_distance_meters,
      geofencing_enabled,
      organization_type: '',
      parent_id: null
    }, superAdmin.email);

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      {
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}