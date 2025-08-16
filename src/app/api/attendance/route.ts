// app/api/attendance/route.ts - Cleaned version without WebAuthn
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { DateTime } from 'luxon'
import { db } from '@/lib/db/db';
import { cookies } from 'next/headers';
import { processAutomaticAttendance } from '@/lib/utils/cronUtils';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface AttendanceResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

interface WorkSession {
  check_in: Date;
  check_out?: Date;
}

interface AttendanceSession {
  [key: string]: any;
  check_in_time?: string;
  check_out_time?: string;
  type: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  ip_address?: string;
  user_agent?: string;
  auto_checkout?: boolean;
}

const TIME_CONSTRAINTS = {
  CHECK_IN_START: 7,  // 7 AM
  WORK_START: 9,      // 9 AM
  WORK_END: 17        // 5 PM
};

// Geofence configuration for mobile
const GEOFENCE = {
  latitude: -0.0236,
  longitude: 37.9062,
  radius: 600_000,
};

// Mobile request validation schema
const mobileAttendanceSchema = z.object({
  type: z.enum(['work_checkin', 'work_checkout']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    timestamp: z.number(),
  }),
  biometric_verified: z.boolean(),
  mobile_token: z.string().optional(),
});

// Simplified authentication that supports JWT and mobile JWT only
async function authenticateUser(request: NextRequest): Promise<{ userId: number; authMethod: 'jwt' | 'mobile_jwt' }> {
  // Try JWT first (web app)
  try {
    const token = (await cookies()).get('token');
    if (token) {
      const { payload } = await jwtVerify(
        token.value,
        new TextEncoder().encode(process.env.JWT_SECRET)
      );
      const jwtPayload = payload as unknown as JwtPayload;
      return { userId: jwtPayload.id, authMethod: 'jwt' };
    }
  } catch (error) {
    // JWT failed, continue to mobile JWT
  }

  // Try mobile JWT (mobile app)
  try {
    const mobileAuth = await verifyMobileJWT(request);
    if (mobileAuth.success && mobileAuth.payload) {
      return { 
        userId: mobileAuth.payload.employeeId || mobileAuth.payload.userId, 
        authMethod: 'mobile_jwt' 
      };
    }
  } catch (error) {
    // Mobile JWT failed
  }

  throw new Error('No valid authentication method provided');
}

// Mobile-specific helper functions
function verifyGeofence(lat: number, lng: number): boolean {
  const distance = calculateDistance(lat, lng, GEOFENCE.latitude, GEOFENCE.longitude);
  return distance <= GEOFENCE.radius;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (real) {
    return real;
  }
  if (clientIP) {
    return clientIP;
  }
  
  return 'unknown';
}

// Helper functions
function parseSessionsFromJson(sessionsJson: any): WorkSession[] {
  if (!sessionsJson) return [];

  try {
    if (Array.isArray(sessionsJson)) {
      return sessionsJson as WorkSession[];
    }

    if (typeof sessionsJson === 'string') {
      const parsed = JSON.parse(sessionsJson);
      return Array.isArray(parsed) ? parsed as WorkSession[] : [];
    }

    return [];
  } catch (error) {
    console.error('Error parsing sessions JSON:', error);
    return [];
  }
}

function hasActiveSession(attendance: any): boolean {
  if (!attendance) return false;

  if (attendance.sessions && Array.isArray(attendance.sessions)) {
    return attendance.sessions.some((session: WorkSession) =>
      session.check_in && !session.check_out
    );
  }

  return !!(attendance.check_in_time && !attendance.check_out_time);
}

// Check-in handler that supports both web and mobile
async function handleCheckIn(
  employee_id: number, 
  currentTime: Date, 
  currentDate: string, 
  isMobileRequest: boolean = false, 
  location?: any,
  clientIP?: string,
  userAgent?: string
): Promise<AttendanceResponse> {
  if (currentTime.getHours() < TIME_CONSTRAINTS.CHECK_IN_START) {
    return { success: false, error: 'Check-in not allowed before 7 AM' };
  }

  if (currentTime.getHours() >= TIME_CONSTRAINTS.WORK_END) {
    return { success: false, error: 'Check-in not allowed after 5 PM' };
  }

  const existingAttendance = await db.attendance.findFirst({
    where: { employee_id, date: new Date(currentDate) },
  });

  const startTime = new Date(currentTime);
  startTime.setHours(TIME_CONSTRAINTS.WORK_START, 0, 0, 0);
  const status = currentTime > startTime ? 'Late' : 'Present';

  if (existingAttendance) {
    if (isMobileRequest) {
      // Mobile: Check if already checked in for work
      if (existingAttendance.check_in_time) {
        return { success: false, error: 'You have already checked in for work today' };
      }
    } else {
      // Web: Allow multiple sessions
      const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);
      const activeSession = existingSessions.find(session => session.check_in && !session.check_out);

      if (activeSession) {
        activeSession.check_in = currentTime;

        const attendance = await db.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            sessions: existingSessions as unknown as Prisma.JsonArray,
            status,
          },
        });

        return {
          success: true,
          data: attendance,
          message: 'Check-in time updated for current session'
        };
      } else {
        existingSessions.push({
          check_in: currentTime
        });

        const attendance = await db.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            sessions: existingSessions as unknown as Prisma.JsonArray,
            check_out_time: null,
          },
        });

        return {
          success: true,
          data: attendance,
          message: 'New work session started'
        };
      }
    }
  }

  // Create new attendance record
  const initialSessions: any[] = isMobileRequest 
    ? [{
        check_in_time: currentTime.toISOString(),
        type: 'work',
        location,
        ip_address: clientIP,
        user_agent: userAgent
      }]
    : [{
        check_in: currentTime
      }];

  const attendance = await db.attendance.create({
    data: {
      employee_id,
      date: new Date(currentDate),
      check_in_time: currentTime,
      status,
      sessions: initialSessions as unknown as Prisma.JsonArray,
    },
  });

  const message = isMobileRequest
    ? (status === 'Late' 
        ? `Checked in late at ${currentTime.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`
        : `Checked in on time at ${currentTime.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`)
    : undefined;

  return { 
    success: true, 
    data: attendance,
    message 
  };
}

