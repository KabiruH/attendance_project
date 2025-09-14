// app/api/organization/geofence-config/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Get organization from headers (set by middleware)
    const organizationId = req.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization context found' },
        { status: 401 }
      );
    }

    const organization = await db.organizations.findUnique({
      where: { id: parseInt(organizationId) },
      select: {
        center_latitude: true,
        center_longitude: true,
        max_distance_meters: true,
        geofencing_enabled: true,
        name: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Return the database-stored configuration
    return NextResponse.json({
      center_latitude: organization.center_latitude ? parseFloat(organization.center_latitude.toString()) : null,
      center_longitude: organization.center_longitude ? parseFloat(organization.center_longitude.toString()) : null,
      max_distance_meters: organization.max_distance_meters || 50,
      geofencing_enabled: organization.geofencing_enabled,
      organization_name: organization.name
    });
  } catch (error) {
    console.error('Error fetching geofence config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch geofence configuration' },
      { status: 500 }
    );
  }
}