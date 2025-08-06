// app/api/attendance/class-checkin/route.ts - Unified for web and mobile
import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db } from '@/lib/db/db';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Type definitions
type ClassAttendanceWithClass = any & {
  class?: {
    name: string;
    code?: string;
    duration_hours?: number;
  } | null;
};

// Mobile request validation schema
const mobileClassAttendanceSchema = z.object({
  type: z.enum(['class_checkin', 'class_checkout']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    timestamp: z.number(),
  }),
  biometric_verified: z.boolean(),
  class_id: z.number(),
});

// Geofence configuration
const GEOFENCE = {
  latitude: -1.22486,
  longitude: 36.70958,
  radius: 50, // meters
};

const CLASS_RULES = {
  CLASS_DURATION_HOURS: 2, // 2 hours - automatic class checkout after this duration
};

// Enhanced authentication supporting JWT, biometric, and mobile JWT
async function getAuthenticatedUser(req: NextRequest, body?: any): Promise<{ 
  id: number; 
  name: string; 
  role: string; 
  is_active: boolean;
  authMethod: 'jwt' | 'biometric' | 'mobile_jwt';
}> {
  // Try JWT first (web app)
  const token = req.cookies.get('token')?.value;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      const user = await db.users.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true, is_active: true }
      });

      if (user && user.is_active) {
        return { ...user, authMethod: 'jwt' };
      }
    } catch (error) {
      // JWT failed, continue to other methods
    }
  }

  // Try mobile JWT (mobile app)
  try {
    const mobileAuth = await verifyMobileJWT(req);
    if (mobileAuth.success && mobileAuth.payload) {
      const user = await db.users.findUnique({
        where: { id: mobileAuth.payload.employeeId || mobileAuth.payload.userId },
        select: { id: true, name: true, role: true, is_active: true }
      });

      if (user && user.is_active) {
        return { ...user, authMethod: 'mobile_jwt' };
      }
    }
  } catch (error) {
    // Mobile JWT failed, continue to biometric
  }

  // Try biometric authentication (web app)
  if (body?.username && body?.authenticationResponse) {
    const biometricUser = await verifyBiometricAuth(body.username, body.authenticationResponse, req);
    return {
      id: biometricUser.user_id,
      name: biometricUser.name,
      role: biometricUser.role,
      is_active: true,
      authMethod: 'biometric'
    };
  }

  throw new Error('No valid authentication method provided');
}

// Verify biometric authentication (unchanged from original)
async function verifyBiometricAuth(username: string, authenticationResponse: any, request: NextRequest) {
  const user = await db.users.findUnique({
    where: { id_number: username },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const challengeRecord = await db.webAuthnCredentialChallenge.findUnique({
    where: { userId: user.id },
  });

  if (!challengeRecord || new Date() > challengeRecord.expires) {
    throw new Error('Challenge not found or expired');
  }

  const credentialId = authenticationResponse.id;
  const credential = await db.webAuthnCredentials.findFirst({
    where: { credentialId },
  });

  if (!credential || credential.userId !== user.id) {
    throw new Error('Credential not found or does not belong to user');
  }

  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  const expectedOrigin = isLocalhost
    ? 'http://localhost:3000'
    : (process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000');

  const expectedRPID = isLocalhost
    ? 'localhost'
    : (process.env.WEBAUTHN_RP_ID || 'localhost');

  const verification = await verifyAuthenticationResponse({
    response: authenticationResponse,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: false,
    credential: {
      id: credential.credentialId,
      publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
      counter: credential.counter,
    },
  });

  if (!verification.verified) {
    throw new Error('Biometric verification failed');
  }

  await db.webAuthnCredentials.update({
    where: { id: credential.id },
    data: { counter: verification.authenticationInfo.newCounter },
  });

  await db.webAuthnCredentialChallenge.delete({
    where: { userId: user.id },
  });

  const employee = await db.employees.findUnique({
    where: { employee_id: user.id },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  return {
    user_id: user.id,
    employee_id: employee.id,
    name: employee.name,
    email: employee.email,
    role: user.role
  };
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

// Enhanced class attendance functions
async function performAutomaticClassCheckout(trainerId: number, classId: number, checkoutTime: Date) {
  const todayDate = new Date(checkoutTime.toISOString().split('T')[0]);
  
  const existingClassAttendance = await db.classAttendance.findFirst({
    where: {
      trainer_id: trainerId,
      class_id: classId,
      date: todayDate,
      check_out_time: null
    }
  });

  if (existingClassAttendance) {
    await db.classAttendance.update({
      where: { id: existingClassAttendance.id },
      data: {
        check_out_time: checkoutTime,
        auto_checkout: true
      }
    });
    
    return true;
  }

  return false;
}

async function hasActiveClassSession(trainerId: number, currentDate: Date): Promise<{
  hasActive: boolean;
  activeClass?: {
    id: number;
    class_id: number;
    check_in_time: Date;
    class_name?: string;
  };
}> {
  const activeSession = await db.classAttendance.findFirst({
    where: {
      trainer_id: trainerId,
      date: currentDate,
      check_out_time: null
    },
    include: {
      class: {
        select: {
          name: true
        }
      }
    }
  }) as ClassAttendanceWithClass | null;

  if (activeSession) {
    return {
      hasActive: true,
      activeClass: {
        id: activeSession.id,
        class_id: activeSession.class_id,
        check_in_time: activeSession.check_in_time!,
        class_name: activeSession.class?.name
      }
    };
  }

  return { hasActive: false };
}

async function checkAndPerformClassAutoCheckout(trainerId: number, currentTime: Date) {
  const currentDate = new Date(currentTime.toISOString().split('T')[0]);
  
  const activeClassSessions = await db.classAttendance.findMany({
    where: {
      trainer_id: trainerId,
      date: currentDate,
      check_out_time: null
    }
  });

  for (const session of activeClassSessions) {
    if (session.check_in_time) {
      const timeDiff = currentTime.getTime() - session.check_in_time.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff >= CLASS_RULES.CLASS_DURATION_HOURS) {
        await performAutomaticClassCheckout(trainerId, session.class_id, currentTime);
      }
    }
  }
}

// GET /api/attendance/class-checkin - Enhanced to support both web and mobile
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentDate = nowInKenya.toJSDate().toISOString().split('T')[0];

    // Detect if this is a mobile request
    const userAgent = request.headers.get('user-agent') || '';
    const isMobileRequest = user.authMethod === 'mobile_jwt' || userAgent.includes('Mobile');

    if (isMobileRequest) {
      // Mobile response format
      const currentDateObj = new Date(currentDate);

      // Get today's class attendance
      const todayClassAttendance = await db.classAttendance.findMany({
        where: {
          trainer_id: user.id,
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
      }) as ClassAttendanceWithClass[];

      // Check for any active class session
      const activeClassSession = await hasActiveClassSession(user.id, currentDateObj);

      // Get last 7 days class attendance history
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const classHistory = await db.classAttendance.findMany({
        where: {
          trainer_id: user.id,
          date: {
            gte: sevenDaysAgo
          }
        },
        orderBy: {
          date: 'desc'
        },
        include: {
          class: {
            select: {
              name: true,
              code: true
            }
          }
        }
      }) as ClassAttendanceWithClass[];

      return NextResponse.json({
        success: true,
        data: {
          today: {
            class_attendance: todayClassAttendance,
            active_class_session: activeClassSession.hasActive ? activeClassSession.activeClass : null
          },
          history: classHistory,
          current_date: currentDate
        }
      });
    } else {
      // Web response format (original)
      const assignments = await db.trainerClassAssignments.findMany({
        where: {
          trainer_id: user.id,
          is_active: true
        },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
              department: true,
              duration_hours: true,
              is_active: true
            }
          }
        },
        orderBy: {
          class: {
            name: 'asc'
          }
        }
      });

      const activeAssignments = assignments.filter(assignment => assignment.class.is_active);

      const todayAttendance = await db.classAttendance.findMany({
        where: {
          trainer_id: user.id,
          date: new Date(currentDate)
        },
        select: {
          id: true,
          class_id: true,
          check_in_time: true,
          check_out_time: true,
          status: true,
          auto_checkout: true
        }
      });

      return NextResponse.json({
        success: true,
        assignments: activeAssignments,
        todayAttendance,
        userRole: user.role
      });
    }

  } catch (error) {
    console.error('Error fetching class data:', error);
    return NextResponse.json(
      { 
        success: false, 
        assignments: [], 
        todayAttendance: [], 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 200 }
    );
  }
}

// POST /api/attendance/class-checkin - Enhanced to handle both web and mobile
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  try {
    const body = await request.json();
    
    // Detect if this is a mobile request
    const isMobileRequest = body?.type?.startsWith('class_') || !!body?.location;
    
    const user = await getAuthenticatedUser(request, body);

    // Mobile request validation
    if (isMobileRequest) {
      try {
        mobileClassAttendanceSchema.parse(body);
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

    const { class_id, action, type } = body;
    
    // Normalize mobile/web request formats
    const normalizedAction = type === 'class_checkin' ? 'check-in' : 
                            type === 'class_checkout' ? 'check-out' : 
                            action;
    const trainer_id = user.id;

    if (!class_id) {
      return NextResponse.json(
        { success: false, error: 'class_id is required' },
        { status: 400 }
      );
    }

    // Get current time in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    // Check for any class auto-checkouts
    await checkAndPerformClassAutoCheckout(trainer_id, currentTime);

    // Verify class exists and is active
    const classInfo = await db.classes.findUnique({
      where: { id: class_id },
      select: { id: true, name: true, code: true, is_active: true, duration_hours: true }
    });

    if (!classInfo || !classInfo.is_active) {
      return NextResponse.json(
        { success: false, error: 'Class not found or inactive' },
        { status: 404 }
      );
    }

    // Check if trainer is assigned to this class
    const assignment = await db.trainerClassAssignments.findFirst({
      where: {
        trainer_id: trainer_id,
        class_id: class_id,
        is_active: true
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to this class' },
        { status: 403 }
      );
    }

    // Check if trainer has checked into work today
    const workAttendance = await db.attendance.findFirst({
      where: {
        employee_id: trainer_id,
        date: new Date(currentDate)
      }
    });

    if (!workAttendance) {
      return NextResponse.json(
        { success: false, error: 'You must check into work before checking into classes' },
        { status: 400 }
      );
    }

    // Check if trainer has an active work session
    const hasActiveWorkSession = () => {
      if (!workAttendance.sessions || !Array.isArray(workAttendance.sessions)) {
        return !!(workAttendance.check_in_time && !workAttendance.check_out_time);
      }
      return workAttendance.sessions.some((session: any) => 
        session.check_in && !session.check_out
      );
    };

    if (!hasActiveWorkSession()) {
      return NextResponse.json(
        { success: false, error: 'You must be checked into work to check into classes' },
        { status: 400 }
      );
    }

    const existingClassAttendance = await db.classAttendance.findFirst({
      where: {
        trainer_id: trainer_id,
        class_id: class_id,
        date: new Date(currentDate)
      }
    });

    if (normalizedAction === 'check-in') {
      // Handle check-in logic
      if (existingClassAttendance) {
        if (isMobileRequest) {
          // Mobile: Check if it was auto-checked out
          if (existingClassAttendance.check_out_time && existingClassAttendance.auto_checkout) {
            // Allow re-checkin if it was auto-checked out
            await db.classAttendance.update({
              where: { id: existingClassAttendance.id },
              data: {
                check_in_time: currentTime,
                check_out_time: null,
                auto_checkout: false,
                status: 'Present'
              }
            });
            
            return NextResponse.json({
              success: true,
              message: `Re-checked in to class at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (previous session was auto-closed)`,
              data: {
                timestamp: currentTime,
                type: body.type,
                class_id: class_id,
                location_verified: true,
                class_check_in_time: currentTime
              }
            });
          } else {
            return NextResponse.json(
              { success: false, error: 'You have already checked in to this class today' },
              { status: 400 }
            );
          }
        } else {
          // Web: Original logic
          return NextResponse.json(
            { success: false, error: 'Already checked into this class today' },
            { status: 400 }
          );
        }
      }

      // Check if user has any active class sessions
      const activeClassSessions = await db.classAttendance.findMany({
        where: {
          trainer_id: trainer_id,
          date: new Date(currentDate)
        },
        include: {
          class: {
            select: { name: true }
          }
        }
      });

      const currentActiveSession = activeClassSessions.find(session => {
        if (!session.check_out_time) return true;
        if (session.auto_checkout && new Date(session.check_out_time) > currentTime) {
          return true;
        }
        return false;
      });

      if (currentActiveSession) {
        return NextResponse.json(
          { success: false, error: `You are already checked into ${currentActiveSession.class.name}. Please check out first.` },
          { status: 400 }
        );
      }

      // Calculate auto-checkout time
      const maxClassDuration = Math.min(classInfo.duration_hours || 2, 2);
      const autoCheckoutTime = new Date(currentTime);
      autoCheckoutTime.setHours(autoCheckoutTime.getHours() + maxClassDuration);

      // Create class attendance record
      const classAttendance = await db.classAttendance.create({
        data: {
          trainer_id: trainer_id,
          class_id: class_id,
          date: new Date(currentDate),
          check_in_time: currentTime,
          check_out_time: isMobileRequest ? null : autoCheckoutTime,
          status: 'Present',
          auto_checkout: isMobileRequest ? false : true,
          work_attendance_id: workAttendance.id
        }
      });

      // Create appropriate response based on request type
      if (isMobileRequest) {
        return NextResponse.json({
          success: true,
          message: `Checked in to class at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          data: {
            timestamp: currentTime,
            type: body.type,
            class_id: class_id,
            location_verified: true,
            class_check_in_time: currentTime
          }
        });
      } else {
        return NextResponse.json({
          success: true,
          message: `Successfully checked into ${classInfo.name}`,
          className: classInfo.name,
          class_attendance: {
            id: classAttendance.id,
            class: {
              id: classInfo.id,
              name: classInfo.name,
              code: classInfo.code
            },
            check_in_time: currentTime.toISOString(),
            auto_checkout_time: autoCheckoutTime.toISOString(),
            duration_hours: maxClassDuration,
            max_duration_applied: maxClassDuration < (classInfo.duration_hours || 2)
          }
        });
      }

    } else if (normalizedAction === 'check-out') {
      // Handle check-out logic (mobile only)
      if (!existingClassAttendance?.check_in_time) {
        return NextResponse.json(
          { success: false, error: 'You must check in to the class before checking out' },
          { status: 400 }
        );
      }

      if (existingClassAttendance.check_out_time) {
        return NextResponse.json(
          { success: false, error: 'You have already checked out of this class today' },
          { status: 400 }
        );
      }

      // Calculate duration
      const timeDiff = currentTime.getTime() - existingClassAttendance.check_in_time.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      const hoursDiff = Math.floor(minutesDiff / 60);
      const remainingMinutes = minutesDiff % 60;

      await db.classAttendance.update({
        where: { id: existingClassAttendance.id },
        data: {
          check_out_time: currentTime,
          auto_checkout: false
        }
      });

      return NextResponse.json({
        success: true,
        message: `Checked out from class at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        data: {
          timestamp: currentTime,
          type: body.type,
          class_id: class_id,
          location_verified: true,
          class_check_out_time: currentTime,
          duration: `${hoursDiff}h ${remainingMinutes}m`
        }
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Class attendance error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to record class attendance" },
      { status: 500 }
    );
  }
}

// PATCH /api/attendance/class-checkin - Handle manual check-out (web only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await getAuthenticatedUser(request, body);
    const { attendance_id, action } = body;

    if (action !== 'check-out') {
      return NextResponse.json(
        { success: false, error: 'Invalid action for PATCH request' },
        { status: 400 }
      );
    }

    if (!attendance_id) {
      return NextResponse.json(
        { success: false, error: 'attendance_id is required' },
        { status: 400 }
      );
    }

    const attendance = await db.classAttendance.findFirst({
      where: {
        id: attendance_id,
        trainer_id: user.id
      },
      include: {
        class: true
      }
    });

    if (!attendance) {
      return NextResponse.json(
        { success: false, error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();

    const updatedAttendance = await db.classAttendance.update({
      where: { id: attendance_id },
      data: {
        check_out_time: currentTime,
        auto_checkout: false
      },
      include: {
        class: true
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully checked out of ${attendance.class.name}`,
      className: attendance.class.name,
      attendance: updatedAttendance
    });

  } catch (error) {
    console.error('Class check-out error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to check out of class' },
      { status: 500 }
    );
  }
}