// Check-out handler
async function handleCheckOut(
  employee_id: number, 
  currentTime: Date, 
  currentDate: string,
  isMobileRequest: boolean = false,
  location?: any,
  clientIP?: string,
  userAgent?: string
): Promise<AttendanceResponse> {
  if (currentTime.getHours() >= TIME_CONSTRAINTS.WORK_END) {
    return {
      success: false,
      error: 'Manual check-out not allowed after 5 PM. System will automatically check you out.'
    };
  }

  const existingAttendance = await db.attendance.findFirst({
    where: { employee_id, date: new Date(currentDate) },
  });

  if (!existingAttendance) {
    return { success: false, error: 'No check-in record found for today' };
  }

  if (isMobileRequest) {
    // Mobile: Simple check-out logic
    if (!existingAttendance.check_in_time) {
      return { success: false, error: 'You must check in before checking out' };
    }

    if (existingAttendance.check_out_time) {
      return { success: false, error: 'You have already checked out for work today' };
    }

    let existingSessions: AttendanceSession[] = [];
    
    if (existingAttendance.sessions) {
      try {
        const sessionData = existingAttendance.sessions as unknown;
        if (Array.isArray(sessionData)) {
          existingSessions = sessionData as AttendanceSession[];
        } else if (typeof sessionData === 'string') {
          existingSessions = JSON.parse(sessionData) as AttendanceSession[];
        }
      } catch (parseError) {
        console.error('Error parsing existing sessions:', parseError);
        existingSessions = [];
      }
    }

    const checkoutSession: AttendanceSession = {
      check_out_time: currentTime.toISOString(),
      type: 'work',
      location,
      ip_address: clientIP,
      user_agent: userAgent
    };

    const updatedSessions = [...existingSessions, checkoutSession];
    const sessionsJson = JSON.parse(JSON.stringify(updatedSessions));

    const attendance = await db.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        check_out_time: currentTime,
        sessions: sessionsJson
      }
    });

    return { 
      success: true, 
      data: attendance,
      message: `Checked out at ${currentTime.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`
    };
  } else {
    // Web: Multiple sessions logic
    const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);
    const activeSession = existingSessions.find(session => session.check_in && !session.check_out);

    if (!activeSession) {
      return { success: false, error: 'No active work session found' };
    }

    activeSession.check_out = currentTime;

    const attendance = await db.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        check_out_time: currentTime,
        sessions: existingSessions as unknown as Prisma.JsonArray,
      },
    });

    return { success: true, data: attendance };
  }
}

