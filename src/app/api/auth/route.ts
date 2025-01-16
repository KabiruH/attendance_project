import { NextResponse } from 'next/server';
import sql from 'mssql';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';

const config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

export async function POST(request: Request) {
  const pool = new sql.ConnectionPool(config);
  
  try {
    const { email, password } = await request.json();
    
    // Connect to database using the pool
    await pool.connect();
    
    // Query for user
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT UserId, Email, Password, Role, Name
        FROM Users
        WHERE Email = @email
      `);

    const user = result.recordset[0];
    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const isValid = await compare(password, user.Password);
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.UserId,
        email: user.Email,
        role: user.Role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    return NextResponse.json({
      token,
      user: {
        id: user.UserId,
        name: user.Name,
        email: user.Email,
        role: user.Role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Close the pool connection
    await pool.close();
  }
}