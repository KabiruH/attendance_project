// app/api/classes/assigned/route.ts  
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';
import jwt from 'jsonwebtoken';

// Unified authentication function (same as class-checkin route)
async function getAuthenticatedUser(req: NextRequest): Promise<{ 
  id: number; 
  name: string; 
  role: string; 
  is_active: boolean;
  authMethod: 'jwt' | 'mobile_jwt';
}> {
  // Try JWT first (web app)
  const token = req.cookies.get('token')?.value;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      const user = await db.users.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true, is_active: true }
      });

      if (user && user.is_active) {
        return { ...user, authMethod: 'jwt' };
      }
    } catch (error) {
      // JWT failed, continue to mobile JWT
    }
  }

  // Try mobile JWT (mobile app)
  try {
    const mobileAuth = await verifyMobileJWT(req);
    if (mobileAuth.success && mobileAuth.payload) {
      const user = await db.users.findUnique({
        where: { id: mobileAuth.payload.employeeId || mobileAuth.payload.userId },
        select: { id: true, name: true, role: true, is_active: true }
      });

      if (user && user.is_active) {
        return { ...user, authMethod: 'mobile_jwt' };
      }
    }
  } catch (error) {
    // Mobile JWT failed
  }

  throw new Error('No valid authentication method provided');
}

export async function GET(request: NextRequest) {
  try {
    // Use unified authentication
    const user = await getAuthenticatedUser(request);
    const trainerId = user.id;

    const currentDate = new Date(new Date().toDateString()); // Keeps only date, drops time

    // Get assigned classes for the trainer
    const assignedClasses = await db.trainerClassAssignments.findMany({
      where: {
        trainer_id: trainerId,
        is_active: true
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            term: true,  // Added term field
            description: true,
            department: true,
            duration_hours: true,
            is_active: true
          }
        }
      }
    });

    // Get today's class attendance for these classes
    const classIds = assignedClasses.map(assignment => assignment.class_id);
    const todayClassAttendance = await db.classAttendance.findMany({
      where: {
        trainer_id: trainerId,
        class_id: {
          in: classIds
        },
        date: currentDate
      }
    });

    // Create a map of class attendance for quick lookup
    const attendanceMap = new Map();
    todayClassAttendance.forEach(attendance => {
      attendanceMap.set(attendance.class_id, attendance);
    });

    // Combine class info with attendance status
    const classesWithStatus = assignedClasses.map(assignment => {
      const attendance = attendanceMap.get(assignment.class_id);
     
      return {
        id: assignment.class.id,
        name: assignment.class.name,
        code: assignment.class.code,
        term: assignment.class.term,  // Added term field
        description: assignment.class.description,
        department: assignment.class.department,
        duration_hours: assignment.class.duration_hours,
        is_active: assignment.class.is_active,
        assigned_at: assignment.assigned_at,
        attendance_status: {
          checked_in: !!attendance?.check_in_time,
          checked_out: !!attendance?.check_out_time,
          check_in_time: attendance?.check_in_time,
          check_out_time: attendance?.check_out_time,
          status: attendance?.status || 'Not Started'
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        classes: classesWithStatus,
        total_assigned: assignedClasses.length,
        date: currentDate
      }
    });
  } catch (error) {
    console.error('Get assigned classes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get assigned classes"
      },
      { status: error instanceof Error && error.message.includes('Authentication') ? 401 : 500 }
    );
  }
}