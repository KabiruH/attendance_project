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
import crypto from 'crypto';

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
// Had to push back time by 3 hours because of the time difference in the hosted server
const TIME_CONSTRAINTS = {
  CHECK_IN_START: 4,  // 7 AM
  WORK_START: 6,      // 9 AM
  WORK_END: 15        // 5 PM
};

// Geofence configuration for mobile
const GEOFENCE = {
  latitude: -0.0284967, 
  longitude: 37.658594, 
  radius: 100,
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
      
      // 🔧 FIX: Use the employeeId from JWT payload
      // The mobile JWT contains employeeId which should match employees.id
      const employeeId = mobileAuth.payload.employeeId;
      
      if (!employeeId) {
        throw new Error('No employeeId in mobile JWT payload');
      }
      
      return { 
        userId: employeeId,  // Use employeeId directly
        authMethod: 'mobile_jwt' 
      };
    }
  } catch (error) {
    console.error('Mobile JWT verification failed:', error);
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
  if (!attendance) {
    console.log('❌ hasActiveSession: No attendance record');
    return false;
  }

  if (attendance.sessions && Array.isArray(attendance.sessions)) {
    console.log('Using sessions array, count:', attendance.sessions.length);
    
    const activeSession = attendance.sessions.some((session: any) => {
      // Handle both formats: check_in/check_out AND check_in_time/check_out_time
      const hasCheckIn = session.check_in || session.check_in_time;
      const hasCheckOut = session.check_out || session.check_out_time;
      const isActive = hasCheckIn && !hasCheckOut;
      
      console.log('Session:', {
        hasCheckIn: !!hasCheckIn,
        hasCheckOut: !!hasCheckOut,
        isActive
      });
      
      return isActive;
    });
    
    console.log('Active session found:', activeSession);
    console.log('=== END hasActiveSession DEBUG ===');
    return activeSession;
  }

  // Fallback to old format
  const fallbackResult = !!(attendance.check_in_time && !attendance.check_out_time);
  console.log('Using fallback logic:', fallbackResult);
  console.log('=== END hasActiveSession DEBUG ===');
  
  return fallbackResult;
}

// Configuration
const DEVICE_CHECK_CONFIG = {
  TIME_WINDOW_MINUTES: 360, // Block if same device used within 10 minutes
  ENABLED: true, // Easy toggle
};

/**
 * Generate device fingerprint from request data
 * Combines multiple attributes for uniqueness
 */
function generateDeviceFingerprint(request: NextRequest, isMobileRequest: boolean): string {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIP(request);
  
  // For mobile, include additional headers that apps typically send
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  
  // Combine attributes
  const fingerprintData = `${userAgent}|${ip}|${acceptLanguage}|${acceptEncoding}`;
  
  // Create hash
  return crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex');
}

/**
 * Check if device was recently used by a different employee
 */
async function checkDeviceReuse(
  deviceHash: string,
  currentEmployeeId: number
): Promise<{ allowed: boolean; error?: string; lastUser?: string }> {
  if (!DEVICE_CHECK_CONFIG.ENABLED) {
    return { allowed: true };
  }

  const timeWindowStart = new Date();
  timeWindowStart.setMinutes(
    timeWindowStart.getMinutes() - DEVICE_CHECK_CONFIG.TIME_WINDOW_MINUTES
  );

  // Find recent check-ins from this device
  const recentCheckIn = await db.deviceCheckIn.findFirst({
    where: {
      device_hash: deviceHash,
      checked_in_at: {
        gte: timeWindowStart,
      },
      employee_id: {
        not: currentEmployeeId, // Different employee
      },
    },
    include: {
      employee: {
        select: { name: true },
      },
    },
    orderBy: {
      checked_in_at: 'desc',
    },
  });

  if (recentCheckIn) {
    return {
      allowed: false,
      error: 'This device was recently used to check in another user',
      lastUser: recentCheckIn.employee?.name,
    };
  }

  return { allowed: true };
}

/**
 * Record device check-in
 */
async function recordDeviceCheckIn(
  deviceHash: string,
  employeeId: number,
  clientIP: string,
  userAgent: string
): Promise<void> {
  if (!DEVICE_CHECK_CONFIG.ENABLED) return;

  await db.deviceCheckIn.create({
    data: {
      device_hash: deviceHash,
      employee_id: employeeId,
      ip_address: clientIP,
      user_agent: userAgent,
    },
  });

  // Optional: Clean up old records (older than 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  await db.deviceCheckIn.deleteMany({
    where: {
      checked_in_at: {
        lt: oneDayAgo,
      },
    },
  });
}

