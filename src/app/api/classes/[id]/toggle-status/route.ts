// app/api/classes/[id]/toggle-status/route.ts
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

// POST /api/classes/[id]/toggle-status - Toggle class active status (Admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authResult = await verifyAuth();
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        // ✅ NEW: Explicit check for user existence
        if (!authResult.user) {
            return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
        }

        const { user } = authResult; // ✅ Now TypeScript knows user exists

        // Check if user is admin
        if (user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 403 }
            );
        }

        const classId = parseInt(params.id);

        if (isNaN(classId)) {
            return NextResponse.json(
                { error: 'Invalid class ID' },
                { status: 400 }
            );
        }

        // Find the class
        const existingClass = await db.classes.findUnique({
            where: { id: classId }
        });

        if (!existingClass) {
            return NextResponse.json(
                { error: 'Class not found' },
                { status: 404 }
            );
        }

        // Toggle the status
        const updatedClass = await db.classes.update({
            where: { id: classId },
            data: {
                is_active: !existingClass.is_active,
                updated_at: new Date()
            }
        });

        // If deactivating a class, we might want to notify trainers or handle assignments
        if (!updatedClass.is_active) {
            // Optional: Add logic here to handle active class assignments
            // For example, you might want to:
            // 1. Notify assigned trainers
            // 2. Set assignments to inactive
            // 3. Handle ongoing attendance sessions

        }

        return NextResponse.json({
            message: `Class ${updatedClass.is_active ? 'activated' : 'deactivated'} successfully`,
            class: updatedClass
        });

    } catch (error) {
        console.error('Error toggling class status:', error);
        return NextResponse.json(
            { error: 'Failed to update class status' },
            { status: 500 }
        );
    }
}