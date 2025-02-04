// app/api/profile/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

// Define allowed fields for update
interface UpdateProfileData {
    name?: string;
    email?: string;
    date_of_birth?: string;
    phone_number?: string;
    gender?: string;
}

export async function PUT(request: NextRequest) {
    try {
        // Verify authentication
        const cookieStore = await cookies();
        const token = cookieStore.get('token');
       
        if (!token) {
            return NextResponse.json(
                { error: 'No token found' },
                { status: 401 }
            );
        }

        const { payload } = await jwtVerify(
            token.value,
            new TextEncoder().encode(process.env.JWT_SECRET)
        );

        const userId = Number(payload.id);

        // Get the update data from request body
        const data: UpdateProfileData = await request.json();

        // Validate email format if it's being updated
        if (data.email && !data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate phone number format if it's being updated
        if (data.phone_number && !data.phone_number.match(/^\+?[0-9]{10,15}$/)) {
            return NextResponse.json(
                { error: 'Invalid phone number format' },
                { status: 400 }
            );
        }

        // Validate gender if it's being updated
        if (data.gender && !['male', 'female', 'other'].includes(data.gender.toLowerCase())) {
            return NextResponse.json(
                { error: 'Invalid gender value' },
                { status: 400 }
            );
        }

        // Validate date of birth if it's being updated
        if (data.date_of_birth) {
            const dobDate = new Date(data.date_of_birth);
            if (isNaN(dobDate.getTime())) {
                return NextResponse.json(
                    { error: 'Invalid date format for date of birth' },
                    { status: 400 }
                );
            }
        }

        // Start a transaction to update both tables
        const updatedProfile = await db.$transaction(async (tx) => {
            // Update employee data
            const updatedEmployee = await tx.employees.update({
                where: { id: userId },
                data: {
                    name: data.name,
                    email: data.email,
                    date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
                }
            });

            // Update user data
            if (data.phone_number || data.gender) {
                await tx.users.update({
                    where: { id: updatedEmployee.employee_id },
                    data: {
                        phone_number: data.phone_number,
                        gender: data.gender,
                    }
                });
            }

            // Fetch updated data
            return await tx.employees.findUnique({
                where: { id: userId },
                include: {
                    user: true
                }
            });
        });

        if (!updatedProfile) {
            return NextResponse.json(
                { error: 'Failed to update profile' },
                { status: 500 }
            );
        }

        // Return the updated profile data
        return NextResponse.json({
            message: 'Profile updated successfully',
            data: {
                id: updatedProfile.id,
                name: updatedProfile.name,
                email: updatedProfile.email,
                role: updatedProfile.role,
                date_of_birth: updatedProfile.date_of_birth.toISOString().split('T')[0],
                id_card_path: updatedProfile.id_card_path,
                passport_photo: updatedProfile.passport_photo,
                id_number: updatedProfile.user.id_number,
                phone_number: updatedProfile.user.phone_number,
                gender: updatedProfile.user.gender,
                created_at: updatedProfile.user.created_at.toISOString()
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        
        if (error instanceof Error) {
            // Handle specific database errors
            if (error.message.includes('Unique constraint')) {
                return NextResponse.json(
                    { error: 'Email already exists' },
                    { status: 400 }
                );
            }

            if (error.message.includes('jwt expired')) {
                return NextResponse.json(
                    { error: 'Token expired' },
                    { status: 401 }
                );
            }

            if (error.message.includes('invalid token')) {
                return NextResponse.json(
                    { error: 'Invalid token' },
                    { status: 401 }
                );
            }
        }
        
        return NextResponse.json(
            { error: 'Failed to update profile' },
            { status: 500 }
        );
    }
}