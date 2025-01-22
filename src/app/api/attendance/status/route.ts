// app/api/attendance/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db'; // Import your Prisma instance

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieStore =await cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'No token found' },
        { status: 401 }
      );
    }

    // Verify the token
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const userId = Number(payload.id); // Convert to number for Prisma
    const role = payload.role as string;
    const currentDate = new Date().toISOString().split('T')[0];

    if (role === 'admin') {
      // Admin query using Prisma
      const attendanceData = await db.attendance.findMany({
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)) // Last 7 days
          }
        },
        include: {
          Employees: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { employee_id: 'asc' }
        ]
      });

      return NextResponse.json({
        role: 'admin',
        attendanceData: attendanceData.map(record => ({
          ...record,
          employee_name: record.Employees.name
        }))
      });
    }

    // Employee queries using Prisma
    const [todayAttendance, monthlyAttendance] = await Promise.all([
      // Today's attendance
      db.attendance.findFirst({
        where: {
          employee_id: userId,
          date: {
            equals: new Date(currentDate)
          }
        }
      }),
      // Monthly attendance
      db.attendance.findMany({
        where: {
          employee_id: userId,
          date: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        },
        orderBy: {
          date: 'desc'
        }
      })
    ]);

    const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;

    return NextResponse.json({
      role: 'employee',
      isCheckedIn,
      attendanceData: monthlyAttendance
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch attendance status' },
      { status: 500 }
    );
  }
}