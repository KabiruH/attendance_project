import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const employees = await prisma.employees.findMany();
    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: 'No employees found' }, { status: 404 });
    }
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}


