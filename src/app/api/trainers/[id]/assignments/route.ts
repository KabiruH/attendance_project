// app/api/trainers/[id]/assignments/route.ts
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

// Resolve employeeId from userId
async function resolveEmployeeId(userId: number): Promise<number | null> {
  const employee = await db.employees.findFirst({
    where: { employee_id: userId },
    select: { id: true }
  });
  return employee ? employee.id : null;
}

// GET /api/trainers/[id]/assignments - Fetch trainer's current class assignments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const trainerUserId = parseInt(resolvedParams.id);

    if (isNaN(trainerUserId)) {
      return NextResponse.json({ error: 'Invalid trainer ID' }, { status: 400 });
    }

    // Check authorization
    if (user.role !== 'admin' && user.id !== trainerUserId) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only view your own assignments.' },
        { status: 403 }
      );
    }

    // 🔑 Resolve employee.id for this trainer
    const trainerEmployeeId = await resolveEmployeeId(trainerUserId);
    if (!trainerEmployeeId) {
      return NextResponse.json({ error: 'No matching employee found' }, { status: 404 });
    }

    // Fetch active assignments using employee.id
    const assignments = await db.trainerClassAssignments.findMany({
      where: { trainer_id: trainerEmployeeId, is_active: true },
      select: { id: true, class_id: true, assigned_at: true }
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching trainer assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

// POST /api/trainers/[id]/assignments - Save/update trainer's class assignments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const trainerUserId = parseInt(resolvedParams.id);

    if (isNaN(trainerUserId)) {
      return NextResponse.json({ error: 'Invalid trainer ID' }, { status: 400 });
    }

    // Check authorization
    if (user.role !== 'admin' && user.id !== trainerUserId) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only update your own assignments.' },
        { status: 403 }
      );
    }

    // 🔑 Resolve employee.id for this trainer
    const trainerEmployeeId = await resolveEmployeeId(trainerUserId);
    if (!trainerEmployeeId) {
      return NextResponse.json({ error: 'No matching employee found' }, { status: 404 });
    }

    const body = await request.json();
    const { class_ids } = body;

    if (!Array.isArray(class_ids)) {
      return NextResponse.json({ error: 'class_ids must be an array' }, { status: 400 });
    }

    // Ensure all class_ids are numbers
    const numericClassIds = class_ids.map(id => {
      const numId = Number(id);
      if (isNaN(numId)) throw new Error(`Invalid class ID: ${id}`);
      return numId;
    });

    // Verify trainer exists as a user
    const trainerUser = await db.users.findUnique({ where: { id: trainerUserId } });
    if (!trainerUser || !trainerUser.is_active) {
      return NextResponse.json({ error: 'Trainer not found or inactive' }, { status: 404 });
    }

    if (trainerUser.role !== 'employee' && trainerUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only employees can be assigned to classes' },
        { status: 400 }
      );
    }

    // Verify all class IDs exist and are active
    if (numericClassIds.length > 0) {
      const validClasses = await db.classes.findMany({
        where: { id: { in: numericClassIds }, is_active: true },
        select: { id: true, name: true, code: true }
      });

      if (validClasses.length !== numericClassIds.length) {
        const foundIds = validClasses.map(c => c.id);
        const invalidIds = numericClassIds.filter(id => !foundIds.includes(id));
        return NextResponse.json(
          { error: `Some classes not found or inactive. Invalid IDs: ${invalidIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Use transaction
    const result = await db.$transaction(async (tx) => {
      // Deactivate current assignments
      const deactivatedResult = await tx.trainerClassAssignments.updateMany({
        where: { trainer_id: trainerEmployeeId, is_active: true },
        data: { is_active: false }
      });

      let createdCount = 0;

      // Reactivate or create new
      if (numericClassIds.length > 0) {
        const existingAssignments = await tx.trainerClassAssignments.findMany({
          where: { trainer_id: trainerEmployeeId, class_id: { in: numericClassIds } }
        });

        const existingClassIds = existingAssignments.map(a => a.class_id);
        const newClassIds = numericClassIds.filter(id => !existingClassIds.includes(id));

        // Reactivate existing
        if (existingAssignments.length > 0) {
          await Promise.all(
            existingAssignments.map(a =>
              tx.trainerClassAssignments.update({
                where: { id: a.id },
                data: { is_active: true, assigned_by: user.name, assigned_at: new Date() }
              })
            )
          );
          createdCount += existingAssignments.length;
        }

        // Create new
        if (newClassIds.length > 0) {
          const createResult = await tx.trainerClassAssignments.createMany({
            data: newClassIds.map(classId => ({
              trainer_id: trainerEmployeeId,
              class_id: classId,
              assigned_by: user.name,
              is_active: true
            }))
          });
          createdCount += createResult.count;
        }
      }

      return { deactivated: deactivatedResult.count, created: createdCount, assigned_classes: numericClassIds.length };
    });

    return NextResponse.json({
      message: `Successfully updated assignments. ${result.assigned_classes} classes assigned.`,
      ...result
    });
  } catch (error) {
    console.error('Error updating trainer assignments:', error);
    return NextResponse.json(
      { error: 'Failed to update assignments', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
