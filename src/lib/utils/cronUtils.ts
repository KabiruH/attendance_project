import { db } from "../db/db";

// Interface for attendance session
interface AttendanceSession {
  [key: string]: any;
  check_in_time?: string;
  check_out_time?: string;
  type: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  ip_address?: string;
  user_agent?: string;
  auto_checkout?: boolean;
}

const ATTENDANCE_RULES = {
  AUTO_CHECKOUT: 15,       // 5 PM - automatic checkout time
  CLASS_DURATION_HOURS: 2, // 2 hours - automatic class checkout after this duration
};

export async function processAbsentRecords(date: Date = new Date()) {
  const currentDate = date.toISOString().split('T')[0];
  const currentTime = date.getHours();
 
  try {
    // Only process absences after work hours (5 PM)
    const isToday = currentDate === new Date().toISOString().split('T')[0];
    if (isToday && currentTime < 17) {
      return 0;
    }

    const activeEmployees = await db.employees.findMany({
      where: {
        user: { is_active: true }
      },
      select: { id: true }
    });

    const existingRecords = await db.attendance.findMany({
      where: {
        date: new Date(currentDate),
      },
      select: {
        employee_id: true,
        check_in_time: true,
        status: true
      }
    });
    const employeesWithRecords = new Set(existingRecords.map(record => record.employee_id));
    const potentialAbsentees = activeEmployees.filter(
      employee => !employeesWithRecords.has(employee.id)
    );

    if (potentialAbsentees.length > 0) {
      const notAbsentYet = await db.attendance.findMany({
        where: {
          employee_id: { in: potentialAbsentees.map(e => e.id) },
          date: new Date(currentDate),
          NOT: { status: 'Absent' }
        }
      });

      const notAbsentIds = new Set(notAbsentYet.map(r => r.employee_id));
      const confirmedAbsentees = potentialAbsentees.filter(e => !notAbsentIds.has(e.id));

      if (confirmedAbsentees.length > 0) {
        await db.attendance.createMany({
          data: confirmedAbsentees.map(employee => ({
            employee_id: employee.id,
            date: new Date(currentDate),
            status: 'Absent',
            check_in_time: null,
            check_out_time: null
          }))
        });
      }

      return confirmedAbsentees.length;
    }

    return 0;
  } catch (error) {
    console.error('Failed to process absent records:', error);
    return 0;
  }
}

export async function processMissedDays() {
  try {
      // Get the last 7 days
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // Exclude today
      endDate.setHours(17, 0, 0, 0);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(17, 0, 0, 0);

      // Get all dates between start and end
      const dates: Date[] = [];
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) { // This will now exclude today
          // Skip weekends
          if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
              dates.push(new Date(currentDate));
          }
          currentDate.setDate(currentDate.getDate() + 1);
      }

      let totalProcessed = 0;

      // Process each missed day
      for (const date of dates) {
          const existingProcessing = await db.attendanceProcessingLog.findFirst({
              where: {
                  date: date,
                  status: 'completed'
              }
          });

          // Skip if already processed
          if (!existingProcessing) {
              const processedCount = await processAbsentRecords(date);
              
              // Log the processing
              await db.attendanceProcessingLog.create({
                  data: {
                      date: date,
                      records_processed: processedCount,
                      status: 'completed'
                  }
              });

              totalProcessed += processedCount;
          }
      }

      return totalProcessed;
  } catch (error) {
      console.error('Failed to process missed days:', error);
      return 0;
  }
}

// NEW: Process class attendance auto-checkouts
export async function processClassAutoCheckouts(currentTime: Date) {
  try {
    const todayDate = new Date(currentTime.toISOString().split('T')[0]);
    
    // Find all active class sessions
    const activeClassSessions = await db.classAttendance.findMany({
      where: {
        date: todayDate,
        check_out_time: null
      }
    });

    let classCheckoutCount = 0;

    for (const session of activeClassSessions) {
      if (session.check_in_time) {
        const timeDiff = currentTime.getTime() - session.check_in_time.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Auto-checkout after 2 hours
        if (hoursDiff >= ATTENDANCE_RULES.CLASS_DURATION_HOURS) {
          await db.classAttendance.update({
            where: { id: session.id },
            data: {
              check_out_time: currentTime,
              auto_checkout: true
            }
          });
          classCheckoutCount++;
          
          console.log(`Auto-checked out class session for trainer ${session.trainer_id}, class ${session.class_id}`);
        }
      }
    }

    return classCheckoutCount;
  } catch (error) {
    console.error('Failed to process class auto-checkouts:', error);
    return 0;
  }
}

