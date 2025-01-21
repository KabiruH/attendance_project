import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JwtPayload } from 'jsonwebtoken';
import { db } from '@/lib/db/db';

// Define the expected structure of your JWT payload
interface CustomJwtPayload {
  id: number;
  role: 'admin' | 'employee';
  // add any other fields that are in your JWT
}

// Helper function to verify token from cookies with proper typing
async function verifyToken(): Promise<CustomJwtPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');
  
  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    
    return payload as unknown as CustomJwtPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken();
    const userId = payload.id;
    const role = payload.role;
    const currentDate = new Date().toISOString().split('T')[0];

    if (role === 'admin') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const attendanceData = await db.attendance.findMany({
        where: {
          date: {
            gte: sevenDaysAgo
          }
        },
        include: {
          Employees: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { Employees: { name: 'asc' } }
        ]
      });

      return NextResponse.json({
        role: 'admin',
        attendanceData
      });
    }

    // For employees - get today's attendance
    const todayAttendance = await db.attendance.findFirst({
      where: {
        employee_id: userId,
        date: new Date(currentDate)
      }
    });

    // Get monthly attendance data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyData = await db.attendance.findMany({
      where: {
        employee_id: userId,
        date: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    const isCheckedIn = todayAttendance && !todayAttendance.check_out_time;

    return NextResponse.json({
      role: 'employee',
      isCheckedIn,
      attendanceData: monthlyData
    });

  } catch (error) {
    console.error('Status check error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch attendance status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        try {
            const { payload } = await jwtVerify(
                token,
                new TextEncoder().encode(process.env.JWT_SECRET)
            );
            console.log(payload)

            // Check if payload exists
            if (!payload) {
                throw new Error('Invalid token payload');
            }

            const jwtPayload = payload as unknown as CustomJwtPayload;
            const employee_id = jwtPayload.id;

            // Verify employee exists first
            const employee = await db.employees.findUnique({
                where: { id: employee_id }
            });

            if (!employee) {
                return NextResponse.json(
                    { error: 'Employee not found' },
                    { status: 404 }
                );
            }

            const body = await request.json();
            const { action } = body;
            const currentTime = new Date();
            const currentDate = new Date().toISOString().split('T')[0];

            const existingAttendance = await db.attendance.findFirst({
                where: {
                    employee_id,
                    date: new Date(currentDate)
                }
            });

            if (action === 'check-in') {
              if (existingAttendance) {
                  return NextResponse.json(
                      { error: 'Already checked in today' },
                      { status: 400 }
                  );
              }
          
              const startTime = new Date();
              startTime.setHours(9, 0, 0, 0);
              // Use exactly "Present" or "Late" to match the database constraint
              const status = currentTime > startTime ? "Late" : "Present";
          
              try {
                  const attendance = await db.attendance.create({
                      data: {
                          employee_id: employee_id,
                          date: new Date(currentDate),
                          check_in_time: currentTime,
                          status: status
                      }
                  });
          
                  return NextResponse.json({
                      success: true,
                      data: attendance
                  });
              } catch (createError) {
                  console.error('Create attendance error:', createError);
                  if (createError instanceof Error) {
                      return NextResponse.json(
                          { 
                              error: 'Failed to create attendance record',
                              details: createError.message
                          },
                          { status: 400 }
                      );
                  }
                  return NextResponse.json(
                      { error: 'Unknown error creating attendance record' },
                      { status: 500 }
                  );
              }
          }
            
            if (action === 'check-out') {
                if (!existingAttendance) {
                    return NextResponse.json(
                        { error: 'No check-in record found for today' },
                        { status: 400 }
                    );
                }

                if (existingAttendance.check_out_time) {
                    return NextResponse.json(
                        { error: 'Already checked out today' },
                        { status: 400 }
                    );
                }

                const attendance = await db.attendance.update({
                    where: {
                        id: existingAttendance.id
                    },
                    data: {
                        check_out_time: currentTime
                    }
                });

                return NextResponse.json({
                    success: true,
                    data: attendance
                });
            }

            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );

        } catch (jwtError) {
            console.error('JWT verification error:', jwtError);
            return NextResponse.json(
                { error: 'Authentication failed' },
                { status: 401 }
            );
        }

    } catch (error) {
        console.error('Attendance error:', error);
        
        if (error instanceof Error) {
            if (error.message.includes('jwt expired')) {
                return NextResponse.json({ error: 'Token expired' }, { status: 401 });
            }
            if (error.message.includes('invalid token')) {
                return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
            }
        }
        
        return NextResponse.json(
            { error: 'Failed to process attendance' },
            { status: 500 }
        );
    }
}