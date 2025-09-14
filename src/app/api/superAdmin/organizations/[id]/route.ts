// app/api/superadmin/organizations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { withSuperAdminAuth } from '@/lib/auth/superadmin-auth';
import { updateOrganization, deactivateOrganization } from '@/lib/superAdmin';

const db = new PrismaClient();

// GET /api/superadmin/organizations/[id] - Get single organization details
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  // Check SuperAdmin access
  const authResult = await withSuperAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }

  const { id } = await params;
  const orgId = parseInt(id);

  try {
    // Get organization details with all related data
    const organization = await db.organizations.findUnique({
      where: { id: orgId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            is_active: true,
            created_at: true,
            phone_number: true,
            department: true
          }
        },
        classes: {
          select: {
            id: true,
            name: true,
            code: true,
            is_active: true,
            department: true,
            duration_hours: true
          }
        },
        _count: {
          select: {
            users: true,
            classes: true
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PUT /api/superadmin/organizations/[id] - Update organization details
export async function PUT(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  // Check SuperAdmin access
  const authResult = await withSuperAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }

  const { user: superAdmin } = authResult;
  const { id } = await params;
  const orgId = parseInt(id);

  try {
    const body = await req.json();
    
    const organization = await updateOrganization(
      orgId,
      body,
      superAdmin.email
    );

    return NextResponse.json({
      message: 'Organization updated successfully',
      organization
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      {
        error: 'Failed to update organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}

// PATCH /api/superadmin/organizations/[id] - Update geofencing settings specifically
export async function PATCH(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  // Check SuperAdmin access
  const authResult = await withSuperAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }

  const { user: superAdmin } = authResult;
  const { id } = await params;
  const orgId = parseInt(id);

  try {
    const body = await req.json();
    const { 
      center_latitude, 
      center_longitude, 
      max_distance_meters, 
      geofencing_enabled 
    } = body;

    // Validate coordinates if provided
    if (center_latitude !== null && center_latitude !== undefined && (center_latitude < -90 || center_latitude > 90)) {
      return NextResponse.json(
        { error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (center_longitude !== null && center_longitude !== undefined && (center_longitude < -180 || center_longitude > 180)) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    if (geofencing_enabled && (!center_latitude || !center_longitude)) {
      return NextResponse.json(
        { error: 'Center coordinates are required when geofencing is enabled' },
        { status: 400 }
      );
    }

    // Update only geofencing-related fields
    const organization = await db.organizations.update({
      where: { id: orgId },
      data: {
        center_latitude: center_latitude ?? null,
        center_longitude: center_longitude ?? null,
        max_distance_meters: max_distance_meters ?? 50,
        geofencing_enabled: !!geofencing_enabled,
        updated_at: new Date()
      }
    });

    return NextResponse.json({
      message: 'Geofencing settings updated successfully',
      organization
    });
  } catch (error) {
    console.error('Error updating coordinates:', error);
    return NextResponse.json(
      {
        error: 'Failed to update geofencing settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}

// DELETE /api/superadmin/organizations/[id] - Deactivate organization
export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  // Check SuperAdmin access
  const authResult = await withSuperAdminAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }

  const { id } = await params;
  const orgId = parseInt(id);

  try {
    const organization = await deactivateOrganization(orgId);
    
    return NextResponse.json({ 
      message: 'Organization deactivated successfully', 
      organization 
    });
  } catch (error) {
    console.error('Error deactivating organization:', error);
    return NextResponse.json(
      {
        error: 'Failed to deactivate organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}