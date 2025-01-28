import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';
import { cookies } from 'next/headers';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
  name: string;
}

async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');

  if (!token) {
    throw new Error('No token found');
  }

  const { payload } = await jwtVerify(
    token.value,
    new TextEncoder().encode(process.env.JWT_SECRET)
  );

  return payload as unknown as JwtPayload;
}

// Helper function to handle auto-checkout
async function processAutoCheckout() {
  const currentTime = new Date();
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Only proceed if it's past 5 PM
  if (currentTime.getHours() >= 17) {
    // Find all attendance records for today without checkout
    const pendingCheckouts = await db.attendance.findMany({
      where: {
        date: new Date(currentDate),
        check_out_time: null,
        check_in_time: {
          not: null,
        },
      },
    });

    // Set checkout time to 5 PM
    const checkoutTime = new Date(currentDate);
    checkoutTime.setHours(17, 0, 0, 0);

    // Process all pending checkouts
    await Promise.all(
      pendingCheckouts.map(record =>
        db.attendance.update({
          where: {
            id: record.id,
          },
          data: {
            check_out_time: checkoutTime,
          },
        })
      )
    );

    return pendingCheckouts.length;
  }
  
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth();
    const userId = user.id;
    const role = user.role;
    const currentDate = new Date().toISOString().split('T')[0];

    // Process auto-checkout if needed
    await processAutoCheckout();

    if (role === 'admin') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const attendanceData = await db.attendance.findMany({
        where: {
          date: {
            gte: sevenDaysAgo,
          },
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

      return NextResponse.json({
        role: 'admin',
        attendanceData,
      });
    }

    // For employees - get today's attendance
    const todayAttendance = await db.attendance.findFirst({
      where: {
        employee_id: userId,
        date: new Date(currentDate),
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyData = await db.attendance.findMany({
      where: {
        employee_id: userId,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Check if still checked in, considering auto-checkout time
    const currentTime = new Date();
    const isCheckedIn = todayAttendance && 
                       !todayAttendance.check_out_time && 
                       currentTime.getHours() < 17;

    return NextResponse.json({
      role: 'employee',
      isCheckedIn,
      attendanceData: monthlyData,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    const employee_id = user.id;

    // Verify employee exists
    const employee = await db.employees.findUnique({
      where: { id: employee_id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;
    const currentTime = new Date();
    const currentDate = new Date().toISOString().split('T')[0];

    // Don't allow check-in/out operations after 5 PM
    if (currentTime.getHours() >= 17) {
      return NextResponse.json(
        { error: 'Operations not allowed after 5 PM' },
        { status: 400 }
      );
    }

    const existingAttendance = await db.attendance.findFirst({
      where: {
        employee_id,
        date: new Date(currentDate),
      },
    });

    if (action === 'check-in') {
      if (existingAttendance) {
        return NextResponse.json(
          { error: 'Already checked in today' },
          { status: 400 }
        );
      }

      const startTime = new Date();
      startTime.setHours(9, 0, 0, 0);
      const status = currentTime > startTime ? 'Late' : 'Present';

      const attendance = await db.attendance.create({
        data: {
          employee_id,
          date: new Date(currentDate),
          check_in_time: currentTime,
          status,
        },
      });

      return NextResponse.json({
        success: true,
        data: attendance,
      });
    }

    if (action === 'check-out') {
      if (!existingAttendance) {
        return NextResponse.json(
          { error: 'No check-in record found for today' },
          { status: 400 }
        );
      }

      if (existingAttendance.check_out_time) {
        return NextResponse.json(
          { error: 'Already checked out today' },
          { status: 400 }
        );
      }

      const attendance = await db.attendance.update({
        where: {
          id: existingAttendance.id,
        },
        data: {
          check_out_time: currentTime,
        },
      });

      return NextResponse.json({
        success: true,
        data: attendance,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Attendance error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}