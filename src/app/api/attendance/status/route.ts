import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'VeryDarkSecretsHere';

export async function GET(request: NextRequest) {
  try {
    // Get the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract and verify the token
    const token = authHeader.split(' ')[1];
    let decodedToken: string | JwtPayload;

    try {
      decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Ensure the decoded token is a JwtPayload
    if (typeof decodedToken === 'string' || !('role' in decodedToken) || !('id' in decodedToken)) {
      return NextResponse.json({ error: 'Malformed token' }, { status: 401 });
    }

    const { id: userId, role } = decodedToken;

    const currentDate = new Date().toISOString().split('T')[0];

    // For admin role - get all employees' attendance
    if (role === 'admin') {
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

    // For employee role - get only their attendance
    const result = await sql.query`
      SELECT * FROM attendance 
      WHERE employee_id = ${userId} 
      AND CAST(date AS DATE) = ${currentDate}
    `;

    // Get monthly attendance data for the employee
    const monthlyData = await sql.query`
      SELECT 
        date,
        status,
        check_in_time,
        check_out_time
      FROM attendance 
      WHERE employee_id = ${userId}
      AND date >= DATEADD(month, -1, GETDATE())
      ORDER BY date DESC
    `;

    const isCheckedIn =
      result.recordset.length > 0 && !result.recordset[0].check_out_time;

    return NextResponse.json({
      role: 'employee',
      isCheckedIn,
      attendanceData: monthlyData.recordset,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance status' },
      { status: 500 },
    );
  }
}
