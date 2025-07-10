import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
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
interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

const TIME_CONSTRAINTS = {
  CHECK_IN_START: 7,  // 7 AM
  WORK_START: 9,      // 9 AM
  WORK_END: 17        // 5 PM
};

async function verifyAuth(): Promise<JwtPayload> {
  const token = (await cookies()).get('token');
  if (!token) throw new Error('No token found');

  const { payload } = await jwtVerify(
    token.value,
    new TextEncoder().encode(process.env.JWT_SECRET)
  );

  return payload as unknown as JwtPayload;
}

// Helper function to safely parse sessions from Prisma Json field
function parseSessionsFromJson(sessionsJson: any): WorkSession[] {
  if (!sessionsJson) return [];

  try {
    // If it's already an array, return it
    if (Array.isArray(sessionsJson)) {
      return sessionsJson as WorkSession[];
    }

    // If it's a string, try to parse it
    if (typeof sessionsJson === 'string') {
      const parsed = JSON.parse(sessionsJson);
      return Array.isArray(parsed) ? parsed as WorkSession[] : [];
    }

    // For other types, return empty array
    return [];
  } catch (error) {
    console.error('Error parsing sessions JSON:', error);
    return [];
  }
}

async function getAdminData(sevenDaysAgo: Date) {
  return db.attendance.findMany({
    where: {
      date: { gte: sevenDaysAgo },
    },
    include: {
      Employees: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { date: 'desc' },
      { Employees: { name: 'asc' } },
    ],
  });
}

async function getEmployeeData(userId: number, thirtyDaysAgo: Date) {
  return db.attendance.findMany({
    where: {
      employee_id: userId,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: 'desc' },
  });
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
    // Get existing sessions using the safe parser
    const existingSessions: WorkSession[] = parseSessionsFromJson(existingAttendance.sessions);

    // Check if there's an active session (checked in but not checked out)
    const activeSession = existingSessions.find(session => session.check_in && !session.check_out);

    if (activeSession) {
      // Update the active session's check-in time
      activeSession.check_in = currentTime;

      const attendance = await db.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          sessions: existingSessions as unknown as Prisma.JsonArray,
          status, // Update status based on new check-in time
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
          check_out_time: null, // Clear checkout to show as checked in
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
      check_in_time: currentTime, // Keep for compatibility
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

  // Complete the active session
  activeSession.check_out = currentTime;

  const attendance = await db.attendance.update({
    where: { id: existingAttendance.id },
    data: {
      check_out_time: currentTime, // Update for compatibility
      sessions: existingSessions as unknown as Prisma.JsonArray,
    },
  });

  return { success: true, data: attendance };
}

// Helper function to check if user has active session
function hasActiveSession(attendance: any): boolean {
  if (!attendance) return false;

  // Check sessions array first (new method)
  if (attendance.sessions && Array.isArray(attendance.sessions)) {
    return attendance.sessions.some((session: WorkSession) =>
      session.check_in && !session.check_out
    );
  }

  // Fallback to old method for backward compatibility
  return !!(attendance.check_in_time && !attendance.check_out_time);
}

// Helper function to calculate total hours from sessions
function calculateTotalHoursFromSessions(sessions: WorkSession[]): number {
  if (!sessions || sessions.length === 0) return 0;

  let totalMinutes = 0;

  sessions.forEach(session => {
    if (session.check_in) {
      const checkIn = new Date(session.check_in);
      const checkOut = session.check_out ? new Date(session.check_out) : new Date();

      const diffInMs = checkOut.getTime() - checkIn.getTime();
      const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));

      totalMinutes += diffInMinutes;
    }
  });

  return totalMinutes / 60; // Convert to hours
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth();
    const currentDate = new Date().toISOString().split('T')[0];
    const autoProcessResult = await processAutomaticAttendance();

    if (user.role == 'admin') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const attendanceData = await getAdminData(sevenDaysAgo);

      return NextResponse.json({
        success: true,
        role: 'admin',
        attendanceData,
        autoProcessed: autoProcessResult
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyData = await getEmployeeData(user.id, thirtyDaysAgo);

    const todayAttendance = monthlyData.find(
      record => record.date.toISOString().split('T')[0] === currentDate
    );

    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();

    // 🎯 UPDATED: Use sessions-aware check instead of check_out_time
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
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    const employee = await db.employees.findUnique({
      where: { id: user.id },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const { action } = await request.json();
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    const handler = action === 'check-in' ? handleCheckIn :
      action === 'check-out' ? handleCheckOut :
        null;

    if (!handler) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const result = await handler(user.id, currentTime, currentDate);
    return NextResponse.json(
      result,
      { status: result.success ? 200 : 400 }
    );

  } catch (error) {
    console.error('Attendance error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}