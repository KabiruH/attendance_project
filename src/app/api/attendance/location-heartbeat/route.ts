import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { verifyMobileJWT } from '@/lib/auth/mobile-jwt';
import { isWithinGeofence } from '@/lib/geofence-utils';

export async function POST(request: NextRequest) {
    try {
        // Verify mobile JWT
        const mobileAuth = await verifyMobileJWT(request);

        if (!mobileAuth.success || !mobileAuth.payload) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const employeeId = mobileAuth.payload.employeeId;
        const body = await request.json();

        // Validate location data
        if (!body.latitude || !body.longitude || !body.accuracy) {
            return NextResponse.json(
                { success: false, error: 'Invalid location data' },
                { status: 400 }
            );
        }

        if (!employeeId) {
            return NextResponse.json(
                { success: false, error: 'Invalid employee ID' },
                { status: 400 }
            );
        }

        const { latitude, longitude, accuracy } = body;

        // Check if inside geofence using your utilities
        const isInsideFence = isWithinGeofence(latitude, longitude);

        // Store location heartbeat
        await db.locationHeartbeat.create({
            data: {
                employee_id: employeeId,
                latitude,
                longitude,
                accuracy,
                is_inside_fence: isInsideFence,
            },
        });

        // Clean up old heartbeats (older than 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        await db.locationHeartbeat.deleteMany({
            where: {
                recorded_at: { lt: oneDayAgo },
            },
        });

        return NextResponse.json({
            success: true,
            is_inside_fence: isInsideFence,
            message: isInsideFence ? 'Inside premises' : 'Outside premises',
        });

    } catch (error) {
        console.error('Location heartbeat error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to record location' },
            { status: 500 }
        );
    }
}