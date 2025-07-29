// app/api/attendance/mobile/route.ts 
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { z } from 'zod';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';
import { Prisma } from '@prisma/client';

// Make the interface more flexible to work with Prisma's JsonValue
interface AttendanceSession {
  [key: string]: any; // Index signature to satisfy TypeScript
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

// Schema for mobile attendance check-in/out
const attendanceSchema = z.object({
  type: z.enum(['work_checkin', 'work_checkout', 'class_checkin', 'class_checkout']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    timestamp: z.number(),
  }),
  biometric_verified: z.boolean(),
  class_id: z.number().optional(),
});

// Geofence configuration
const GEOFENCE = {
  latitude: -1.22486,
  longitude: 36.70958,
  radius: 50, // meters
};

const ATTENDANCE_RULES = {
  EARLIEST_CHECKIN: 7,     // 7 AM - earliest check-in time
  LATE_THRESHOLD: 9,       // 9 AM - after this time is considered late
  LATEST_CHECKIN: 17,      // 5 PM - no check-ins allowed after this
  AUTO_CHECKOUT: 17,       // 5 PM - automatic checkout time
};

// Helper function to check time rules
function validateCheckInTime(currentTime: Date): { 
  allowed: boolean; 
  isLate: boolean; 
  error?: string 
} {
  const hour = currentTime.getHours();
  const minute = currentTime.getMinutes();
  
  // Check if before 7 AM
  if (hour < ATTENDANCE_RULES.EARLIEST_CHECKIN) {
    return {
      allowed: false,
      isLate: false,
      error: `Check-in not allowed before ${ATTENDANCE_RULES.EARLIEST_CHECKIN}:00 AM`
    };
  }
  
  // Check if after 5 PM
  if (hour >= ATTENDANCE_RULES.LATEST_CHECKIN) {
    return {
      allowed: false,
      isLate: false,
      error: `Check-in not allowed after ${ATTENDANCE_RULES.LATEST_CHECKIN}:00 PM`
    };
  }
  
  // Check if late (after 9 AM)
  const isLate = hour > ATTENDANCE_RULES.LATE_THRESHOLD || 
    (hour === ATTENDANCE_RULES.LATE_THRESHOLD && minute > 0);
  
  return {
    allowed: true,
    isLate,
  };
}

// Helper function to check if checkout is allowed
function validateCheckOutTime(currentTime: Date): { 
  allowed: boolean; 
  isAutoCheckout?: boolean;
  error?: string 
} {
  const hour = currentTime.getHours();
  
  // After 5 PM, only automatic checkout is allowed
  if (hour >= ATTENDANCE_RULES.AUTO_CHECKOUT) {
    return {
      allowed: false,
      isAutoCheckout: true,
      error: `Manual check-out not allowed after ${ATTENDANCE_RULES.AUTO_CHECKOUT}:00 PM. System will automatically check you out.`
    };
  }
  
  return { allowed: true };
}

// Function to perform automatic checkout at 5 PM
async function performAutomaticCheckout(employeeId: number, checkoutTime: Date) {
  const todayDate = new Date(checkoutTime.toISOString().split('T')[0]);
  
  const existingAttendance = await db.attendance.findFirst({
    where: {
      employee_id: employeeId,
      date: todayDate,
      check_in_time: { not: null },
      check_out_time: null // Only for those not checked out
    }
  });

  if (existingAttendance) {
    // Handle existing sessions safely
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
        console.error('Error parsing existing sessions for auto-checkout:', parseError);
        existingSessions = [];
      }
    }

    // Create automatic checkout session
    const autoCheckoutSession: AttendanceSession = {
      check_out_time: checkoutTime.toISOString(),
      type: 'work_auto_checkout',
      auto_checkout: true,
      ip_address: 'system',
      user_agent: 'Auto Checkout System'
    };

    const updatedSessions = [...existingSessions, autoCheckoutSession];
    const sessionsJson = JSON.parse(JSON.stringify(updatedSessions));

    await db.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        check_out_time: checkoutTime,
        sessions: sessionsJson
      }
    });

    console.log(`Automatic checkout performed for employee ${employeeId} at ${checkoutTime.toISOString()}`);
    return true;
  }

  return false;
}

