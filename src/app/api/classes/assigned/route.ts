// app/api/classes/assigned/route.ts  
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';

export async function GET(request: Request) {
  try {
    // Verify JWT token
    const authResult = await verifyMobileJWT(request);
    if (!authResult.success || !authResult.payload) {
      return NextResponse.json(
        { 
          success: false,
          error: "Authentication required" 
        },
        { status: 401 }
      );
    }

    const { employeeId, userId } = authResult.payload;
const currentDate = new Date(new Date().toDateString()); // Keeps only date, drops time


    // Get assigned classes for the trainer
    const assignedClasses = await db.trainerClassAssignments.findMany({
      where: {
        trainer_id: employeeId || userId,
        is_active: true
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
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
        trainer_id: employeeId || userId,
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
        error: "Failed to get assigned classes" 
      },
      { status: 500 }
    );
  }
}