// GET endpoint
export async function GET(request: NextRequest) {
  try {
    // Try to authenticate user with both JWT cookie and mobile JWT
    let user: JwtPayload | null = null;
    let authMethod: 'jwt' | 'mobile_jwt' = 'jwt';

    // First try JWT cookie (web app)
    const token = (await cookies()).get('token');
    if (token) {
      try {
        const { payload } = await jwtVerify(
          token.value,
          new TextEncoder().encode(process.env.JWT_SECRET)
        );
        user = payload as unknown as JwtPayload;
        authMethod = 'jwt';
      } catch (error) {

      }
    }

    // If JWT cookie failed, try mobile JWT (mobile app)
    if (!user) {
      try {
        const mobileAuth = await verifyMobileJWT(request);
        if (mobileAuth.success && mobileAuth.payload) {
          // Convert mobile JWT payload to JwtPayload format
          user = {
            id: mobileAuth.payload.employeeId || mobileAuth.payload.userId,
            email: mobileAuth.payload.email || '',
            role: 'employee', // Mobile users are typically employees
            name: mobileAuth.payload.name || ''
          };
          authMethod = 'mobile_jwt';
     
        }
      } catch (error) {

      }
    }

    // If no authentication found, return unauthenticated state
    if (!user) {
      return NextResponse.json({
        success: true,
        role: 'unauthenticated',
        isCheckedIn: false,
        attendanceData: [],
      });
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const autoProcessResult = await processAutomaticAttendance();

    if (user.role === 'admin') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const attendanceData = await db.attendance.findMany({
        where: { date: { gte: sevenDaysAgo } },
        include: {
          Employees: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { date: 'desc' },
          { Employees: { name: 'asc' } },
        ],
      });

      return NextResponse.json({
        success: true,
        role: 'admin',
        attendanceData,
        autoProcessed: autoProcessResult
      });
    }

    // Employee role - get their attendance data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyData = await db.attendance.findMany({
      where: {
        employee_id: user.id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    const todayAttendance = monthlyData.find(
      record => record.date.toISOString().split('T')[0] === currentDate
    );

    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();

    const isCheckedIn = hasActiveSession(todayAttendance) &&
      currentTime.getHours() < TIME_CONSTRAINTS.WORK_END;

    return NextResponse.json({
      success: true,
      role: 'employee',
      isCheckedIn,
      attendanceData: monthlyData,
      authMethod, // Include auth method for debugging
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      success: true,
      role: 'unauthenticated',
      isCheckedIn: false,
      attendanceData: [],
    });
  }
}

// POST endpoint - supports both web and mobile
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  
  try {
    const body = await request.json();
    
    // Detect if this is a mobile request
    const isMobileRequest = body?.type?.startsWith('work_') || !!body?.location;


    // Validate mobile requests
    if (isMobileRequest) {
      try {
        mobileAttendanceSchema.parse(body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { success: false, error: error.issues[0].message },
            { status: 400 }
          );
        }
      }

      // Verify location is within geofence for mobile
      if (body.location) {
        const isWithinGeofence = verifyGeofence(
          body.location.latitude,
          body.location.longitude
        );
        
        if (!isWithinGeofence) {
          const distance = calculateDistance(
            body.location.latitude,
            body.location.longitude,
            GEOFENCE.latitude,
            GEOFENCE.longitude
          );
          
          return NextResponse.json({
            success: false,
            error: 'You must be within the school premises to record attendance',
            distance: Math.round(distance)
          }, { status: 400 });
        }
      }

      // Verify biometric was used for mobile
      if (!body.biometric_verified) {
        return NextResponse.json({
          success: false,
          error: 'Biometric verification is required for attendance'
        }, { status: 400 });
      }
    }

    // Authenticate user (supports JWT and mobile JWT)
    const { userId, authMethod } = await authenticateUser(request);

    // Get employee record
    const employee = await db.employees.findUnique({
      where: { id: userId },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    // Normalize action from mobile or web format
    const normalizedAction = body?.type === 'work_checkin' ? 'check-in' : 
                            body?.type === 'work_checkout' ? 'check-out' : 
                            body?.action;

    const handler = normalizedAction === 'check-in' ? 
      (userId: number, time: Date, date: string) => handleCheckIn(userId, time, date, isMobileRequest, body?.location, clientIP, userAgent) :
      normalizedAction === 'check-out' ? 
      (userId: number, time: Date, date: string) => handleCheckOut(userId, time, date, isMobileRequest, body?.location, clientIP, userAgent) : 
      null;

    if (!handler) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const result = await handler(userId, currentTime, currentDate);
    
    // Log the attendance action
    if (result.success) {
      const loginMethod = authMethod === 'mobile_jwt' ? 'mobile_biometric' : 'jwt';
      
      await db.loginLogs.create({
        data: {
          user_id: employee.employee_id,
          employee_id: employee.id,
          email: employee.email,
          ip_address: clientIP,
          user_agent: userAgent,
          status: 'success',
          login_method: loginMethod,
          failure_reason: null,
          attempted_at: new Date()
        }
      });
    }

    const response = {
      ...result,
      authMethod,
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email
      }
    };

    // Add mobile-specific response data
    if (isMobileRequest) {
      response.data = {
        timestamp: currentTime,
        type: body.type,
        location_verified: true,
        ...result.data
      };
    }

    return NextResponse.json(response, { status: result.success ? 200 : 400 });

  } catch (error) {
    console.error('Attendance error:', error);
    
    // Log failed attempt
    try {
      const bodyForLog = await request.json();
      const isMobileForLog = bodyForLog?.type?.startsWith('work_') || !!bodyForLog?.location;
      
      await db.loginLogs.create({
        data: {
          user_id: null,
          employee_id: null,
          email: 'unknown',
          ip_address: clientIP,
          user_agent: userAgent,
          status: 'failed',
          login_method: isMobileForLog ? 'mobile_biometric' : 'jwt',
          failure_reason: 'attendance_auth_failed',
          attempted_at: new Date()
        }
      });
    } catch (logError) {
      console.error('Error logging failed attempt:', logError);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 401 }
    );
  }
}