// app/api/trainers/[id]/my-classes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

// Helper function to verify authentication
async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
   
    if (!token) {
      return { error: 'No token found', status: 401 };
    }

    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const userId = Number(payload.id);
    const role = payload.role as string;
    const name = payload.name as string;

    // Verify user is still active
    const user = await db.users.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, department: true, is_active: true }
    });

    if (!user || !user.is_active) {
      return { error: 'User not found or inactive', status: 401 };
    }

    return { user: { ...user, id: userId, role, name } };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}

// GET /api/trainers/[id]/my-classes - Fetch trainer's assigned classes with attendance info
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    if (!authResult.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const { user } = authResult;
    const params = await context.params;
    const trainerId = parseInt(params.id);

    if (isNaN(trainerId)) {
      return NextResponse.json(
        { error: 'Invalid trainer ID' },
        { status: 400 }
      );
    }

    // Check authorization - users can only view their own classes unless they're admin
    if (user.role !== 'admin' && user.id !== trainerId) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only view your own classes.' },
        { status: 403 }
      );
    }

    // Fetch trainer's active class assignments with class details and attendance info
    const assignments = await db.trainerClassAssignments.findMany({
      where: {
        trainer_id: trainerId,
        is_active: true,
        class: {
          is_active: true // Only show assignments to active classes
        }
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            department: true,
            duration_hours: true
          }
        }
      },
      orderBy: {
        assigned_at: 'desc'
      }
    });

    // For each assignment, get the latest attendance and total sessions
    const assignmentsWithAttendance = await Promise.all(
      assignments.map(async (assignment) => {
        // Get the most recent attendance for this class
        const lastAttendance = await db.classAttendance.findFirst({
          where: {
            trainer_id: trainerId,
            class_id: assignment.class_id
          },
          orderBy: {
            check_in_time: 'desc'
          },
          select: {
            date: true,
            check_in_time: true,
            check_out_time: true,
            status: true
          }
        });

        // Get total number of sessions for this class
        const totalSessions = await db.classAttendance.count({
          where: {
            trainer_id: trainerId,
            class_id: assignment.class_id,
            status: 'Present'
          }
        });

        return {
          id: assignment.id,
          class_id: assignment.class_id,
          assigned_at: assignment.assigned_at,
          class: assignment.class,
          lastAttendance: lastAttendance ? {
            date: lastAttendance.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
            check_in_time: lastAttendance.check_in_time.toISOString(),
            check_out_time: lastAttendance.check_out_time?.toISOString() || null,
            status: lastAttendance.status
          } : null,
          totalSessions
        };
      })
    );

    return NextResponse.json(assignmentsWithAttendance);

  } catch (error) {
    console.error('Error fetching trainer classes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assigned classes' },
      { status: 500 }
    );
  }
}