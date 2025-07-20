// app/api/admin/class-overview/route.ts
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

// GET - Get organization-wide class overview
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    
    // Get current time in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentDate = nowInKenya.toJSDate().toISOString().split('T')[0];
    const currentTime = nowInKenya.toJSDate();

    // Get all active class sessions (across all trainers)
    const activeClassSessions = await db.classAttendance.findMany({
      where: {
        date: new Date(currentDate)
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

    // Filter for currently active sessions
    const currentlyActiveSessions = activeClassSessions.filter(session => {
      if (!session.check_out_time) return true; // No checkout time = active
      
      // If auto-checkout time hasn't passed yet, consider it active
      if (session.auto_checkout && new Date(session.check_out_time) > currentTime) {
        return true;
      }
      
      return false;
    });

    // Format active sessions for frontend
    const formattedActiveSessions = currentlyActiveSessions.map(session => ({
      id: session.id,
      trainer_id: session.trainer_id,
      trainer_name: session.trainer.name,
      class_id: session.class_id,
      class_name: session.class.name,
      class_code: session.class.code,
      department: session.class.department,
      check_in_time: session.check_in_time.toISOString(),
      check_out_time: session.check_out_time?.toISOString(),
      auto_checkout: session.auto_checkout,
      duration_hours: session.class.duration_hours
    }));

    // Calculate today's class metrics
    const todayClassSessions = activeClassSessions.filter(session => session.check_out_time);
    
    let totalClassHoursToday = 0;
    todayClassSessions.forEach(session => {
      if (session.check_out_time) {
        const checkIn = new Date(session.check_in_time);
        const checkOut = new Date(session.check_out_time);
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        totalClassHoursToday += Math.max(0, hours);
      }
    });

    // Get total classes and active assignments for utilization
    const totalActiveClasses = await db.classes.count({
      where: { is_active: true }
    });

    const totalActiveAssignments = await db.trainerClassAssignments.count({
      where: { 
        is_active: true,
        class: { is_active: true }
      }
    });

    const classUtilizationRate = totalActiveAssignments > 0 
      ? (currentlyActiveSessions.length / totalActiveAssignments) * 100 
      : 0;

    const averageSessionLength = todayClassSessions.length > 0 
      ? totalClassHoursToday / todayClassSessions.length 
      : 0;

    const metrics = {
      totalActiveClasses: currentlyActiveSessions.length,
      totalTrainersInClass: new Set(currentlyActiveSessions.map(s => s.trainer_id)).size,
      totalClassHoursToday,
      averageSessionLength,
      classUtilizationRate
    };

    // Get trainer performance data for the selected time range
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const trainerClassHistory = await db.classAttendance.findMany({
      where: {
        date: {
          gte: weekAgo
        },
        check_out_time: {
          not: null
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
            name: true
          }
        }
      }
    });

    // Process trainer performance
    const trainerPerformanceMap = new Map();

    trainerClassHistory.forEach(session => {
      const trainerId = session.trainer_id;
      const trainerName = session.trainer.name;
      
      if (!trainerPerformanceMap.has(trainerId)) {
        trainerPerformanceMap.set(trainerId, {
          trainer_id: trainerId,
          trainer_name: trainerName,
          total_sessions: 0,
          total_hours: 0,
          classes_taught: new Set(),
          last_session: null,
          status: 'inactive'
        });
      }

      const trainerData = trainerPerformanceMap.get(trainerId);
      trainerData.total_sessions += 1;
      
      // Calculate session hours
      if (session.check_out_time) {
        const checkIn = new Date(session.check_in_time);
        const checkOut = new Date(session.check_out_time);
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        trainerData.total_hours += Math.max(0, hours);
      }
      
      trainerData.classes_taught.add(session.class.name);
      
      // Update last session
      const sessionDate = session.date.toISOString();
      if (!trainerData.last_session || sessionDate > trainerData.last_session) {
        trainerData.last_session = sessionDate;
      }
    });

    // Check which trainers are currently active
    currentlyActiveSessions.forEach(session => {
      if (trainerPerformanceMap.has(session.trainer_id)) {
        trainerPerformanceMap.get(session.trainer_id).status = 'active';
      }
    });

    // Convert performance data to array and format
    const trainerPerformance = Array.from(trainerPerformanceMap.values())
      .map(trainer => ({
        ...trainer,
        classes_taught: Array.from(trainer.classes_taught),
      }))
      .sort((a, b) => b.total_hours - a.total_hours); // Sort by total hours

    return NextResponse.json({
      success: true,
      activeClassSessions: formattedActiveSessions,
      metrics,
      trainerPerformance
    });

  } catch (error) {
    console.error('Error fetching admin class overview:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
