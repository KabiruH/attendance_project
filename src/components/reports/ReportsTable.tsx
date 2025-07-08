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

// Add sessions support interface
interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

interface ReportsTableProps {
  data: AttendanceRecord[];
}

const ReportsTable: React.FC<ReportsTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div>No records to display</div>;
  }

  // Helper function to safely parse sessions from data
  const parseSessionsFromData = (record: AttendanceRecord): AttendanceSession[] => {
    // If sessions data exists, use it
    if (record.sessions && Array.isArray(record.sessions)) {
      return record.sessions;
    }
    
    // Fallback: Convert old format to sessions format
    if (record.check_in_time) {
      return [{
        check_in: record.check_in_time instanceof Date ? record.check_in_time.toISOString() : record.check_in_time,
        check_out: record.check_out_time 
          ? (record.check_out_time instanceof Date ? record.check_out_time.toISOString() : record.check_out_time)
          : null
      }];
    }
    
    return [];
  };

  // Helper function to check if record has active session
  const hasActiveSession = (record: AttendanceRecord): boolean => {
    const sessions = parseSessionsFromData(record);
    
    // Check for active session in sessions data
    if (sessions.length > 0) {
      return sessions.some((session: AttendanceSession) => 
        session.check_in && !session.check_out
      );
    }
    
    return false;
  };

  // UPDATED: Function to calculate hours worked using sessions (same logic as other components)
  const calculateHoursWorked = (record: AttendanceRecord): string => {
    const sessions = parseSessionsFromData(record);
    
    // If sessions data exists, use that (new format)
    if (sessions.length > 0) {
      let totalMinutes = 0;
      let hasActiveSession = false;
      
      sessions.forEach((session: AttendanceSession) => {
        if (session.check_in) {
          const checkIn = new Date(session.check_in);
          const checkOut = session.check_out ? new Date(session.check_out) : new Date();
          
          if (!session.check_out) hasActiveSession = true;
          
          const diffInMs = checkOut.getTime() - checkIn.getTime();
          const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
          totalMinutes += diffInMinutes;
        }
      });
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      if (hasActiveSession) {
        return `${hours}h ${minutes}m *`; // Show ongoing for active sessions
      }
      return `${hours}h ${minutes}m`;
    }
    
    // Fallback to old format for backward compatibility
    if (!record.check_in_time) return '-';
    
    // Convert to string if it's a Date object
    const checkInStr = record.check_in_time instanceof Date ? record.check_in_time.toISOString() : record.check_in_time;
    const checkOutStr = record.check_out_time instanceof Date ? record.check_out_time.toISOString() : record.check_out_time;
    
    // Check if it's today's date
    const recordDate = new Date(record.date).toDateString();
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
    if (!record.check_out_time && isToday) {
      return `${hours}h ${minutes}m *`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  // UPDATED: Function to get hours worked styling using sessions
  const getHoursStyle = (record: AttendanceRecord): string => {
    // Check if has active session using sessions-aware logic
    if (hasActiveSession(record)) {
      return 'text-blue-600 font-semibold'; // Ongoing work
    }
    return 'text-gray-700'; // Completed or no work
  };

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
                <span className={getHoursStyle(record)}>
                  {calculateHoursWorked(record)}
                </span>
                {hasActiveSession(record) && (
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