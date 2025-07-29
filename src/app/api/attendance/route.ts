// app/api/attendance/route.ts - Updated with biometric support
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { DateTime } from 'luxon'
import { db } from '@/lib/db/db';
import { cookies } from 'next/headers';
import { processAutomaticAttendance } from '@/lib/utils/cronUtils';
import { Prisma } from '@prisma/client';

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

const TIME_CONSTRAINTS = {
  CHECK_IN_START: 7,  // 7 AM
  WORK_START: 9,      // 9 AM
  WORK_END: 17        // 5 PM
};

// Try JWT authentication first, fallback to biometric
async function authenticateUser(request: NextRequest, body?: any): Promise<{ userId: number; authMethod: 'jwt' | 'biometric' }> {
  // Try JWT first
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
    // JWT failed, try biometric
  }

  // Try biometric authentication
  if (body?.username && body?.authenticationResponse) {
    const biometricUser = await verifyBiometricAuth(body.username, body.authenticationResponse, request);
    return { userId: biometricUser.employee_id, authMethod: 'biometric' };
  }

  throw new Error('No valid authentication method provided');
}

// Verify biometric authentication
async function verifyBiometricAuth(username: string, authenticationResponse: any, request: NextRequest) {
  // Find the user
  console.log('=== VERIFYING BIOMETRIC AUTH ===');
  console.log('Username:', username);
  console.log('Auth response ID:', authenticationResponse?.id?.substring(0, 10) + '...');
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

// Helper functions (same as before)
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

async function handleCheckOut(employee_id: number, currentTime: Date, currentDate: string): Promise<AttendanceResponse> {
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

// GET endpoint - requires JWT for status checking
export async function GET(request: NextRequest) {
  try {
    const token = (await cookies()).get('token');
    if (!token) {
      // Return unauthenticated state instead of error
      return NextResponse.json({
        success: true,
        role: 'unauthenticated',
        isCheckedIn: false,
        attendanceData: [],
      });
    }

    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    const user = payload as unknown as JwtPayload;

    const currentDate = new Date().toISOString().split('T')[0];
    const autoProcessResult = await processAutomaticAttendance();

    if (user.role == 'admin') {
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

// POST endpoint - supports both JWT and biometric authentication
export async function POST(request: NextRequest) {
   console.log('=== ATTENDANCE API CALLED ===');
  try {
    const body = await request.json();
     console.log('Attendance request body:', {
      action: body.action,
      username: body.username,
      hasAuthResponse: !!body.authenticationResponse,
      authResponseId: body.authenticationResponse?.id?.substring(0, 10) + '...'
    });
    const { action, username, authenticationResponse } = body;

    // Authenticate user (JWT or biometric)
    const { userId, authMethod } = await authenticateUser(request, body);

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

    const handler = action === 'check-in' ? handleCheckIn :
      action === 'check-out' ? handleCheckOut : null;

    if (!handler) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const result = await handler(userId, currentTime, currentDate);
    
    // Log the attendance action
    if (result.success && authMethod === 'biometric') {
      await db.loginLogs.create({
        data: {
          user_id: employee.employee_id, // This links to Users table
          employee_id: employee.id,
          email: employee.email,
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          status: 'success',
          login_method: 'biometric',
          failure_reason: null,
          attempted_at: new Date()
        }
      });
    }

    return NextResponse.json(
      {
        ...result,
        authMethod,
        user: {
          id: employee.id,
          name: employee.name,
          email: employee.email
        }
      },
      { status: result.success ? 200 : 400 }
    );

  } catch (error) {
    console.error('Attendance error:', error);
    
    // Log failed biometric attempt
    try {
      const body = await request.json();
      if (body.username) {
        const user = await db.users.findUnique({
          where: { id_number: body.username }
        });
        
        if (user) {
          await db.loginLogs.create({
            data: {
              user_id: user.id,
              employee_id: null,
              email: body.username,
              ip_address: request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 'unknown',
              user_agent: request.headers.get('user-agent') || 'unknown',
              status: 'failed',
              login_method: 'biometric',
              failure_reason: 'attendance_auth_failed',
              attempted_at: new Date()
            }
          });
        }
      }
    } catch (logError) {
      console.error('Error logging failed attempt:', logError);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 401 }
    );
  }
}