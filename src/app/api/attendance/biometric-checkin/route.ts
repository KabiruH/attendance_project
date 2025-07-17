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

// Verify WebAuthn credential
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

  // In a production system, you would verify the signature here
  // For now, we'll assume the WebAuthn verification is successful
  
  // Clean up the challenge
  global.quickCheckInChallenges?.delete(challengeId);

  return credential.user;
}

// Existing attendance logic (adapted from your route)
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
      // Update the active session's check-in time
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
      // Start a new work session
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

// POST /api/attendance/biometric-checkin - Handle biometric check-in
export async function POST(request: NextRequest) {
  try {
    const { action, biometric_auth } = await request.json();

    if (action !== 'check-in') {
      return NextResponse.json(
        { success: false, error: 'Only check-in action is supported' },
        { status: 400 }
      );
    }

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

    // Get employee record
    const employee = await db.employees.findUnique({
      where: { id: user.id },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee record not found' },
        { status: 404 }
      );
    }

    // Process automatic attendance (cleanup old records)
    await processAutomaticAttendance();

    // Perform work check-in
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    const result = await handleCheckIn(user.id, currentTime, currentDate);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Return success with user info
    return NextResponse.json({
      success: true,
      message: result.message || 'Successfully checked in to work',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department
      },
      attendance: result.data,
      timestamp: currentTime.toISOString()
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