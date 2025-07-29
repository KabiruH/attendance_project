// app/api/attendance/biometric-checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { db } from '@/lib/db/db';
import { processAutomaticAttendance } from '@/lib/utils/cronUtils';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

interface WorkSession {
  check_in: Date;
  check_out?: Date;
}

interface AttendanceResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

const TIME_CONSTRAINTS = {
  CHECK_IN_START: 7,  // 7 AM
  WORK_START: 9,      // 9 AM
  WORK_END: 17        // 5 PM
};

// Helper function to safely parse sessions from Prisma Json field
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

// Improved WebAuthn credential verification
async function verifyWebAuthnCredential(credentialId: string, signature: number[], authenticatorData: number[], clientDataJSON: number[], challengeId: string) {
  // Get the stored challenge
  const challengeData = global.quickCheckInChallenges?.get(challengeId);
  if (!challengeData) {
    throw new Error('Invalid or expired challenge');
  }

  // Check if challenge has expired
  if (Date.now() > challengeData.expires) {
    global.quickCheckInChallenges?.delete(challengeId);
    throw new Error('Challenge has expired');
  }

  // Find the credential in the database
  const credential = await db.webAuthnCredentials.findUnique({
    where: {
      credentialId: credentialId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          department: true,
          is_active: true
        }
      }
    }
  });

  if (!credential) {
    throw new Error('Credential not found');
  }

  if (!credential.user.is_active) {
    throw new Error('User account is inactive');
  }

  // Update credential counter for security
  await db.webAuthnCredentials.update({
    where: { id: credential.id },
    data: { 
      counter: credential.counter + 1,
      updated_at: new Date()
    }
  });

  // Clean up the challenge
  global.quickCheckInChallenges?.delete(challengeId);

  return credential.user;
}

// Determine current attendance status and next action
async function determineAttendanceAction(employee_id: number, currentDate: string) {
  const existingAttendance = await db.attendance.findFirst({
    where: { employee_id, date: new Date(currentDate) },
  });

  if (!existingAttendance) {
    return { action: 'check-in', hasActiveSession: false };
  }

  const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);
  const hasActiveSession = existingSessions.some(session => session.check_in && !session.check_out);

  return { 
    action: hasActiveSession ? 'check-out' : 'check-in',
    hasActiveSession,
    attendance: existingAttendance 
  };
}

// Handle work check-in
async function handleCheckIn(employee_id: number, currentTime: Date, currentDate: string): Promise<AttendanceResponse> {
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
    const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);
    const activeSession = existingSessions.find(session => session.check_in && !session.check_out);

    if (activeSession) {
      return { success: false, error: 'You are already checked in to work' };
    } else {
      // Start a new work session
      existingSessions.push({
        check_in: currentTime
      });

      const attendance = await db.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          sessions: existingSessions as unknown as Prisma.JsonArray,
          check_out_time: null,
          status,
        },
      });

      return {
        success: true,
        data: attendance,
        message: 'New work session started'
      };
    }
  }

  // Create new attendance record with first session
  const initialSessions: WorkSession[] = [{
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

  return { success: true, data: attendance };
}

// Handle work check-out
async function handleCheckOut(employee_id: number, currentTime: Date, currentDate: string): Promise<AttendanceResponse> {
  const existingAttendance = await db.attendance.findFirst({
    where: { employee_id, date: new Date(currentDate) },
  });

  if (!existingAttendance) {
    return { success: false, error: 'No check-in record found for today' };
  }

  const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);
  const activeSession = existingSessions.find(session => session.check_in && !session.check_out);

  if (!activeSession) {
    return { success: false, error: 'No active work session found' };
  }

  // Close the active session
  activeSession.check_out = currentTime;

  const attendance = await db.attendance.update({
    where: { id: existingAttendance.id },
    data: {
      sessions: existingSessions as unknown as Prisma.JsonArray,
      check_out_time: currentTime,
    },
  });

  return {
    success: true,
    data: attendance,
    message: 'Successfully checked out of work'
  };
}

