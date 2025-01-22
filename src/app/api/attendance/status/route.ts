// app/api/attendance/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

// app/api/attendance/status/route.ts
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
   
    if (!token) {
      return NextResponse.json(
        { error: 'No token found' },
        { status: 401 }
      );
    }
console.error(request)
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const userId = Number(payload.id);
    const role = payload.role as string;
    const today = new Date().toISOString().split('T')[0];

    if (role === 'admin') {
      const [personalAttendance, todayRecord, allAttendance] = await Promise.all([
        // Admin's personal monthly attendance
        db.attendance.findMany({
          where: {
            employee_id: userId,
            date: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
            }
          },
          include: {
            Employees: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        }),
        // Admin's today's attendance status
        db.attendance.findFirst({
          where: {
            employee_id: userId,
            date: {
              gte: new Date(today),
              lt: new Date(new Date(today).setDate(new Date(today).getDate() + 1))
            }
          }
        }),
        // All employees' attendance data
        db.attendance.findMany({
          where: {
            date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7))
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
        })
      ]);

      const isCheckedIn = !!(todayRecord?.check_in_time && !todayRecord?.check_out_time);

      // Process personal attendance data
      const processedPersonalAttendance = personalAttendance.map(record => ({
        ...record,
        employee_name: record.Employees.name,
        date: record.date.toISOString(),
        check_in_time: record.check_in_time?.toISOString() || null,
        check_out_time: record.check_out_time?.toISOString() || null
      }));

      return NextResponse.json({
        role: 'admin',
        isCheckedIn,
        personalAttendance: processedPersonalAttendance,
        attendanceData: allAttendance.map(record => ({
          ...record,
          employee_name: record.Employees.name,
          date: record.date.toISOString(),
          check_in_time: record.check_in_time?.toISOString() || null,
          check_out_time: record.check_out_time?.toISOString() || null
        }))
      });
    }

    // Employee queries
    const [todayRecord, monthlyRecords] = await Promise.all([
      // Today's attendance
      db.attendance.findFirst({
        where: {
          employee_id: userId,
          date: {
            gte: new Date(today),
            lt: new Date(new Date(today).setDate(new Date(today).getDate() + 1))
          }
        },
        include: {
          Employees: {
            select: {
              name: true
            }
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
        include: {
          Employees: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      })
    ]);

    const isCheckedIn = !!(todayRecord?.check_in_time && !todayRecord?.check_out_time);

    const processedMonthlyRecords = monthlyRecords.map(record => ({
      ...record,
      employee_name: record.Employees.name,
      date: record.date.toISOString(),
      check_in_time: record.check_in_time?.toISOString() || null,
      check_out_time: record.check_out_time?.toISOString() || null
    }));

    return NextResponse.json({
      role: 'employee',
      isCheckedIn,
      todayRecord: todayRecord ? {
        ...todayRecord,
        employee_name: todayRecord.Employees.name,
        date: todayRecord.date.toISOString(),
        check_in_time: todayRecord.check_in_time?.toISOString() || null,
        check_out_time: todayRecord.check_out_time?.toISOString() || null
      } : null,
      attendanceData: processedMonthlyRecords
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch attendance status' },
      { status: 500 }
    );
  }
}