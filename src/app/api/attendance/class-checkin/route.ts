// app/api/attendance/class-checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { db } from '@/lib/db/db';

// POST /api/attendance/class-checkin - Handle class check-in for trainers
export async function POST(request: NextRequest) {
  try {
    const { class_id, trainer_id } = await request.json();

    if (!class_id || !trainer_id) {
      return NextResponse.json(
        { error: 'class_id and trainer_id are required' },
        { status: 400 }
      );
    }

    // Get current time in Kenya timezone
    const nowInKenya = DateTime.now().setZone('Africa/Nairobi');
    const currentTime = nowInKenya.toJSDate();
    const currentDate = currentTime.toISOString().split('T')[0];

    // Verify trainer exists and is active
    const trainer = await db.users.findUnique({
      where: { id: trainer_id },
      select: { id: true, name: true, role: true, is_active: true }
    });

    if (!trainer || !trainer.is_active) {
      return NextResponse.json(
        { error: 'Trainer not found or inactive' },
        { status: 404 }
      );
    }

    // Verify class exists and is active
    const classInfo = await db.classes.findUnique({
      where: { id: class_id },
      select: { id: true, name: true, code: true, is_active: true, duration_hours: true }
    });

    if (!classInfo || !classInfo.is_active) {
      return NextResponse.json(
        { error: 'Class not found or inactive' },
        { status: 404 }
      );
    }

    // Check if trainer is assigned to this class
    const assignment = await db.trainerClassAssignments.findFirst({
      where: {
        trainer_id: trainer_id,
        class_id: class_id,
        is_active: true
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Trainer is not assigned to this class' },
        { status: 403 }
      );
    }

    // Check if trainer has checked into work today
    const workAttendance = await db.attendance.findFirst({
      where: {
        employee_id: trainer_id,
        date: new Date(currentDate)
      }
    });

    if (!workAttendance) {
      return NextResponse.json(
        { error: 'You must check into work before checking into classes' },
        { status: 400 }
      );
    }

    // Check if trainer has an active work session
    const hasActiveWorkSession = () => {
      if (!workAttendance.sessions || !Array.isArray(workAttendance.sessions)) {
        return !!(workAttendance.check_in_time && !workAttendance.check_out_time);
      }
      return workAttendance.sessions.some((session: any) => 
        session.check_in && !session.check_out
      );
    };

    if (!hasActiveWorkSession()) {
      return NextResponse.json(
        { error: 'You must be checked into work to check into classes' },
        { status: 400 }
      );
    }

    // Check if already checked into this class today
    const existingClassAttendance = await db.classAttendance.findFirst({
      where: {
        trainer_id: trainer_id,
        class_id: class_id,
        date: new Date(currentDate)
      }
    });

    if (existingClassAttendance) {
      return NextResponse.json(
        { error: 'Already checked into this class today' },
        { status: 400 }
      );
    }

    // Calculate auto-checkout time
    const autoCheckoutTime = new Date(currentTime);
    autoCheckoutTime.setHours(autoCheckoutTime.getHours() + classInfo.duration_hours);

    // Create class attendance record
    const classAttendance = await db.classAttendance.create({
      data: {
        trainer_id: trainer_id,
        class_id: class_id,
        date: new Date(currentDate),
        check_in_time: currentTime,
        check_out_time: autoCheckoutTime,
        status: 'Present',
        auto_checkout: true,
        work_attendance_id: workAttendance.id
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully checked into ${classInfo.name}`,
      class_attendance: {
        id: classAttendance.id,
        class: {
          id: classInfo.id,
          name: classInfo.name,
          code: classInfo.code
        },
        check_in_time: currentTime.toISOString(),
        auto_checkout_time: autoCheckoutTime.toISOString(),
        duration_hours: classInfo.duration_hours
      }
    });

  } catch (error) {
    console.error('Class check-in error:', error);
    return NextResponse.json(
      { error: 'Failed to check into class' },
      { status: 500 }
    );
  }
}