// lib/tenant-detection.ts
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

const db = new PrismaClient();

export const getOrganizationFromRequest = async (req: NextRequest) => {
  const hostname = req.nextUrl.hostname;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    // Development: Use localhost
    if (hostname === 'localhost' || hostname.startsWith('localhost:')) {
      // Check if it's admin/superadmin routes
      if (req.nextUrl.pathname.startsWith('/superadmin')) {
        return await db.organizations.findFirst({
          where: { organization_type: 'parent', slug: 'optimum-systems' }
        });
      }
      
      // For regular routes, you could default to a test organization
      // or handle based on query params: localhost:3000?org=abc-school
      const orgSlug = req.nextUrl.searchParams.get('org') || 'default-test-school';
      return await db.organizations.findFirst({
        where: { slug: orgSlug, organization_type: 'client' }
      });
    }
  } else {
    // Production: Use your domain logic
    // ... existing domain detection
  }
};