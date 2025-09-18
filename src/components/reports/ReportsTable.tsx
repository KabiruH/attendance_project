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

  // Helper function to get 6PM cutoff time for a given date (updated from 5PM to 6PM)
  const getSixPMCutoff = (date: Date): Date => {
    const cutoff = new Date(date);
    cutoff.setHours(18, 0, 0, 0); // Set to 6:00 PM
    return cutoff;
  };

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

  // Helper function to check if a session should be considered ongoing
  const isSessionOngoing = (session: AttendanceSession, currentTime: Date): boolean => {
    if (!session.check_in || session.check_out) return false;
    
    const checkInTime = new Date(session.check_in);
    const sixPM = getSixPMCutoff(checkInTime);
    
    // If current time is past 6PM on the same day, session should not be ongoing
    return currentTime < sixPM;
  };

  // Helper function to check if record has active session
  const hasActiveSession = (record: AttendanceRecord): boolean => {
    const currentTime = new Date();
    const sessions = parseSessionsFromData(record);
    
    // Check for active session in sessions data
    if (sessions.length > 0) {
      return sessions.some((session: AttendanceSession) => 
        isSessionOngoing(session, currentTime)
      );
    }
    
    // Fallback to old format
    const recordDate = new Date(record.date).toDateString();
    const today = new Date().toDateString();
    const isToday = recordDate === today;
    
    if (!record.check_in_time || record.check_out_time || !isToday) return false;
    
    const checkInTime = new Date(record.check_in_time);
    const sixPM = getSixPMCutoff(checkInTime);
    
    return currentTime < sixPM;
  };

  // UPDATED: Function to calculate hours worked with 6PM auto-stop
  const calculateHoursWorked = (record: AttendanceRecord): string => {
    const currentTime = new Date();
    const sessions = parseSessionsFromData(record);
    
    // If sessions data exists, use that (new format)
    if (sessions.length > 0) {
      let totalMinutes = 0;
      let hasOngoingSession = false;
      
      sessions.forEach((session: AttendanceSession) => {
        if (session.check_in) {
          const checkIn = new Date(session.check_in);
          const sixPM = getSixPMCutoff(checkIn);
          
          let effectiveCheckOut: Date;
          
          if (session.check_out) {
            // Use the actual check-out time, but cap it at 6PM
            const actualCheckOut = new Date(session.check_out);
            effectiveCheckOut = actualCheckOut > sixPM ? sixPM : actualCheckOut;
          } else {
            // No check-out time
            if (currentTime >= sixPM) {
              // Past 6PM, use 6PM as effective check-out
              effectiveCheckOut = sixPM;
            } else {
              // Before 6PM, session is ongoing
              effectiveCheckOut = currentTime;
              hasOngoingSession = true;
            }
          }
          
          // Calculate minutes worked for this session
          const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
          const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
          totalMinutes += diffInMinutes;
        }
      });
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      return hasOngoingSession ? `${hours}h ${minutes}m *` : `${hours}h ${minutes}m`;
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
    
    const checkIn = new Date(checkInStr);
    const sixPM = getSixPMCutoff(checkIn);
    
    let effectiveCheckOut: Date;
    let isOngoing = false;
    
    if (checkOutStr) {
      // Use the actual check-out time, but cap it at 6PM
      const actualCheckOut = new Date(checkOutStr);
      effectiveCheckOut = actualCheckOut > sixPM ? sixPM : actualCheckOut;
    } else if (isToday) {
      // If not checked out yet and it's today
      if (currentTime >= sixPM) {
        // Past 6PM, use 6PM as effective check-out
        effectiveCheckOut = sixPM;
      } else {
        // Before 6PM, session is ongoing
        effectiveCheckOut = currentTime;
        isOngoing = true;
      }
    } else {
      return '-';
    }
    
    // Only calculate if check-out is after check-in
    if (effectiveCheckOut <= checkIn) return '-';
    
    const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    return isOngoing ? `${hours}h ${minutes}m *` : `${hours}h ${minutes}m`;
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

  const formatTime = (timeStr: string | Date | null | undefined) => {
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
  };

  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-KE', {
        timeZone: 'Africa/Nairobi'
      });
    } catch {
      return typeof dateStr === 'string' ? dateStr : '-';
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
              <TableCell>{formatDate(record.date)}</TableCell>
              <TableCell>{formatTime(record.check_in_time)}</TableCell>
              <TableCell>{formatTime(record.check_out_time)}</TableCell>
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