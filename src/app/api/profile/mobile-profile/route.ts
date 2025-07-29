// app/api/profile/mobile-profile/route.ts - FIXED to match your Prisma schema
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

    const { userId, employeeId } = authResult.payload;

    // Get user profile with employee details - FIXED: Use 'Employee' not 'employees'
    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        id_number: true,
        role: true,
        phone_number: true,
        department: true,
        gender: true,
        email: true,
        is_active: true,
        Employee: {  // FIXED: Capital E, singular - matches your schema
          select: {
            id: true,
            name: true,
            email: true,
            date_of_birth: true,
            employee_id: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          error: "User not found" 
        },
        { status: 404 }
      );
    }

    // Get biometric status (temporarily commented out until you add the biometric models)
    let biometricEnrollment = null;
    try {
      biometricEnrollment = await db.biometricEnrollments.findFirst({
        where: { 
          user_id: userId,
          is_active: true 
        },
        select: {
          enrolled_at: true,
          device_info: true
        }
      });
    } catch (biometricError) {
      // If biometric table doesn't exist yet, just continue
      console.log('Biometric table not available yet');
    }

    // Get recent attendance summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceSummary = await db.attendance.findMany({
      where: {
        employee_id: employeeId || userId,
        date: {
          gte: thirtyDaysAgo.toISOString().split('T')[0]
        }
      },
      select: {
        date: true,
        status: true,
        check_in_time: true,
        check_out_time: true
      },
      orderBy: {
        date: 'desc'
      },
      take: 30
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          id_number: user.id_number,
          role: user.role,
          phone_number: user.phone_number,
          department: user.department,
          gender: user.gender,
          email: user.email,
          is_active: user.is_active
        },
        employee: user.Employee || null, // FIXED: Use 'Employee' not 'employees[0]'
        biometric: {
          enrolled: !!biometricEnrollment,
          enrolled_at: biometricEnrollment?.enrolled_at,
          device_info: biometricEnrollment?.device_info
        },
        attendance_summary: {
          total_days: attendanceSummary.length,
          present_days: attendanceSummary.filter(a => a.status === 'Present').length,
          late_days: attendanceSummary.filter(a => a.status === 'Late').length,
          recent_attendance: attendanceSummary.slice(0, 7)
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to get user profile" 
      },
      { status: 500 }
    );
  }
}