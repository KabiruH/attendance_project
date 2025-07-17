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
        const trainerId = parseInt(resolvedParams.id);

        if (isNaN(trainerId)) {
            return NextResponse.json(
                { error: 'Invalid trainer ID' },
                { status: 400 }
            );
        }

        // Check authorization - users can only view their own assignments unless they're admin
        if (user.role !== 'admin' && user.id !== trainerId) {
            return NextResponse.json(
                { error: 'Unauthorized. You can only view your own assignments.' },
                { status: 403 }
            );
        }

        // Fetch active assignments
        const assignments = await db.trainerClassAssignments.findMany({
            where: {
                trainer_id: trainerId,
                is_active: true
            },
            select: {
                id: true,
                class_id: true,
                assigned_at: true
            }
        });

        return NextResponse.json(assignments);

    } catch (error) {
        console.error('Error fetching trainer assignments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assignments' },
            { status: 500 }
        );
    }
}

// POST /api/trainers/[id]/assignments - Save/update trainer's class assignments
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let trainerId: number | null = null; // Declare with a default value
    let numericClassIds: number[] = [];  // Same for this
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

        if (isNaN(trainerId)) {
            return NextResponse.json(
                { error: 'Invalid trainer ID' },
                { status: 400 }
            );
        }

        // Check authorization - users can only update their own assignments unless they're admin
        if (user.role !== 'admin' && user.id !== trainerId) {
            return NextResponse.json(
                { error: 'Unauthorized. You can only update your own assignments.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { class_ids } = body;

        if (!Array.isArray(class_ids)) {
            return NextResponse.json(
                { error: 'class_ids must be an array' },
                { status: 400 }
            );
        }

        // Ensure all class_ids are numbers
        const numericClassIds = class_ids.map(id => {
            const numId = Number(id);
            if (isNaN(numId)) {
                throw new Error(`Invalid class ID: ${id} is not a number`);
            }
            return numId;
        });

        // Verify the trainer exists and is an employee
        const trainer = await db.users.findUnique({
            where: { id: trainerId }
        });

        if (!trainer || !trainer.is_active) {
            return NextResponse.json(
                { error: 'Trainer not found or inactive' },
                { status: 404 }
            );
        }

        if (trainer.role !== 'employee' && trainer.role !== 'admin') {
            return NextResponse.json(
                { error: 'Only employees can be assigned to classes' },
                { status: 400 }
            );
        }

        // Verify all class IDs exist and are active
        if (numericClassIds.length > 0) {
             const validClasses = await db.classes.findMany({
                where: {
                    id: { in: numericClassIds },
                    is_active: true
                },
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            });

            if (validClasses.length !== numericClassIds.length) {
                const foundIds = validClasses.map(c => c.id);
                const invalidIds = numericClassIds.filter(id => !foundIds.includes(id));

                // Find out which specific classes are invalid
                const invalidClassDetails = await db.classes.findMany({
                    where: {
                        id: { in: invalidIds }
                    },
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        is_active: true
                    }
                });

                return NextResponse.json(
                    {
                        error: `Some classes not found or inactive. Invalid IDs: ${invalidIds.join(', ')}`,
                        valid_classes: validClasses,
                        invalid_ids: invalidIds,
                        invalid_class_details: invalidClassDetails
                    },
                    { status: 400 }
                );
            }
        }

        // Use transaction to ensure consistency with increased timeout
        const result = await db.$transaction(async (tx) => {
            try {
                // First, deactivate all current assignments
                const deactivatedResult = await tx.trainerClassAssignments.updateMany({
                    where: {
                        trainer_id: trainerId,
                        is_active: true
                    },
                    data: {
                        is_active: false
                    }
                });
          let createdCount = 0;

                // Optimize: Get all existing assignments at once
                if (numericClassIds.length > 0) {
                    const existingAssignments = await tx.trainerClassAssignments.findMany({
                        where: {
                            trainer_id: trainerId,
                            class_id: { in: numericClassIds }
                        }
                    });

                    // Group by what needs to be updated vs created
                    const existingClassIds = existingAssignments.map(a => a.class_id);
                    const newClassIds = numericClassIds.filter(id => !existingClassIds.includes(id));

                    // Bulk update existing assignments
                    if (existingAssignments.length > 0) {
                        const updatePromises = existingAssignments.map(assignment =>
                            tx.trainerClassAssignments.update({
                                where: { id: assignment.id },
                                data: {
                                    is_active: true,
                                    assigned_by: user.name,
                                    assigned_at: new Date()
                                }
                            })
                        );

                        await Promise.all(updatePromises);
                        createdCount += existingAssignments.length;
                    }

                    // Bulk create new assignments
                    if (newClassIds.length > 0) {
                        const createData = newClassIds.map(classId => ({
                            trainer_id: trainerId,
                            class_id: classId,
                            assigned_by: user.name,
                            is_active: true
                        }));

                        const createResult = await tx.trainerClassAssignments.createMany({
                            data: createData
                        });

                        createdCount += createResult.count;
                    }
                }

                return {
                    deactivated: deactivatedResult.count,
                    created: createdCount,
                    assigned_classes: numericClassIds.length
                };
            } catch (transactionError) {
                console.error('Transaction error:', transactionError);
                throw transactionError;
            }
        }, {
            timeout: 20000 // Increase timeout to 20 seconds
        });

        return NextResponse.json({
            message: `Successfully updated assignments. ${result.assigned_classes} classes assigned.`,
            ...result
        });

    } catch (error) {
        console.error('Error updating trainer assignments:', error);

        // Provide more detailed error information
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }

        return NextResponse.json(
            {
                error: 'Failed to update assignments',
                details: error instanceof Error ? error.message : 'Unknown error',
                debug_info: {
                    trainer_id: trainerId,
                    class_ids: numericClassIds,
                    error_type: error instanceof Error ? error.name : typeof error
                }
            },
            { status: 500 }
        );
    }
}