// lib/superAdmin.ts - SuperAdmin utilities
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// SuperAdmin roles - these exist outside of organizations
export const SUPERADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin'
} as const;

interface User {
  role: string;
  email: string;
}

interface OrganizationData {
  organization_type: string;
  parent_id: null;
  name: string;
  slug: string;
  domain?: string;
  subdomain?: string;
  logo_url?: string;
  center_latitude?: number;
  center_longitude?: number;
  max_distance_meters?: number;
  geofencing_enabled?: boolean;
}

/**
 * Check if user is a superadmin
 */
export const isSuperAdmin = (user: User): boolean => {
  return user && Object.values(SUPERADMIN_ROLES).includes(user.role as any);
};

/**
 * Create a new organization (SuperAdmin only)
 */
export const createOrganization = async (orgData: OrganizationData, createdBy: string) => {
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
  } = orgData;

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
  }

  // Validate geolocation data if provided
  if (geofencing_enabled && (!center_latitude || !center_longitude)) {
    throw new Error('Center coordinates are required when geofencing is enabled');
  }

  if (center_latitude && (center_latitude < -90 || center_latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (center_longitude && (center_longitude < -180 || center_longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180');
  }

  // Check for duplicates
  const existing = await db.organizations.findFirst({
    where: {
      OR: [
        { slug },
        { domain: domain || undefined },
        { subdomain: subdomain || undefined }
      ]
    }
  });

  if (existing) {
    throw new Error('Organization with this slug, domain, or subdomain already exists');
  }

  const organization = await db.organizations.create({
    data: {
      name,
      slug,
      domain,
      subdomain,
      logo_url,
      center_latitude: center_latitude ? center_latitude : null,
      center_longitude: center_longitude ? center_longitude : null,
      max_distance_meters: max_distance_meters ? max_distance_meters : 50,
      geofencing_enabled: !!geofencing_enabled,
      parent_id: orgData.parent_id || null,              // Add this
      organization_type: orgData.organization_type || 'client',  // Add this
      created_by: createdBy
    }
  });

  return organization;
};

/**
 * Update organization (SuperAdmin only)
 */
export const updateOrganization = async (id: number, updateData: Partial<OrganizationData>, updatedBy: string) => {
  // Validate slug format if updating slug
  if (updateData.slug && !/^[a-z0-9-]+$/.test(updateData.slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
  }

  // Validate geolocation data if provided
  if (updateData.geofencing_enabled && (!updateData.center_latitude || !updateData.center_longitude)) {
    throw new Error('Center coordinates are required when geofencing is enabled');
  }

  if (updateData.center_latitude && (updateData.center_latitude < -90 || updateData.center_latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (updateData.center_longitude && (updateData.center_longitude < -180 || updateData.center_longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180');
  }

  // Check for duplicates if updating slug, domain, or subdomain
  if (updateData.slug || updateData.domain || updateData.subdomain) {
    const existing = await db.organizations.findFirst({
      where: {
        AND: [
          { id: { not: id } }, // Exclude current organization
          {
            OR: [
              updateData.slug ? { slug: updateData.slug } : {},
              updateData.domain ? { domain: updateData.domain } : {},
              updateData.subdomain ? { subdomain: updateData.subdomain } : {}
            ].filter(condition => Object.keys(condition).length > 0)
          }
        ]
      }
    });

    if (existing) {
      throw new Error('Organization with this slug, domain, or subdomain already exists');
    }
  }

  const organization = await db.organizations.update({
    where: { id },
    data: {
      ...updateData,
      updated_at: new Date()
    }
  });

  return organization;
};

/**
 * Deactivate organization (SuperAdmin only)
 */
export const deactivateOrganization = async (id: number) => {
  return await db.organizations.update({
    where: { id },
    data: { 
      is_active: false,
      updated_at: new Date()
    }
  });
};

/**
 * Activate organization (SuperAdmin only)
 */
export const activateOrganization = async (id: number) => {
  return await db.organizations.update({
    where: { id },
    data: { 
      is_active: true,
      updated_at: new Date()
    }
  });
};

/**
 * Get organization statistics (SuperAdmin only)
 */
export const getOrganizationStats = async (id: number) => {
  const stats = await db.organizations.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          classes: true,
          attendanceProcessingLogs: true
        }
      },
      users: {
        where: { is_active: true },
        select: {
          role: true
        }
      }
    }
  });

  if (!stats) {
    throw new Error('Organization not found');
  }

  // Count users by role
  const usersByRole = stats.users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalUsers: stats._count.users,
    activeUsers: stats.users.length,
    totalClasses: stats._count.classes,
    attendanceLogs: stats._count.attendanceProcessingLogs,
    usersByRole,
    organization: {
      id: stats.id,
      name: stats.name,
      slug: stats.slug,
      is_active: stats.is_active,
      geofencing_enabled: stats.geofencing_enabled
    }
  };
};

/**
 * Get all organizations with basic stats (SuperAdmin only)
 */
export const getAllOrganizationsWithStats = async () => {
  const organizations = await db.organizations.findMany({
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

  return organizations.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    subdomain: org.subdomain,
    logo_url: org.logo_url,
    is_active: org.is_active,
    geofencing_enabled: org.geofencing_enabled,
    center_latitude: org.center_latitude,
    center_longitude: org.center_longitude,
    max_distance_meters: org.max_distance_meters,
    created_at: org.created_at,
    updated_at: org.updated_at,
    created_by: org.created_by,
    userCount: org._count.users,
    classCount: org._count.classes
  }));
};

/**
 * Update organization geofencing settings specifically (SuperAdmin only)
 */
export const updateOrganizationGeofencing = async (
  id: number, 
  geofencingData: {
    center_latitude?: number;
    center_longitude?: number;
    max_distance_meters?: number;
    geofencing_enabled?: boolean;
  },
  updatedBy: string
) => {
  const { center_latitude, center_longitude, max_distance_meters, geofencing_enabled } = geofencingData;

  // Validate coordinates if provided
  if (center_latitude && (center_latitude < -90 || center_latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (center_longitude && (center_longitude < -180 || center_longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180');
  }

  if (geofencing_enabled && (!center_latitude || !center_longitude)) {
    throw new Error('Center coordinates are required when geofencing is enabled');
  }

  if (max_distance_meters && (max_distance_meters < 1 || max_distance_meters > 10000)) {
    throw new Error('Max distance must be between 1 and 10000 meters');
  }

  const organization = await db.organizations.update({
    where: { id },
    data: {
      center_latitude: center_latitude ?? null,
      center_longitude: center_longitude ?? null,
      max_distance_meters: max_distance_meters ?? 50,
      geofencing_enabled: !!geofencing_enabled,
      updated_at: new Date()
    }
  });

  return organization;
};

/**
 * Bulk operations for organizations (SuperAdmin only)
 */
export const bulkUpdateOrganizations = async (
  organizationIds: number[],
  updateData: { is_active?: boolean; geofencing_enabled?: boolean },
  updatedBy: string
) => {
  const result = await db.organizations.updateMany({
    where: {
      id: { in: organizationIds }
    },
    data: {
      ...updateData,
      updated_at: new Date()
    }
  });

  return result;
};

/**
 * Delete organization permanently (SuperAdmin only) - Use with extreme caution
 */
export const deleteOrganizationPermanently = async (id: number) => {
  // This will cascade delete all related data due to foreign key constraints
  // Use with extreme caution!
  
  return await db.organizations.delete({
    where: { id }
  });
};