// ENHANCED: Add session tracking for work checkouts
async function performWorkAutoCheckout(record: any, checkoutTime: Date) {
  let existingSessions: AttendanceSession[] = [];
  
  if (record.sessions) {
    try {
      const sessionData = record.sessions as unknown;
      
      if (Array.isArray(sessionData)) {
        existingSessions = sessionData as AttendanceSession[];
      } else if (typeof sessionData === 'string') {
        existingSessions = JSON.parse(sessionData) as AttendanceSession[];
      }
    } catch (parseError) {
      console.error('Error parsing existing sessions:', parseError);
      existingSessions = [];
    }
  }

  const autoCheckoutSession: AttendanceSession = {
    check_out_time: checkoutTime.toISOString(),
    type: 'work_auto_checkout',
    auto_checkout: true,
    ip_address: 'system',
    user_agent: 'Auto Checkout System'
  };

  const updatedSessions = [...existingSessions, autoCheckoutSession];
  const sessionsJson = JSON.parse(JSON.stringify(updatedSessions));

  await db.attendance.update({
    where: { id: record.id },
    data: { 
      check_out_time: checkoutTime,
      sessions: sessionsJson
    }
  });
}

export async function processAutomaticAttendance() {
  const currentTime = new Date();
  const currentDate = new Date().toISOString().split('T')[0];
 
  try {
      // First, check and process any missed days
      const missedRecordsCount = await processMissedDays();

      // Process class auto-checkouts (can happen anytime after 2 hours)
      const classCheckoutCount = await processClassAutoCheckouts(currentTime);

      // Only proceed with work processing if it's 5 PM or later
      if (currentTime.getHours() >= 17) {
          // 1. Process work auto-checkouts
          const pendingCheckouts = await db.attendance.findMany({
              where: {
                  date: new Date(currentDate),
                  check_out_time: null,
                  check_in_time: {
                      not: null,
                  },
              },
          });

          const checkoutTime = new Date(currentDate + 'T15:00:00');

          // Process each work checkout with session tracking
          for (const record of pendingCheckouts) {
            await performWorkAutoCheckout(record, checkoutTime);
          }

          // 2. Process absent records after checkout time
          const absentCount = await processAbsentRecords(currentTime);

          return {
              workCheckouts: pendingCheckouts.length,
              classCheckouts: classCheckoutCount,
              absentRecords: absentCount,
              missedDaysProcessed: missedRecordsCount
          };
      }
   
      return {
          workCheckouts: 0,
          classCheckouts: classCheckoutCount,
          absentRecords: 0,
          missedDaysProcessed: missedRecordsCount
      };
  } catch (error) {
      console.error('Auto-attendance error:', error);
      return {
          workCheckouts: 0,
          classCheckouts: 0,
          absentRecords: 0,
          missedDaysProcessed: 0
      };
  }
}

export async function ensureCheckouts() {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    const currentTime = new Date();

    // Process class checkouts (any time)
    await processClassAutoCheckouts(currentTime);

    // Find all work records from today that haven't been checked out
    // and where it's past 5 PM
    if (currentHour >= 15) {
      const pendingCheckouts = await db.attendance.findMany({
        where: {
          date: new Date(currentDate),
          check_out_time: null,
          check_in_time: {
            not: null,
          },
        },
      });

      if (pendingCheckouts.length > 0) {
        const checkoutTime = new Date(currentDate + 'T15:00:00');
        
        // Process each checkout with session tracking
        for (const record of pendingCheckouts) {
          await performWorkAutoCheckout(record, checkoutTime);
        }
      }
    }

    // Also check previous day if it's before noon
    if (currentHour < 12) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const pendingYesterdayCheckouts = await db.attendance.findMany({
        where: {
          date: new Date(yesterdayDate),
          check_out_time: null,
          check_in_time: {
            not: null,
          },
        },
      });

      const yesterdayCheckoutTime = new Date(yesterdayDate + 'T17:00:00');
      if (pendingYesterdayCheckouts.length > 0) {
        
        // Process each checkout with session tracking
        for (const record of pendingYesterdayCheckouts) {
          await performWorkAutoCheckout(record, yesterdayCheckoutTime);
        }
      }

      // Also check yesterday's class sessions
      const yesterdayClassSessions = await db.classAttendance.findMany({
        where: {
          date: new Date(yesterdayDate),
          check_out_time: null
        }
      });

      for (const session of yesterdayClassSessions) {
        if (session.check_in_time) {
          // Force checkout for any unclosed sessions from yesterday
          await db.classAttendance.update({
            where: { id: session.id },
            data: {
              check_out_time: yesterdayCheckoutTime,
              auto_checkout: true
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('Failed to process checkouts:', error);
  }
}