// FIXED: handleWorkAttendance function with business rules
async function handleWorkAttendance(
  employeeId: number,
  type: 'work_checkin' | 'work_checkout',
  currentTime: Date,
  currentDate: Date,
  location: any,
  clientIP: string,
  userAgent: string
) {
  if (type === 'work_checkin') {
    // Validate check-in time
    const timeValidation = validateCheckInTime(currentTime);
    
    if (!timeValidation.allowed) {
      throw new Error(timeValidation.error || 'Check-in not allowed at this time');
    }

    const existingAttendance = await db.attendance.findFirst({
      where: {
        employee_id: employeeId,
        date: currentDate
      }
    });

    if (existingAttendance?.check_in_time) {
      throw new Error('You have already checked in for work today');
    }

    // Create new session object
    const newSession: AttendanceSession = {
      check_in_time: currentTime.toISOString(),
      type: 'work',
      location,
      ip_address: clientIP,
      user_agent: userAgent
    };

    // Determine status based on time
    const status = timeValidation.isLate ? 'Late' : 'Present';

    const attendanceData = {
      employee_id: employeeId,
      date: currentDate,
      check_in_time: currentTime,
      sessions: JSON.parse(JSON.stringify([newSession])),
      status: status
    };

    if (existingAttendance) {
      await db.attendance.update({
        where: { id: existingAttendance.id },
        data: attendanceData
      });
    } else {
      await db.attendance.create({
        data: attendanceData
      });
    }

    return { 
      check_in_time: currentTime,
      status: status,
      message: timeValidation.isLate 
        ? `Checked in late at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        : `Checked in on time at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    };

  } else { // work_checkout
    // Validate checkout time
    const timeValidation = validateCheckOutTime(currentTime);
    
    if (!timeValidation.allowed) {
      if (timeValidation.isAutoCheckout) {
        // Perform automatic checkout
        const autoCheckoutPerformed = await performAutomaticCheckout(employeeId, currentTime);
        if (autoCheckoutPerformed) {
          return {
            check_out_time: currentTime,
            message: 'Automatic checkout performed at 5:00 PM',
            auto_checkout: true
          };
        }
      }
      throw new Error(timeValidation.error || 'Check-out not allowed at this time');
    }

    const existingAttendance = await db.attendance.findFirst({
      where: {
        employee_id: employeeId,
        date: currentDate
      }
    });

    if (!existingAttendance?.check_in_time) {
      throw new Error('You must check in before checking out');
    }

    if (existingAttendance.check_out_time) {
      throw new Error('You have already checked out for work today');
    }

    // Handle existing sessions safely
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

    // Create checkout session
    const checkoutSession: AttendanceSession = {
      check_out_time: currentTime.toISOString(),
      type: 'work',
      location,
      ip_address: clientIP,
      user_agent: userAgent
    };

    const updatedSessions = [...existingSessions, checkoutSession];
    const sessionsJson = JSON.parse(JSON.stringify(updatedSessions));

    await db.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        check_out_time: currentTime,
        sessions: sessionsJson
      }
    });

    return { 
      check_out_time: currentTime,
      total_sessions: updatedSessions.length,
      message: `Checked out at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    };
  }
}

// Class attendance handler
async function handleClassAttendance(
  trainerId: number,
  classId: number,
  type: 'class_checkin' | 'class_checkout',
  currentTime: Date,
  currentDate: Date,
  location: any,
  clientIP: string,
  userAgent: string
) {
  // Verify trainer is assigned to this class
  const assignment = await db.trainerClassAssignments.findFirst({
    where: {
      trainer_id: trainerId,
      class_id: classId,
      is_active: true
    }
  });

  if (!assignment) {
    throw new Error('You are not assigned to this class');
  }

  // Check if trainer is checked in to work first
  const todayWorkAttendance = await db.attendance.findFirst({
    where: {
      employee_id: trainerId,
      date: currentDate,
      check_in_time: { not: null }
    }
  });

  if (!todayWorkAttendance) {
    throw new Error('You must check in to work before checking in to a class');
  }

  const existingClassAttendance = await db.classAttendance.findFirst({
    where: {
      trainer_id: trainerId,
      class_id: classId,
      date: currentDate
    }
  });

  if (type === 'class_checkin') {
    if (existingClassAttendance?.check_in_time) {
      throw new Error('You have already checked in to this class today');
    }

    const classAttendanceData = {
      trainer_id: trainerId,
      class_id: classId,
      date: currentDate,
      check_in_time: currentTime,
      status: 'Present',
      auto_checkout: false
    };

    if (existingClassAttendance) {
      await db.classAttendance.update({
        where: { id: existingClassAttendance.id },
        data: classAttendanceData
      });
    } else {
      await db.classAttendance.create({
        data: classAttendanceData
      });
    }

    return { 
      class_check_in_time: currentTime,
      message: `Checked in to class at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    };

  } else { // class_checkout
    if (!existingClassAttendance?.check_in_time) {
      throw new Error('You must check in to the class before checking out');
    }

    if (existingClassAttendance.check_out_time) {
      throw new Error('You have already checked out of this class today');
    }

    await db.classAttendance.update({
      where: { id: existingClassAttendance.id },
      data: {
        check_out_time: currentTime
      }
    });

    return { 
      class_check_out_time: currentTime,
      message: `Checked out from class at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    };
  }
}

// POST endpoint
export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Mobile App';
  
  try {
    // Verify JWT token
    const authResult = await verifyMobileJWT(request);
    if (!authResult.success || !authResult.payload) {
      return NextResponse.json(
        { 
          success: false,
          error: "Authentication required" 
        },
        { status: 401 }
      );
    }

    const { userId, employeeId } = authResult.payload;
    const body = await request.json();
    const validatedData = attendanceSchema.parse(body);

    const currentTime = new Date();
    
    // Check if it's after 5 PM and perform automatic checkout if needed
    if (currentTime.getHours() >= ATTENDANCE_RULES.AUTO_CHECKOUT) {
      console.log('Checking for automatic checkout...');
      await performAutomaticCheckout(employeeId || userId, currentTime);
    }

    // Verify location is within geofence
    const isWithinGeofence = verifyGeofence(
      validatedData.location.latitude,
      validatedData.location.longitude
    );
    
    if (!isWithinGeofence) {
      const distance = calculateDistance(
        validatedData.location.latitude,
        validatedData.location.longitude,
        GEOFENCE.latitude,
        GEOFENCE.longitude
      );
      
      return NextResponse.json({
        success: false,
        error: 'You must be within the school premises to record attendance',
        distance: Math.round(distance)
      }, { status: 400 });
    }

    // Verify biometric was used
    if (!validatedData.biometric_verified) {
      return NextResponse.json({
        success: false,
        error: 'Biometric verification is required for attendance'
      }, { status: 400 });
    }

    const currentDate = currentTime.toISOString().split('T')[0];
    const currentDateObj = new Date(currentDate);

    let result;
    
    if (validatedData.type === 'work_checkin' || validatedData.type === 'work_checkout') {
      result = await handleWorkAttendance(
        employeeId || userId,
        validatedData.type,
        currentTime,
        currentDateObj,
        validatedData.location,
        clientIP,
        userAgent
      );
    } else if (validatedData.type === 'class_checkin' || validatedData.type === 'class_checkout') {
      if (!validatedData.class_id) {
        return NextResponse.json({
          success: false,
          error: 'Class ID is required for class attendance'
        }, { status: 400 });
      }
      
      result = await handleClassAttendance(
        employeeId || userId,
        validatedData.class_id,
        validatedData.type,
        currentTime,
        currentDateObj,
        validatedData.location,
        clientIP,
        userAgent
      );
    }

    return NextResponse.json({
      success: true,
      message: result?.message || 'Attendance recorded successfully',
      data: {
        timestamp: currentTime,
        type: validatedData.type,
        location_verified: true,
        ...result
      }
    });

  } catch (error) {
    console.error('Mobile attendance error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: error.issues[0].message 
        },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false,
          error: error.message 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to record attendance" 
      },
      { status: 500 }
    );
  }
}

// GET endpoint for attendance status and history
export async function GET(request: Request) {
  try {
    const authResult = await verifyMobileJWT(request);
    if (!authResult.success || !authResult.payload) {
      return NextResponse.json(
        { 
          success: false,
          error: "Authentication required" 
        },
        { status: 401 }
      );
    }

    const { employeeId, userId } = authResult.payload;
    const currentDate = new Date().toISOString().split('T')[0];
    const currentDateObj = new Date(currentDate);

    // Get today's work attendance
    const todayAttendance = await db.attendance.findFirst({
      where: {
        employee_id: employeeId || userId,
        date: currentDateObj
      }
    });

    // Get last 7 days attendance history
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const attendanceHistory = await db.attendance.findMany({
      where: {
        employee_id: employeeId || userId,
        date: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Get today's class attendance
    const todayClassAttendance = await db.classAttendance.findMany({
      where: {
        trainer_id: employeeId || userId,
        date: currentDateObj
      },
      include: {
        class: {
          select: {
            name: true,
            code: true,
            duration_hours: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        today: {
          work_attendance: todayAttendance,
          class_attendance: todayClassAttendance,
          is_checked_in: !!todayAttendance?.check_in_time && !todayAttendance?.check_out_time
        },
        history: attendanceHistory,
        current_date: currentDate
      }
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to get attendance data" 
      },
      { status: 500 }
    );
  }
}

// Function to run automatic checkout (can be called from cron job)
export async function runAutomaticCheckout() {
  try {
    const fivePM = new Date();
    fivePM.setHours(17, 0, 0, 0); // Set to exactly 5:00 PM
    
    // Get all employees who are checked in but not checked out today
    const todayDate = new Date(fivePM.toISOString().split('T')[0]);
    
    const uncheckedOutEmployees = await db.attendance.findMany({
      where: {
        date: todayDate,
        check_in_time: { not: null },
        check_out_time: null
      }
    });

    console.log(`Found ${uncheckedOutEmployees.length} employees to auto-checkout`);

    for (const attendance of uncheckedOutEmployees) {
      await performAutomaticCheckout(attendance.employee_id, fivePM);
    }

    return {
      success: true,
      message: `Automatic checkout completed for ${uncheckedOutEmployees.length} employees`
    };
  } catch (error) {
    console.error('Error during automatic checkout:', error);
    return {
      success: false,
      error: 'Failed to perform automatic checkout'
    };
  }
}

// Helper functions
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

function getClientIP(request: Request): string {
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