import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const id = pathname.split('/').pop();

  if (!id || id === 'employees') {
    return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
  }

  try {
    const employee = await prisma.employees.findUnique({
      where: { id: Number(id) },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const id = pathname.split('/').pop();
  
    if (!id || id === 'employees') {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
  
    let updatedData;
    try {
      updatedData = await req.json();
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }
  
    if (!updatedData) {
      return NextResponse.json({ error: 'No data provided to update' }, { status: 400 });
    }
  
    try {
      const updatedEmployee = await prisma.employees.update({
        where: { id: Number(id) },
        data: updatedData,
      });
      return NextResponse.json(updatedEmployee);
    } catch (error) {
      console.error('Error updating employee:', error);
      return NextResponse.json({ error: 'Failed to update employee data' }, { status: 500 });
    }
  }
  