// Get user's assigned classes and current class status
async function getUserClassOptions(employee_id: number, currentDate: string) {
  try {
    // Get assigned classes
    const assignments = await db.trainerClassAssignments.findMany({
      where: {
        trainer_id: employee_id,
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
      }
    });

    const activeClasses = assignments.filter(a => a.class.is_active);

    if (activeClasses.length === 0) {
      return { hasAssignedClasses: false, availableClasses: [], activeClassSessions: [] };
    }

    // Get today's class attendance
    const todayClassAttendance = await db.classAttendance.findMany({
      where: {
        trainer_id: employee_id,
        date: new Date(currentDate)
      },
      include: {
        class: {
          select: { name: true }
        }
      }
    });

    // Determine current active class sessions
    const now = new Date();
    const activeClassSessions = todayClassAttendance.filter(attendance => {
      if (!attendance.check_out_time) return true;
      if (attendance.auto_checkout && new Date(attendance.check_out_time) > now) {
        return true;
      }
      return false;
    });

    // Map available classes with their current status
    const availableClasses = activeClasses.map(assignment => {
      const todayRecord = todayClassAttendance.find(att => att.class_id === assignment.class.id);
      let currentStatus: 'available' | 'checked-in' | 'completed' = 'available';

      if (todayRecord) {
        if (activeClassSessions.find(active => active.class_id === assignment.class.id)) {
          currentStatus = 'checked-in';
        } else {
          currentStatus = 'completed';
        }
      }

      return {
        id: assignment.class.id,
        name: assignment.class.name,
        code: assignment.class.code,
        description: assignment.class.description,
        department: assignment.class.department,
        duration_hours: assignment.class.duration_hours,
        canCheckIn: currentStatus === 'available',
        currentStatus
      };
    });

    return {
      hasAssignedClasses: true,
      availableClasses,
      activeClassSessions: activeClassSessions.map(session => ({
        id: session.id,
        className: session.class.name,
        checkInTime: session.check_in_time.toISOString(),
        duration: `${Math.floor((now.getTime() - session.check_in_time.getTime()) / (1000 * 60))} minutes`
      }))
    };
  } catch (error) {
    console.error('Error getting class options:', error);
    return { hasAssignedClasses: false, availableClasses: [], activeClassSessions: [] };
  }
}

// POST /api/attendance/biometric-checkin - Handle unified biometric check-in/out
export async function POST(request: NextRequest) {
  try {
    const { action, biometric_auth } = await request.json();

    if (!biometric_auth) {
      return NextResponse.json(
        { success: false, error: 'Biometric authentication required' },
        { status: 400 }
      );
    }

    // Verify WebAuthn credential
    const user = await verifyWebAuthnCredential(
      biometric_auth.credentialId,
      biometric_auth.response.signature,
      biometric_auth.response.authenticatorData,
      biometric_auth.response.clientDataJSON,
      biometric_auth.challengeId
    );

    // Process automatic attendance (cleanup old records)
    await processAutomaticAttendance();

    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    // Determine what action to take if not specified
    let workAction = action;
    if (!workAction) {
      const statusCheck = await determineAttendanceAction(user.id, currentDate);
      workAction = statusCheck.action;
    }

    // Handle work attendance
    let workResult: AttendanceResponse;
    if (workAction === 'check-in') {
      workResult = await handleCheckIn(user.id, currentTime, currentDate);
    } else {
      workResult = await handleCheckOut(user.id, currentTime, currentDate);
    }

    if (!workResult.success) {
      return NextResponse.json(workResult, { status: 400 });
    }

    // Get class options for trainers
    const classOptions = await getUserClassOptions(user.id, currentDate);

    // Calculate today's work hours
    let todayHours = '0h 0m';
    if (workResult.data?.sessions) {
      const sessions = parseSessionsFromJson(workResult.data.sessions);
      let totalMinutes = 0;
      
      sessions.forEach(session => {
        if (session.check_in) {
          const checkIn = new Date(session.check_in);
          const checkOut = session.check_out ? new Date(session.check_out) : currentTime;
          const diffMs = checkOut.getTime() - checkIn.getTime();
          totalMinutes += Math.max(0, diffMs / (1000 * 60));
        }
      });

      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      todayHours = `${hours}h ${minutes}m`;
    }

    // Return comprehensive response
    return NextResponse.json({
      success: true,
      employee: {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department
      },
      workAttendance: {
        action: workAction,
        currentStatus: workAction === 'check-in' ? 'checked-in' : 'checked-out',
        todayHours
      },
      classOptions,
      timestamp: currentTime.toISOString(),
      message: workResult.message || `Successfully ${workAction === 'check-in' ? 'checked in to' : 'checked out of'} work`
    });

  } catch (error) {
    console.error('Biometric check-in error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      },
      { status: 401 }
    );
  }
}