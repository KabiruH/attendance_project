// app/api/admin/class-analytics/route.ts
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

    // Check if user has admin privileges
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Insufficient permissions');
    }

    return user;
  } catch (error) {
    throw new Error('Invalid authentication token or insufficient permissions');
  }
}

// GET - Get detailed class analytics
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('range') || 'week';
    
    // Get current time in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentDate = nowInKenya.toJSDate();
    
    // Calculate date range based on timeRange parameter
    let startDate = new Date();
    switch (timeRange) {
      case 'week':
        startDate.setDate(currentDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(currentDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(currentDate.getMonth() - 3);
        break;
      default:
        startDate.setDate(currentDate.getDate() - 7);
    }

    // Get all class attendance within the time range
    const classAttendanceHistory = await db.classAttendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: currentDate
        },
        check_out_time: {
          not: null // Only completed sessions
        }
      },
      include: {
        trainer: {
          select: {
            id: true,
            name: true
          }
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            department: true,
            duration_hours: true
          }
        }
      }
    });

    // Get all classes and assignments for metrics
    const allClasses = await db.classes.findMany({
      where: { is_active: true },
      select: { id: true, name: true, code: true, department: true }
    });

    const allAssignments = await db.trainerClassAssignments.findMany({
      where: { 
        is_active: true,
        class: { is_active: true }
      },
      include: {
        trainer: {
          select: { id: true, name: true }
        },
        class: {
          select: { id: true, name: true, code: true, department: true }
        }
      }
    });

    // Process class utilization data
    const classUtilizationMap = new Map();

    classAttendanceHistory.forEach(session => {
      const classId = session.class.id;
      const sessionHours = calculateSessionHours(session);

      if (!classUtilizationMap.has(classId)) {
        classUtilizationMap.set(classId, {
          className: session.class.name,
          classCode: session.class.code,
          department: session.class.department,
          totalSessions: 0,
          totalHours: 0,
          activeTrainers: new Set(),
          utilizationRate: 0
        });
      }

      const classData = classUtilizationMap.get(classId);
      classData.totalSessions += 1;
      classData.totalHours += sessionHours;
      classData.activeTrainers.add(session.trainer_id);
    });

    // Calculate utilization rates
    const classUtilization = Array.from(classUtilizationMap.values()).map(classData => {
      const totalAssignments = allAssignments.filter(a => a.class.name === classData.className).length;
      const utilizationRate = totalAssignments > 0 ? (classData.activeTrainers.size / totalAssignments) * 100 : 0;
      
      return {
        ...classData,
        activeTrainers: classData.activeTrainers.size,
        utilizationRate
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    // Process department data
    const departmentMap = new Map();
    classAttendanceHistory.forEach(session => {
      const dept = session.class.department;
      const sessionHours = calculateSessionHours(session);

      if (!departmentMap.has(dept)) {
        departmentMap.set(dept, {
          name: dept,
          classes: new Set(),
          hours: 0,
          trainers: new Set()
        });
      }

      const deptData = departmentMap.get(dept);
      deptData.classes.add(session.class.id);
      deptData.hours += sessionHours;
      deptData.trainers.add(session.trainer_id);
    });

    const departmentData = Array.from(departmentMap.values()).map(dept => ({
      name: dept.name,
      classes: dept.classes.size,
      hours: dept.hours,
      trainers: dept.trainers.size
    }));

    // Process weekly trend data
    const weeklyTrendMap = new Map();
    const weeksToShow = timeRange === 'quarter' ? 12 : timeRange === 'month' ? 4 : 7;
    
    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekKey = `Week ${weeksToShow - i}`;
      weeklyTrendMap.set(weekKey, {
        week: weekKey,
        sessions: 0,
        hours: 0,
        trainers: new Set()
      });
    }

    classAttendanceHistory.forEach(session => {
      const sessionDate = new Date(session.date);
      const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysDiff / 7);
      
      if (weekIndex < weeksToShow) {
        const weekKey = `Week ${weeksToShow - weekIndex}`;
        if (weeklyTrendMap.has(weekKey)) {
          const weekData = weeklyTrendMap.get(weekKey);
          weekData.sessions += 1;
          weekData.hours += calculateSessionHours(session);
          weekData.trainers.add(session.trainer_id);
        }
      }
    });

    const weeklyTrend = Array.from(weeklyTrendMap.values()).map(week => ({
      week: week.week,
      sessions: week.sessions,
      hours: week.hours,
      trainers: week.trainers.size
    }));

    // Calculate metrics
    const today = currentDate.toISOString().split('T')[0];
    const todaySessions = classAttendanceHistory.filter(session => 
      session.date.toISOString().split('T')[0] === today
    );

    const totalSessionsToday = todaySessions.length;
    const totalHoursToday = todaySessions.reduce((total, session) => 
      total + calculateSessionHours(session), 0
    );

    const activeTrainersToday = new Set(todaySessions.map(s => s.trainer_id)).size;
    const totalTrainers = new Set(allAssignments.map(a => a.trainer_id)).size;
    const averageClassUtilization = classUtilization.length > 0 
      ? classUtilization.reduce((sum, c) => sum + c.utilizationRate, 0) / classUtilization.length 
      : 0;

    const metrics = {
      totalClasses: allClasses.length,
      activeClasses: classUtilization.length,
      totalTrainers,
      activeTrainers: activeTrainersToday,
      totalSessionsToday,
      totalHoursToday,
      averageClassUtilization
    };

    return NextResponse.json({
      success: true,
      metrics,
      classUtilization,
      departmentData,
      weeklyTrend
    });

  } catch (error) {
    console.error('Error fetching class analytics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate session hours
function calculateSessionHours(session: any): number {
  if (!session.check_out_time) return 0;
  
  const checkIn = new Date(session.check_in_time);
  const checkOut = new Date(session.check_out_time);
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}