async function handleCheckIn(
  employee_id: number,
  currentTime: Date,
  currentDate: string,
  isMobileRequest: boolean = false,
  location?: any,
  clientIP?: string,
  userAgent?: string
): Promise<AttendanceResponse> {
  console.log('=== HANDLE CHECK-IN DEBUG ===');
  console.log('employee_id:', employee_id);
  console.log('currentTime:', currentTime);
  console.log('currentDate:', currentDate);
  console.log('isMobileRequest:', isMobileRequest);
  console.log('Current hour:', currentTime.getHours());
 
  if (currentTime.getHours() < TIME_CONSTRAINTS.CHECK_IN_START) {
    console.log('❌ Too early - before', TIME_CONSTRAINTS.CHECK_IN_START);
    return { success: false, error: 'Check-in not allowed before 7 AM' };
  }

  if (currentTime.getHours() >= TIME_CONSTRAINTS.WORK_END) {
    console.log('❌ Too late - after', TIME_CONSTRAINTS.WORK_END);
    return { success: false, error: 'Check-in not allowed after 5 PM' };
  }

  const existingAttendance = await db.attendance.findFirst({
    where: { employee_id, date: new Date(currentDate) },
  });

  console.log('Existing attendance found:', !!existingAttendance);
  if (existingAttendance) {
    console.log('Existing attendance ID:', existingAttendance.id);
    console.log('Has check_in_time:', !!existingAttendance.check_in_time);
    console.log('Has sessions:', !!existingAttendance.sessions);
  }

  const startTime = new Date(currentTime);
  startTime.setHours(TIME_CONSTRAINTS.WORK_START, 0, 0, 0);
  const status = currentTime > startTime ? 'Late' : 'Present';

  if (existingAttendance) {
    if (isMobileRequest) {
      // Mobile: Check if already checked in for work
      if (existingAttendance.check_in_time) {
        console.log('❌ Mobile: Already checked in');
        return { success: false, error: 'You have already checked in for work today' };
      }
     
      console.log('✅ Mobile: Updating existing attendance record');
      // Update existing record with mobile check-in
      let existingSessions: any[] = [];
     
      if (existingAttendance.sessions) {
        try {
          const sessionData = existingAttendance.sessions as unknown;
          if (Array.isArray(sessionData)) {
            existingSessions = sessionData;
          } else if (typeof sessionData === 'string') {
            existingSessions = JSON.parse(sessionData);
          }
        } catch (parseError) {
          console.error('Error parsing existing sessions:', parseError);
          existingSessions = [];
        }
      }
     
      // Add new session in standardized format
      existingSessions.push({
        check_in: currentTime,
        check_out: null,
        metadata: {
          type: 'work',
          location,
          ip_address: clientIP,
          user_agent: userAgent
        }
      });
     
      const attendance = await db.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          check_in_time: currentTime,
          sessions: existingSessions as unknown as Prisma.JsonArray,
          status,
        },
      });

      console.log('✅ Mobile: Updated attendance record');
      return {
        success: true,
        data: attendance,
        message: 'Mobile check-in successful'
      };
    } else {
      // WEB: Handle multiple sessions
      console.log('🌐 Web: Processing existing attendance');
      
      const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);
      console.log('Existing sessions count:', existingSessions.length);
      
      const activeSession = existingSessions.find(session => session.check_in && !session.check_out);
      console.log('Active session found:', !!activeSession);

      if (activeSession) {
        // Update existing active session's check-in time
        console.log('✅ Web: Updating active session check-in time');
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
        // Create new session
        console.log('✅ Web: Creating new session');
        existingSessions.push({
          check_in: currentTime,
          check_out: undefined
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

  // Create new attendance record (only if none exists)
  console.log('🆕 Creating new attendance record');
  const initialSessions: any[] = isMobileRequest
    ? [{
        check_in: currentTime,
        check_out: null,
        metadata: {
          type: 'work',
          location,
          ip_address: clientIP,
          user_agent: userAgent
        }
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

  console.log('✅ Created new attendance record with ID:', attendance.id);

  const message = isMobileRequest
    ? (status === 'Late'
        ? `Checked in late at ${currentTime.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })}`
        : `Checked in on time at ${currentTime.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })}`)
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

 // Replace the mobile check-out section in handleCheckOut function
// Replace the mobile check-out section in handleCheckOut function:

if (isMobileRequest) {
  // Mobile: Simple check-out logic
  if (!existingAttendance.check_in_time) {
    return { success: false, error: 'You must check in before checking out' };
  }

  if (existingAttendance.check_out_time) {
    return { success: false, error: 'You have already checked out for work today' };
  }

  let existingSessions: any[] = [];
  
  if (existingAttendance.sessions) {
    try {
      const sessionData = existingAttendance.sessions as unknown;
      if (Array.isArray(sessionData)) {
        existingSessions = sessionData;
      } else if (typeof sessionData === 'string') {
        existingSessions = JSON.parse(sessionData);
      }
    } catch (parseError) {
      console.error('Error parsing existing sessions:', parseError);
      existingSessions = [];
    }
  }

  // Find the active session and update it
  const activeSessionIndex = existingSessions.findIndex(session => 
    session.check_in && !session.check_out
  );

  if (activeSessionIndex !== -1) {
    // Update existing session
    existingSessions[activeSessionIndex].check_out = currentTime;
    
    // Add checkout metadata
    existingSessions[activeSessionIndex].checkout_metadata = {
      location,
      ip_address: clientIP,
      user_agent: userAgent
    };
  } else {
    // If no active session found, this shouldn't happen, but handle it
    return { success: false, error: 'No active session found to check out' };
  }

  const attendance = await db.attendance.update({
    where: { id: existingAttendance.id },
    data: {
      check_out_time: currentTime,
      sessions: existingSessions as unknown as Prisma.JsonArray,
    }
  });

  return { 
    success: true, 
    data: attendance,
    message: `Checked out at ${currentTime.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })}`
  };
}
  else {
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

  // ✅ GENERATE DEVICE FINGERPRINT
    const deviceFingerprint = generateDeviceFingerprint(request, isMobileRequest);

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

     // ✅ CHECK DEVICE REUSE (before processing check-in)
    const deviceCheck = await checkDeviceReuse(deviceFingerprint, userId);

  if (!deviceCheck.allowed) {
      console.log(`🚫 Device reuse blocked for employee ${userId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: deviceCheck.error,
          code: 'DEVICE_REUSE_DETECTED'
        },
        { status: 403 }
      );
    }

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

    // Only check device reuse for check-ins (not check-outs)
    if (normalizedAction === 'check-in') {
      // ✅ RECORD THIS DEVICE CHECK-IN
      await recordDeviceCheckIn(deviceFingerprint, userId, clientIP, userAgent);
    }

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