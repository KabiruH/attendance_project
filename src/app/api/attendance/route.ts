import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';
import { cookies } from 'next/headers';
import { processAutomaticAttendance } from '@/lib/utils/cronUtils';

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

  if (existingAttendance) {
    return { success: false, error: 'Already checked in today' };
  }

  const startTime = new Date(currentTime);
  startTime.setHours(TIME_CONSTRAINTS.WORK_START, 0, 0, 0);
  const status = currentTime > startTime ? 'Late' : 'Present';

  const attendance = await db.attendance.create({
    data: {
      employee_id,
      date: new Date(currentDate),
      check_in_time: currentTime,
      status,
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

  if (existingAttendance.check_out_time) {
    return { success: false, error: 'Already checked out today' };
  }

  const attendance = await db.attendance.update({
    where: { id: existingAttendance.id },
    data: { check_out_time: currentTime },
  });

  return { success: true, data: attendance };
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

    const currentTime = new Date();
    const isCheckedIn = todayAttendance && 
                       !todayAttendance.check_out_time && 
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
    const currentTime = new Date();
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