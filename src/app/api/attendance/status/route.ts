//api/status/route
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    // Call the '/api/auth/check' endpoint to validate the token
    const authResponse = await fetch('/api/auth/check', {
      method: 'GET',
      headers: request.headers,
    });

    if (!authResponse.ok) {
      // If the token is invalid or missing, return an error response
      const errorData = await authResponse.json();
      return NextResponse.json({ error: errorData.error || 'Unauthorized' }, { status: 401 });
    }

    const { token, user } = await authResponse.json();
    const { id: userId, role } = user;  // Destructure user info from token

    const currentDate = new Date().toISOString().split('T')[0];  

    if (role === 'admin') {
      // Admin query - get last 7 days attendance for all employees
      const result = await sql.query`
        SELECT
          a.employee_id,
          e.name as employee_name,
          a.date,
          a.check_in_time,
          a.check_out_time,
          a.status
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.date >= DATEADD(day, -7, GETDATE())
        ORDER BY a.date DESC, e.name ASC
      `;

      return NextResponse.json({
        role: 'admin',
        attendanceData: result.recordset,
      });
    }

    // Employee queries - get today's and monthly attendance
    const [todayResult, monthlyResult] = await Promise.all([
      sql.query`
        SELECT * FROM attendance
        WHERE employee_id = ${userId}
        AND CAST(date AS DATE) = ${currentDate}
      `,
      sql.query`
        SELECT
          date,
          status,
          check_in_time,
          check_out_time
        FROM attendance
        WHERE employee_id = ${userId}
        AND date >= DATEADD(month, -1, GETDATE())
        ORDER BY date DESC
      `
    ]);

    const isCheckedIn = 
      todayResult.recordset.length > 0 && 
      !todayResult.recordset[0].check_out_time;

    return NextResponse.json({
      role: 'employee',
      isCheckedIn,
      attendanceData: monthlyResult.recordset,
    });

  } catch (error) {
    console.error('Status check error:', error);

    if (error instanceof Error) {
      // Handle specific authentication errors
      if (['Unauthorized', 'Invalid token', 'Invalid token payload', 'jwt expired'].some(msg => error.message.includes(msg))) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch attendance status' },
      { status: 500 }
    );
  }
}
