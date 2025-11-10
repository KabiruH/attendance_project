// app/api/attendance/report/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db/db';
import { cookies } from 'next/headers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: Date;
  check_in_time: Date | null;
  check_out_time: Date | null;
  status: string;
  sessions: any;
  Employees?: {
    id: number;
    name: string;
  };
}

interface AnalyticsData {
  totalRecords: number;
  statusCounts: Record<string, number>;
  statusPercentages: Record<string, string>;
  checkInTimes: Record<string, number>;
  peakCheckInTime: string;
  lateCount: number;
  latePercentage: string;
  avgWorkHours: string;
  employeeStats: Record<string, {
    totalDays: number;
    present: number;
    late: number;
    absent: number;
    totalHours: number;
  }>;
}

// Authenticate user using JWT
async function authenticateUser(request: NextRequest): Promise<JwtPayload | null> {
  try {
    const token = (await cookies()).get('token');
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    return payload as unknown as JwtPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Calculate hours worked with 6PM cutoff
function calculateHours(record: AttendanceRecord): number {
  const currentTime = new Date();
  
  // Use sessions data if available
  if (record.sessions && Array.isArray(record.sessions) && record.sessions.length > 0) {
    let totalMinutes = 0;
    
    record.sessions.forEach((session: any) => {
      if (session.check_in) {
        const checkIn = new Date(session.check_in);
        const sixPM = new Date(checkIn);
        sixPM.setHours(18, 0, 0, 0);
        
        let effectiveCheckOut: Date;
        
        if (session.check_out) {
          const actualCheckOut = new Date(session.check_out);
          effectiveCheckOut = actualCheckOut > sixPM ? sixPM : actualCheckOut;
        } else {
          effectiveCheckOut = currentTime >= sixPM ? sixPM : currentTime;
        }
        
        const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
        const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
        totalMinutes += diffInMinutes;
      }
    });
    
    return totalMinutes / 60;
  }
  
  // Fallback to old format
  if (!record.check_in_time) return 0;
  
  const checkIn = new Date(record.check_in_time);
  const sixPM = new Date(checkIn);
  sixPM.setHours(18, 0, 0, 0);
  
  let effectiveCheckOut: Date;
  
  if (record.check_out_time) {
    const actualCheckOut = new Date(record.check_out_time);
    effectiveCheckOut = actualCheckOut > sixPM ? sixPM : actualCheckOut;
  } else {
    const recordDate = new Date(record.date).toDateString();
    const today = new Date().toDateString();
    if (recordDate === today) {
      effectiveCheckOut = currentTime >= sixPM ? sixPM : currentTime;
    } else {
      return 0;
    }
  }
  
  const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
  const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
  
  return diffInMinutes / 60;
}

// Calculate comprehensive analytics
function calculateAnalytics(data: AttendanceRecord[]): AnalyticsData {
  const totalRecords = data.length;
  
  // Status distribution
  const statusCounts: Record<string, number> = {};
  data.forEach(record => {
    const status = record.status.toLowerCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Check-in time distribution (group by hour)
  const checkInTimes: Record<string, number> = {};
  data.forEach(record => {
    if (record.check_in_time || (record.sessions && record.sessions[0]?.check_in)) {
      const checkInTime = record.sessions?.[0]?.check_in || record.check_in_time;
      const date = new Date(checkInTime);
      const hour = date.getHours();
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      checkInTimes[timeSlot] = (checkInTimes[timeSlot] || 0) + 1;
    }
  });

  // Late arrivals (assuming 8:00 AM is the standard time)
  const lateCount = data.filter(record => {
    const status = record.status.toLowerCase();
    return status === 'late';
  }).length;

  // Average work hours
  const workHours = data
    .map(record => calculateHours(record))
    .filter(hours => hours > 0);
  const avgWorkHours = workHours.length > 0 
    ? workHours.reduce((sum, h) => sum + h, 0) / workHours.length 
    : 0;

  // Employee-specific stats
  const employeeStats: Record<string, any> = {};
  data.forEach(record => {
    const empName = record.Employees?.name || 'Unknown';
    if (!employeeStats[empName]) {
      employeeStats[empName] = {
        totalDays: 0,
        present: 0,
        late: 0,
        absent: 0,
        totalHours: 0,
      };
    }
    employeeStats[empName].totalDays++;
    const status = record.status.toLowerCase();
    if (status === 'present') employeeStats[empName].present++;
    if (status === 'late') employeeStats[empName].late++;
    if (status === 'absent' || status === 'not checked in') employeeStats[empName].absent++;
    employeeStats[empName].totalHours += calculateHours(record);
  });

  // Calculate percentages
  const statusPercentages: Record<string, string> = {};
  Object.entries(statusCounts).forEach(([status, count]) => {
    statusPercentages[status] = ((count / totalRecords) * 100).toFixed(1);
  });

  // Find peak check-in time
  const peakCheckInTime = Object.entries(checkInTimes)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return {
    totalRecords,
    statusCounts,
    statusPercentages,
    checkInTimes,
    peakCheckInTime,
    lateCount,
    latePercentage: ((lateCount / totalRecords) * 100).toFixed(1),
    avgWorkHours: avgWorkHours.toFixed(2),
    employeeStats,
  };
}

// Format time for display
function formatTime(timeStr: Date | string | null | undefined): string {
  if (!timeStr) return '-';
  try {
    return new Date(timeStr).toLocaleTimeString('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '-';
  }
}

// Format date for display
function formatDate(date: Date | string): string {
  try {
    return new Date(date).toLocaleDateString('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return '-';
  }
}

// Generate PDF using jsPDF
function generatePDF(
  data: AttendanceRecord[],
  analytics: AnalyticsData,
  options: { startDate?: string; endDate?: string },
  userName: string
): Buffer {
  const doc = new jsPDF();
  let yPosition = 20;

  // Helper function to add page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > 280) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(20);
  doc.setTextColor(30, 64, 175); // Blue color
  doc.text('Attendance Report', 105, yPosition, { align: 'center' });
  yPosition += 10;

  // Date range
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  let dateRangeText = 'Report Period: ';
  if (options.startDate && options.endDate) {
    dateRangeText += `${options.startDate} to ${options.endDate}`;
  } else if (options.startDate) {
    dateRangeText += `From ${options.startDate}`;
  } else if (options.endDate) {
    dateRangeText += `Until ${options.endDate}`;
  } else {
    dateRangeText += 'All Records';
  }
  doc.text(dateRangeText, 105, yPosition, { align: 'center' });
  yPosition += 5;

  doc.text(`Generated: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`, 105, yPosition, { align: 'center' });
  doc.text(`Report for: ${userName}`, 105, yPosition + 5, { align: 'center' });
  yPosition += 15;

  // Executive Summary
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('Executive Summary', 14, yPosition);
  yPosition += 8;

  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Total Records', analytics.totalRecords.toString()],
      ['Average Work Hours', `${analytics.avgWorkHours} hours`],
      ['Peak Check-In Time', analytics.peakCheckInTime],
      ['Late Arrivals', `${analytics.lateCount} (${analytics.latePercentage}%)`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    styles: { fontSize: 9 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // Status Breakdown
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('Attendance Status Breakdown', 14, yPosition);
  yPosition += 8;

  const statusData = Object.entries(analytics.statusCounts).map(([status, count]) => [
    status.charAt(0).toUpperCase() + status.slice(1),
    count.toString(),
    `${analytics.statusPercentages[status]}%`
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Status', 'Count', 'Percentage']],
    body: statusData,
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    styles: { fontSize: 9, halign: 'center' },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // Check-In Time Distribution
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('Check-In Time Distribution', 14, yPosition);
  yPosition += 8;

  const checkInData = Object.entries(analytics.checkInTimes)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, count]) => [time, count.toString()]);

  if (checkInData.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Time Slot', 'Number of Check-Ins']],
      body: checkInData,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, halign: 'center' },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      styles: { fontSize: 9, halign: 'center' },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // Employee Statistics
  doc.addPage();
  yPosition = 20;
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('Employee Statistics', 14, yPosition);
  yPosition += 8;

  const empData = Object.entries(analytics.employeeStats).map(([name, stats]) => {
    const avgHours = stats.totalDays > 0 ? stats.totalHours / stats.totalDays : 0;
    return [
      name.substring(0, 25), // Truncate long names
      stats.totalDays.toString(),
      stats.present.toString(),
      stats.late.toString(),
      stats.absent.toString(),
      `${avgHours.toFixed(1)}h`
    ];
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Employee', 'Total Days', 'Present', 'Late', 'Absent', 'Avg Hours']],
    body: empData,
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 40, halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
    },
  });

  // Detailed Records
  doc.addPage();
  yPosition = 20;
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('Detailed Attendance Records', 14, yPosition);
  yPosition += 8;

  const detailData = data.map(record => {
    const empName = record.Employees?.name || 'Unknown';
    const date = formatDate(record.date);
    const checkIn = formatTime(record.check_in_time);
    const checkOut = formatTime(record.check_out_time);
    const status = record.status.charAt(0).toUpperCase() + record.status.slice(1);
    const hours = calculateHours(record);
    const hoursStr = hours > 0 ? `${hours.toFixed(1)}h` : '-';
    
    return [
      empName.substring(0, 20),
      date,
      checkIn,
      checkOut,
      status,
      hoursStr
    ];
  });

  // Split into chunks of 35 records per page
  const chunkSize = 35;
  for (let i = 0; i < detailData.length; i += chunkSize) {
    if (i > 0) {
      doc.addPage();
      yPosition = 20;
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text('Detailed Attendance Records (continued)', 14, yPosition);
      yPosition += 8;
    }

    const chunk = detailData.slice(i, i + chunkSize);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Employee', 'Date', 'Check In', 'Check Out', 'Status', 'Hours']],
      body: chunk,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      styles: { fontSize: 6, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 35, halign: 'left' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
      },
    });
  }

  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// POST endpoint
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await authenticateUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { startDate, endDate } = body;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Fetch attendance data based on role
    let attendanceData: AttendanceRecord[];
    
    if (user.role === 'admin') {
      // Admin sees all employees
      attendanceData = await db.attendance.findMany({
        where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {},
        include: {
          Employees: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { date: 'desc' },
          { Employees: { name: 'asc' } },
        ],
      });
    } else {
      // Employee sees only their own data
      attendanceData = await db.attendance.findMany({
        where: {
          employee_id: user.id,
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
        include: {
          Employees: {
            select: { id: true, name: true },
          },
        },
        orderBy: { date: 'desc' },
      });
    }

    if (attendanceData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No attendance records found for the selected period' },
        { status: 404 }
      );
    }

    // Calculate analytics
    const analytics = calculateAnalytics(attendanceData);

    // Generate PDF
    const pdfBuffer = generatePDF(
      attendanceData,
      analytics,
      { startDate, endDate },
      user.role === 'admin' ? 'All Employees' : user.name
    );

    // Return PDF
    const filename = `attendance_report_${new Date().toISOString().split('T')[0]}.pdf`;
    
  // Convert Node.js Buffer to ArrayBuffer
const arrayBuffer = pdfBuffer.buffer.slice(
  pdfBuffer.byteOffset,
  pdfBuffer.byteOffset + pdfBuffer.byteLength
) as ArrayBuffer;

return new NextResponse(arrayBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': pdfBuffer.length.toString(),
  },
});


  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}