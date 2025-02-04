// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';

export async function GET(request: NextRequest) {
    try {
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

        // Get employee data with user relation
        const employeeData = await db.employees.findUnique({
            where: {
                id: userId
            },
            include: {
                user: true  // Include the related user data
            }
        });

        if (!employeeData) {
            return NextResponse.json(
                { error: 'Employee not found' },
                { status: 404 }
            );
        }

        // Combine and format the data
        const profileData = {
            id: employeeData.id,
            name: employeeData.name,
            email: employeeData.email,
            role: employeeData.role,
            date_of_birth: employeeData.date_of_birth.toISOString().split('T')[0],
            id_card_path: employeeData.id_card_path,
            passport_photo: employeeData.passport_photo,
            // User specific fields
            id_number: employeeData.user.id_number,
            phone_number: employeeData.user.phone_number,
            gender: employeeData.user.gender,
            created_at: employeeData.user.created_at.toISOString()
        };

        return NextResponse.json(profileData);

    } catch (error) {
        console.error('Profile fetch error:', error);
        
        if (error instanceof Error) {
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
            { error: 'Failed to fetch profile data' },
            { status: 500 }
        );
    }
}