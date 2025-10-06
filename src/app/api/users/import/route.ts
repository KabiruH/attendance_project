// app/api/users/import/route.ts
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

// POST /api/users/import - Bulk import users from Excel (Admin only)
export async function POST(request: NextRequest) {
    try {
        const authResult = await verifyAuth();
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        if (!authResult.user) {
            return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
        }

        const { user } = authResult;

        // Check if user is admin
        if (user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { users } = body;

        if (!users || !Array.isArray(users)) {
            return NextResponse.json(
                { error: 'Invalid data format. Expected array of users.' },
                { status: 400 }
            );
        }

        const results = {
            imported: 0,
            skipped: 0,
            errors: [] as string[]
        };

        // Get existing id_numbers and emails to avoid duplicates
        const existingUsers = await db.users.findMany({
            select: { id_number: true, email: true }
        });
        const existingIdNumbers = new Set(existingUsers.map(u => u.id_number));
        const existingEmails = new Set(existingUsers.map(u => u.email).filter(Boolean));

        // Process each user
        for (let i = 0; i < users.length; i++) {
            const userData = users[i];

            try {
                // Validation - required fields
                if (!userData.name || !userData.id_number || !userData.role || 
                    !userData.phone_number || !userData.gender) {
                    results.errors.push(
                        `Row ${i + 1}: Missing required fields (name, id_number, role, phone_number, gender)`
                    );
                    results.skipped++;
                    continue;
                }

                const upperIdNumber = userData.id_number.toString().toUpperCase();

                // Check for duplicate ID numbers
                if (existingIdNumbers.has(upperIdNumber)) {
                    results.errors.push(`Row ${i + 1}: ID number '${upperIdNumber}' already exists`);
                    results.skipped++;
                    continue;
                }

                // Check for duplicate emails (if provided)
                if (userData.email && existingEmails.has(userData.email.toLowerCase())) {
                    results.errors.push(`Row ${i + 1}: Email '${userData.email}' already exists`);
                    results.skipped++;
                    continue;
                }

                // Validate role
                const validRoles = ['admin', 'employee'];
                if (!validRoles.includes(userData.role.toLowerCase())) {
                    results.errors.push(
                        `Row ${i + 1}: Invalid role '${userData.role}'. Must be one of: ${validRoles.join(', ')}`
                    );
                    results.skipped++;
                    continue;
                }

                // Validate gender
                const validGenders = ['male', 'female'];
                if (!validGenders.includes(userData.gender.toLowerCase())) {
                    results.errors.push(
                        `Row ${i + 1}: Invalid gender '${userData.gender}'. Must be 'male' or 'female'`
                    );
                    results.skipped++;
                    continue;
                }

                // Add to existing sets to prevent duplicates within this batch
                existingIdNumbers.add(upperIdNumber);
                if (userData.email) {
                    existingEmails.add(userData.email.toLowerCase());
                }

                // Create user
                await db.users.create({
                    data: {
                        name: userData.name,
                        id_number: upperIdNumber,
                        role: userData.role.toLowerCase(),
                        phone_number: userData.phone_number,
                        department: userData.department || null,
                        gender: userData.gender.toLowerCase(),
                        email: userData.email ? userData.email.toLowerCase() : null,
                        is_active: userData.is_active !== false,
                        created_by: user.name
                    }
                });

                results.imported++;
            } catch (error) {
                console.error(`Error importing user at row ${i + 1}:`, error);
                results.errors.push(
                    `Row ${i + 1}: Failed to create user - ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                results.skipped++;
            }
        }

        // Return results
        if (results.imported === 0 && results.errors.length > 0) {
            return NextResponse.json(
                {
                    error: 'No users were imported',
                    details: results
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: `Successfully imported ${results.imported} users`,
            imported: results.imported,
            skipped: results.skipped,
            errors: results.errors
        });

    } catch (error) {
        console.error('Error importing users:', error);
        return NextResponse.json(
            { error: 'Failed to import users' },
            { status: 500 }
        );
    }
}