// app/api/trainers/[id]/assignments/[classId]/route.ts
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

// DELETE /api/trainers/[id]/assignments/[classId] - Remove specific class assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; classId: string }> }
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
    const resolvedParams = await params;
    const trainerId = parseInt(resolvedParams.id);
    const classId = parseInt(resolvedParams.classId);

    if (isNaN(trainerId) || isNaN(classId)) {
      return NextResponse.json(
        { error: 'Invalid trainer ID or class ID' },
        { status: 400 }
      );
    }

    // Check authorization - users can only remove their own assignments unless they're admin
    if (user.role !== 'admin' && user.id !== trainerId) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only remove your own assignments.' },
        { status: 403 }
      );
    }

    // Find the specific assignment
    const assignment = await db.trainerClassAssignments.findFirst({
      where: {
        trainer_id: trainerId,
        class_id: classId,
        is_active: true
      },
      include: {
        class: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found or already removed' },
        { status: 404 }
      );
    }

    // Check if there are any attendance records for this class
    const attendanceCount = await db.classAttendance.count({
      where: {
        trainer_id: trainerId,
        class_id: classId
      }
    });

    // Soft delete the assignment (set is_active to false)
    await db.trainerClassAssignments.update({
      where: {
        id: assignment.id
      },
      data: {
        is_active: false
      }
    });

    // Optional: You might want to add logic here to handle:
    // 1. Ongoing class sessions
    // 2. Future scheduled classes
    // 3. Notifications to administrators

    return NextResponse.json({
      message: `Successfully removed assignment from class "${assignment.class.name}"`,
      removed_class: {
        id: classId,
        name: assignment.class.name,
        code: assignment.class.code
      },
      attendance_records_preserved: attendanceCount,
      note: attendanceCount > 0 ? 'Previous attendance records have been preserved for reporting purposes.' : null
    });

  } catch (error) {
    console.error('Error removing class assignment:', error);
    return NextResponse.json(
      { error: 'Failed to remove assignment' },
      { status: 500 }
    );
  }
}