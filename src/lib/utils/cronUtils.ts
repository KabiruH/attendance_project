import { db } from "../db/db";

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

export async function processAutomaticAttendance() {
  const currentTime = new Date();
  const currentDate = new Date().toISOString().split('T')[0];
 
  try {
      // First, check and process any missed days
      const missedRecordsCount = await processMissedDays();

      // Only proceed with today's processing if it's 5 PM or later
      if (currentTime.getHours() >= 17) {
          // 1. Process auto-checkouts
          const pendingCheckouts = await db.attendance.findMany({
              where: {
                  date: new Date(currentDate),
                  check_out_time: null,
                  check_in_time: {
                      not: null,
                  },
              },
          });

          const checkoutTime = new Date(currentDate + 'T17:00:00'); // Remove the second setHours

          if (pendingCheckouts.length > 0) {
              await Promise.all(
                  pendingCheckouts.map(record =>
                      db.attendance.update({
                          where: { id: record.id },
                          data: { check_out_time: checkoutTime }
                      })
                  )
              );
          }

          // 2. Process absent records after checkout time
          const absentCount = await processAbsentRecords(currentTime);

          return {
              autoCheckouts: pendingCheckouts.length,
              absentRecords: absentCount,
              missedDaysProcessed: missedRecordsCount
          };
      }
   
      return {
          autoCheckouts: 0,
          absentRecords: 0,
          missedDaysProcessed: missedRecordsCount
      };
  } catch (error) {
      console.error('Auto-attendance error:', error);
      return {
          autoCheckouts: 0,
          absentRecords: 0,
          missedDaysProcessed: 0
      };
  }
}

export async function ensureCheckouts() {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    // Find all records from today that haven't been checked out
    // and where it's past 5 PM
    if (currentHour >= 17) {
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
        const checkoutTime = new Date(currentDate + 'T17:00:00');
        
        await db.attendance.updateMany({
          where: {
            id: {
              in: pendingCheckouts.map(record => record.id)
            }
          },
          data: {
            check_out_time: checkoutTime
          }
        });
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

      if (pendingYesterdayCheckouts.length > 0) {
        const yesterdayCheckoutTime = new Date(yesterdayDate + 'T17:00:00');
        
        await db.attendance.updateMany({
          where: {
            id: {
              in: pendingYesterdayCheckouts.map(record => record.id)
            }
          },
          data: {
            check_out_time: yesterdayCheckoutTime
          }
        });
      }
    }

  } catch (error) {
    console.error('Failed to process checkouts:', error);
  }
}