// app/api/attendance/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';
import { ensureCheckouts } from '@/lib/utils/cronUtils';

export async function GET(request: NextRequest) {
  try {
 // First ensure all checkouts are processed
    await ensureCheckouts();
   
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
   
    if (!token) {
      return NextResponse.json(
        { error: 'No token found' },
        { status: 401 }
      );
    }

    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const userId = Number(payload.id);
    const role = payload.role as string;
    const today = new Date().toISOString().split('T')[0];

    if (role == 'admin') {
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

      // Process personal attendance data and calculate statistics
      const processedPersonalAttendance = personalAttendance.map(record => ({
        ...record,
        employee_name: record.Employees.name,
        date: record.date.toISOString(),
        check_in_time: record.check_in_time?.toISOString() || null,
        check_out_time: record.check_out_time?.toISOString() || null
      }));

      // Calculate admin's personal attendance statistics
      const totalDays = personalAttendance.length;
      const presentDays = personalAttendance.filter(record => record.status?.toLowerCase() === 'present').length;
      const lateDays = personalAttendance.filter(record => record.status?.toLowerCase() === 'late').length;
      const absentDays = personalAttendance.filter(record => record.status?.toLowerCase() === 'absent').length;
      const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      return NextResponse.json({
        role: 'admin',
        isCheckedIn,
        personalAttendance: processedPersonalAttendance,
        stats: {
          totalDays,
          presentDays,
          lateDays,
          absentDays,
          attendanceRate
        },
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

    // Calculate employee's attendance statistics
    const totalDays = monthlyRecords.length;
    const presentDays = monthlyRecords.filter(record => record.status?.toLowerCase() === 'present').length;
    const lateDays = monthlyRecords.filter(record => record.status?.toLowerCase() === 'late').length;
    const absentDays = monthlyRecords.filter(record => record.status?.toLowerCase() === 'absent').length;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

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
      stats: {
        totalDays,
        presentDays,
        lateDays,
        absentDays,
        attendanceRate
      },
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