'use client';
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AttendanceRecord } from './reportType';

interface ReportsTableProps {
  data: AttendanceRecord[];
}

const ReportsTable: React.FC<ReportsTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div>No records to display</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present':
        return 'bg-green-500 hover:bg-green-600';
      case 'absent':
        return 'bg-red-500 hover:bg-red-600';
      case 'late':
        return 'bg-yellow-500 hover:bg-yellow-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Function to calculate hours worked
  const calculateHoursWorked = (checkInTime: string | Date | null | undefined, checkOutTime: string | Date | null | undefined, date: string) => {
    if (!checkInTime) return '-';
    
    // Convert to string if it's a Date object
    const checkInStr = checkInTime instanceof Date ? checkInTime.toISOString() : checkInTime;
    const checkOutStr = checkOutTime instanceof Date ? checkOutTime.toISOString() : checkOutTime;
    
    // Check if it's today's date
    const recordDate = new Date(date).toDateString();
    const today = new Date().toDateString();
    const isToday = recordDate === today;
    
    // If not checked out yet and it's today, calculate from checkIn to current time
    const checkIn = new Date(checkInStr);
    const checkOut = checkOutStr ? new Date(checkOutStr) : (isToday ? new Date() : null);
    
    if (!checkOut) return '-';
    
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 0) return '-';
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    // If it's today and no checkOut, show it's ongoing
    if (!checkOutTime && isToday) {
      return `${hours}h ${minutes}m *`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  // Function to get hours worked styling
  const getHoursStyle = (checkInTime: string | Date | null | undefined, checkOutTime: string | Date | null | undefined, date: string) => {
    const recordDate = new Date(date).toDateString();
    const today = new Date().toDateString();
    const isToday = recordDate === today;
    
    if (!checkOutTime && checkInTime && isToday) {
      return 'text-blue-600 font-semibold'; // Ongoing work
    }
    return 'text-gray-700'; // Completed or no work
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time In</TableHead>
            <TableHead>Time Out</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Hours Worked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-medium">{record.employee_id}</TableCell>
              <TableCell>{record.Employees?.name || '-'}</TableCell>
              <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
              <TableCell>
                {record.check_in_time
                  ? new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '-'}
              </TableCell>
              <TableCell>
                {record.check_out_time
                  ? new Date(record.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '-'}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(record.status)}>
                  {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-mono">
            <span className={getHoursStyle(record.check_in_time, record.check_out_time, record.date instanceof Date ? record.date.toISOString() : record.date)}>
  {calculateHoursWorked(record.check_in_time, record.check_out_time, record.date instanceof Date ? record.date.toISOString() : record.date)}
</span>
                {!record.check_out_time && record.check_in_time && 
                 new Date(record.date).toDateString() === new Date().toDateString() && (
                  <span className="text-xs text-blue-500 ml-1">(ongoing)</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportsTable;