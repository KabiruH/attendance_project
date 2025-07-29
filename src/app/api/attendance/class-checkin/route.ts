// app/api/attendance/class-checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db } from '@/lib/db/db';
import jwt from 'jsonwebtoken';

// Helper function to verify JWT and get user
async function getAuthenticatedUser(req: NextRequest, body?: any) {
  // Try JWT first
  const token = req.cookies.get('token')?.value;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      const user = await db.users.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true, is_active: true }
      });

      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      return user;
    } catch (error) {
      // JWT failed, try biometric if available
    }
  }

  // Try biometric authentication for class check-in
  if (body?.username && body?.authenticationResponse) {
    const biometricUser = await verifyBiometricAuth(body.username, body.authenticationResponse, req);
    return {
      id: biometricUser.user_id,
      name: biometricUser.name,
      role: biometricUser.role,
      is_active: true
    };
  }

  throw new Error('No valid authentication method provided');
}

// Verify biometric authentication (same as attendance route)
async function verifyBiometricAuth(username: string, authenticationResponse: any, request: NextRequest) {
  // Find the user
  const user = await db.users.findUnique({
    where: { id_number: username },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get the expected challenge
  const challengeRecord = await db.webAuthnCredentialChallenge.findUnique({
    where: { userId: user.id },
  });

  if (!challengeRecord || new Date() > challengeRecord.expires) {
    throw new Error('Challenge not found or expired');
  }

  // Get the credential being used
  const credentialId = authenticationResponse.id;
  const credential = await db.webAuthnCredentials.findFirst({
    where: { credentialId },
  });

  if (!credential || credential.userId !== user.id) {
    throw new Error('Credential not found or does not belong to user');
  }

  // Determine origin and RP ID based on environment
  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  const expectedOrigin = isLocalhost
    ? 'http://localhost:3000'
    : (process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000');

  const expectedRPID = isLocalhost
    ? 'localhost'
    : (process.env.WEBAUTHN_RP_ID || 'localhost');

  // Verify the authentication response
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

  // Update counter
  await db.webAuthnCredentials.update({
    where: { id: credential.id },
    data: { counter: verification.authenticationInfo.newCounter },
  });

  // Clean up the challenge
  await db.webAuthnCredentialChallenge.delete({
    where: { userId: user.id },
  });

  // Get employee info
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

// GET /api/attendance/class-checkin - Get assigned classes and today's attendance
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentDate = nowInKenya.toJSDate().toISOString().split('T')[0];

    // Get all active class assignments for this trainer
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

    // Filter only active classes
    const activeAssignments = assignments.filter(assignment => assignment.class.is_active);

    // Get today's class attendance for this trainer
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

  } catch (error) {
    console.error('Error fetching assigned classes:', error);
    return NextResponse.json(
      { 
        success: false, 
        assignments: [], 
        todayAttendance: [], 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 200 } // Return 200 so component doesn't error
    );
  }
}

// POST /api/attendance/class-checkin - Handle class check-in for trainers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await getAuthenticatedUser(request, body);
    const { class_id, action, username, authenticationResponse } = body;

    // Support both old format (class_id, trainer_id) and new format (class_id, action)
    const trainer_id = user.id;

    if (!class_id) {
      return NextResponse.json(
        { error: 'class_id is required' },
        { status: 400 }
      );
    }

    if (action && action !== 'check-in') {
      return NextResponse.json(
        { error: 'Invalid action for POST request' },
        { status: 400 }
      );
    }

    // Get current time in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    // Verify class exists and is active
    const classInfo = await db.classes.findUnique({
      where: { id: class_id },
      select: { id: true, name: true, code: true, is_active: true, duration_hours: true }
    });

    if (!classInfo || !classInfo.is_active) {
      return NextResponse.json(
        { error: 'Class not found or inactive' },
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
        { error: 'Trainer is not assigned to this class' },
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
        { error: 'You must check into work before checking into classes' },
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
        { error: 'You must be checked into work to check into classes' },
        { status: 400 }
      );
    }

    // Check if already checked into this class today
    const existingClassAttendance = await db.classAttendance.findFirst({
      where: {
        trainer_id: trainer_id,
        class_id: class_id,
        date: new Date(currentDate)
      }
    });

    if (existingClassAttendance) {
      return NextResponse.json(
        { error: 'Already checked into this class today' },
        { status: 400 }
      );
    }

    // Check if user has any active class sessions (cannot be in multiple classes at once)
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

    // Check for active sessions
    const currentActiveSession = activeClassSessions.find(session => {
      if (!session.check_out_time) return true; // No checkout time = active
      if (session.auto_checkout && new Date(session.check_out_time) > currentTime) {
        return true; // Auto-checkout time hasn't been reached yet
      }
      return false;
    });

    if (currentActiveSession) {
      return NextResponse.json(
        { error: `You are already checked into ${currentActiveSession.class.name}. Please check out first.` },
        { status: 400 }
      );
    }

    // Calculate auto-checkout time with 2-hour maximum limit
    const maxClassDuration = Math.min(classInfo.duration_hours, 2); // Cap at 2 hours
    const autoCheckoutTime = new Date(currentTime);
    autoCheckoutTime.setHours(autoCheckoutTime.getHours() + maxClassDuration);

    // Create class attendance record
    const classAttendance = await db.classAttendance.create({
      data: {
        trainer_id: trainer_id,
        class_id: class_id,
        date: new Date(currentDate),
        check_in_time: currentTime,
        check_out_time: autoCheckoutTime,
        status: 'Present',
        auto_checkout: true,
        work_attendance_id: workAttendance.id
      }
    });

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
        max_duration_applied: maxClassDuration < classInfo.duration_hours
      }
    });

  } catch (error) {
    console.error('Class check-in error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check into class' },
      { status: 500 }
    );
  }
}

// PATCH /api/attendance/class-checkin - Handle manual check-out (optional override of auto-checkout)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await getAuthenticatedUser(request, body);
    const { attendance_id, action } = body;

    if (action !== 'check-out') {
      return NextResponse.json(
        { error: 'Invalid action for PATCH request' },
        { status: 400 }
      );
    }

    if (!attendance_id) {
      return NextResponse.json(
        { error: 'attendance_id is required' },
        { status: 400 }
      );
    }

    // Find the attendance record
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
        { error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    // Get current time in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();

    // Update with manual checkout time (override auto-checkout)
    const updatedAttendance = await db.classAttendance.update({
      where: { id: attendance_id },
      data: {
        check_out_time: currentTime,
        auto_checkout: false // Mark as manual checkout
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
      { error: error instanceof Error ? error.message : 'Failed to check out of class' },
      { status: 500 }
    );
  }
}