// app/api/admin/login-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

export async function GET(request: NextRequest) {
  try {
    // Get the token from cookies (using your pattern)
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    // Verify token and check if admin (using your JWT pattern)
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 401 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    const loginMethod = searchParams.get('loginMethod');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const ipAddress = searchParams.get('ipAddress');

    // Build where clause for filtering
    const whereClause: any = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (email) {
      whereClause.email = {
        contains: email,
        mode: 'insensitive'
      };
    }

    if (loginMethod && loginMethod !== 'all') {
      whereClause.login_method = loginMethod;
    }

    if (ipAddress) {
      whereClause.ip_address = {
        contains: ipAddress
      };
    }

    if (dateFrom || dateTo) {
      whereClause.attempted_at = {};
      if (dateFrom) {
        whereClause.attempted_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.attempted_at.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch logs with user/employee details
    const [logs, totalCount] = await Promise.all([
      db.loginLogs.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              id_number: true,
              role: true,
              department: true
            }
          },
          employee: {
            select: {
              id: true,
              name: true,
              employee_id: true
            }
          }
        },
        orderBy: {
          attempted_at: 'desc'
        },
        skip,
        take: limit
      }),
      db.loginLogs.count({
        where: whereClause
      })
    ]);

    // Transform data for frontend
    const transformedLogs = logs.map(log => ({
      id: log.id,
      email: log.email,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      status: log.status,
      failure_reason: log.failure_reason,
      login_method: log.login_method,
      attempted_at: log.attempted_at.toISOString(),
      user_name: log.user?.name || log.employee?.name || 'Unknown',
      user_id_number: log.user?.id_number || 'N/A',
      user_role: log.user?.role || 'N/A',
      user_department: log.user?.department || 'N/A'
    }));

    // Get summary statistics
    const stats = await getLoginStats(whereClause);

    return NextResponse.json({
      logs: transformedLogs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching login logs:', error);
    
    // Handle JWT errors like in your pattern
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        );
      }
      if (error.message.includes('invalid token')) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to fetch login logs" },
      { status: 500 }
    );
  }
}

// Helper function to get login statistics
async function getLoginStats(whereClause: any) {
  try {
    const [
      totalAttempts,
      successfulLogins,
      failedAttempts,
      blockedAttempts,
      uniqueUsers,
      recentAttempts
    ] = await Promise.all([
      // Total attempts
      db.loginLogs.count({ where: whereClause }),
      
      // Successful logins
      db.loginLogs.count({ 
        where: { ...whereClause, status: 'success' } 
      }),
      
      // Failed attempts
      db.loginLogs.count({ 
        where: { ...whereClause, status: 'failed' } 
      }),
      
      // Blocked attempts
      db.loginLogs.count({ 
        where: { ...whereClause, status: 'blocked' } 
      }),
      
      // Unique users (distinct emails)
      db.loginLogs.findMany({
        where: whereClause,
        distinct: ['email'],
        select: { email: true }
      }),
      
      // Recent attempts (last 24 hours)
      db.loginLogs.count({
        where: {
          ...whereClause,
          attempted_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      totalAttempts,
      successfulLogins,
      failedAttempts,
      blockedAttempts,
      uniqueUsers: uniqueUsers.length,
      recentAttempts,
      successRate: totalAttempts > 0 ? Math.round((successfulLogins / totalAttempts) * 100) : 0
    };
  } catch (error) {
    console.error('Error getting login stats:', error);
    return {
      totalAttempts: 0,
      successfulLogins: 0,
      failedAttempts: 0,
      blockedAttempts: 0,
      uniqueUsers: 0,
      recentAttempts: 0,
      successRate: 0
    };
  }
}