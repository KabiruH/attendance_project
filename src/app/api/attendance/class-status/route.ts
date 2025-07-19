// app/api/attendance/class-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { db } from '@/lib/db/db';
import jwt from 'jsonwebtoken';

// Helper function to verify JWT and get user
async function getAuthenticatedUser(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  
  if (!token) {
    throw new Error('No authentication token found');
  }

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
    throw new Error('Invalid authentication token');
  }
}

// Helper function to calculate total hours from attendance records
function calculateTotalHours(attendanceRecords: any[]): string {
  let totalMinutes = 0;

  attendanceRecords.forEach(record => {
    if (record.check_in_time && record.check_out_time) {
      const checkIn = new Date(record.check_in_time);
      const checkOut = new Date(record.check_out_time);
      const diffMs = checkOut.getTime() - checkIn.getTime();
      totalMinutes += Math.max(0, diffMs / (1000 * 60));
    }
  });

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  
  if (hours === 0 && minutes === 0) return '0';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// GET - Get class attendance status and statistics
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    
    // Get current date info in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentDate = nowInKenya.toJSDate().toISOString().split('T')[0];
    const startOfMonth = new Date(nowInKenya.year, nowInKenya.month - 1, 1);
    const endOfMonth = new Date(nowInKenya.year, nowInKenya.month, 0);

    // Get today's class attendance
    const todayAttendance = await db.classAttendance.findMany({
      where: {
        trainer_id: user.id,
        date: new Date(currentDate)
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            department: true,
            duration_hours: true
          }
        }
      },
      orderBy: {
        check_in_time: 'asc'
      }
    });

    // Get class attendance history for the current month
    const monthlyAttendance = await db.classAttendance.findMany({
      where: {
        trainer_id: user.id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            department: true,
            duration_hours: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Get total number of active class assignments
    const activeClassAssignments = await db.trainerClassAssignments.count({
      where: {
        trainer_id: user.id,
        is_active: true,
        class: {
          is_active: true
        }
      }
    });

    // Calculate statistics
    const completedClassesThisMonth = monthlyAttendance.filter(
      record => record.check_out_time !== null
    );

    const totalHoursThisMonth = calculateTotalHours(completedClassesThisMonth);

    // Get currently active sessions (checked in but not yet auto-checked out)
    const now = nowInKenya.toJSDate();
    const activeClassSessions = todayAttendance.filter(attendance => {
      if (!attendance.check_out_time) return true;
      // If auto-checkout time hasn't passed yet, consider it active
      return new Date(attendance.check_out_time) > now && attendance.auto_checkout;
    });

    // Check if user can check into a new class (no active sessions)
    const canCheckIntoNewClass = activeClassSessions.length === 0;

    const stats = {
      totalClassesThisMonth: completedClassesThisMonth.length,
      hoursThisMonth: totalHoursThisMonth,
      activeClasses: activeClassAssignments,
      activeSessionsToday: activeClassSessions.length
    };

    return NextResponse.json({
      success: true,
      todayAttendance,
      attendanceHistory: monthlyAttendance,
      activeClassSessions,
      canCheckIntoNewClass,
      stats,
      userRole: user.role
    });

  } catch (error) {
    console.error('Error fetching class attendance status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}