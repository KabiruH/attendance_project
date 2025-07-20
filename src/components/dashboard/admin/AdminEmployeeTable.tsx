// components/dashboard/admin/AdminEmployeeTable.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, RefreshCw, Download } from 'lucide-react';

interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  sessions?: AttendanceSession[];
}

const AdminEmployeeTable: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAttendanceData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/attendance/status', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const today = new Date().toDateString();
        const todayAttendance = (data.attendanceData || []).filter((record: AttendanceRecord) => 
          new Date(record.date).toDateString() === today
        ).sort((a: AttendanceRecord, b: AttendanceRecord) => {
          // Sort by check-in time, with those who haven't checked in at the bottom
          if (!a.check_in_time && !b.check_in_time) return 0;
          if (!a.check_in_time) return 1;
          if (!b.check_in_time) return -1;
          
          const timeA = new Date(a.check_in_time).getTime();
          const timeB = new Date(b.check_in_time).getTime();
          return timeA - timeB; // Earliest first
        });

        setAttendanceData(todayAttendance);
        setFilteredData(todayAttendance);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter data based on search term and status
  useEffect(() => {
    let filtered = attendanceData;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record =>
        record.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredData(filtered);
  }, [searchTerm, statusFilter, attendanceData]);

  useEffect(() => {
    fetchAttendanceData();
    const interval = setInterval(fetchAttendanceData, 600000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalHoursFromSessions = (sessions: AttendanceSession[]): number => {
    if (!sessions || sessions.length === 0) return 0;
    
    let totalMinutes = 0;
    sessions.forEach(session => {
      if (session.check_in) {
        const checkIn = new Date(session.check_in);
        const checkOut = session.check_out ? new Date(session.check_out) : new Date();
        const diffInMs = checkOut.getTime() - checkIn.getTime();
        const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
        totalMinutes += diffInMinutes;
      }
    });
    
    return totalMinutes / 60;
  };

  const hasActiveSession = (attendance: AttendanceRecord): boolean => {
    if (attendance.sessions && Array.isArray(attendance.sessions)) {
      return attendance.sessions.some((s: AttendanceSession) => s.check_in && !s.check_out);
    }
    return !!(attendance.check_in_time && !attendance.check_out_time);
  };

  const calculateHoursWorked = (attendance: AttendanceRecord): string => {
    if (attendance.sessions && attendance.sessions.length > 0) {
      let totalMinutes = 0;
      let hasActiveSession = false;
      
      attendance.sessions.forEach((session: AttendanceSession) => {
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
        return `${hours}h ${minutes}m *`;
      }
      return `${hours}h ${minutes}m`;
    }
    
    // Fallback to old format
    if (!attendance.check_in_time) return '-';
    
    const checkIn = new Date(attendance.check_in_time);
    const checkOut = attendance.check_out_time ? new Date(attendance.check_out_time) : new Date();
    
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 0) return '-';
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    if (!attendance.check_out_time) {
      return `${hours}h ${minutes}m *`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const exportToCSV = () => {
    const csvData = filteredData.map(record => ({
      'Employee Name': record.employee_name,
      'Check In': formatTime(record.check_in_time),
      'Check Out': formatTime(record.check_out_time),
      'Status': record.status,
      'Hours Worked': calculateHoursWorked(record).replace(' *', ' (ongoing)')
    }));

    const csvContent = "data:text/csv;charset=utf-8," 
      + Object.keys(csvData[0]).join(",") + "\n"
      + csvData.map(row => Object.values(row).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <CardTitle className="text-white">Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Today's Attendance ({filteredData.length})
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAttendanceData}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportToCSV}
              className="text-white hover:bg-white/20"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-white"
          >
            <option value="all">All Status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>
        </div>

        {/* Attendance Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No attendance records found</p>
              {searchTerm && <p className="text-sm">Try adjusting your search criteria</p>}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <div className="min-w-full">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-200 p-4">
                  <div className="grid grid-cols-5 gap-4 font-semibold text-sm text-gray-700">
                    <div>Employee Name</div>
                    <div>Check In</div>
                    <div>Check Out</div>
                    <div>Status</div>
                    <div>Hours Worked</div>
                  </div>
                </div>
                
                {/* Body */}
                <div className="divide-y divide-gray-200">
                  {filteredData.map((attendance) => (
                    <div key={attendance.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
                      <div className="grid grid-cols-5 gap-4 items-center">
                        <div className="font-medium text-gray-900">
                          {attendance.employee_name}
                        </div>
                        <div className="text-gray-700">
                          {formatTime(attendance.check_in_time)}
                        </div>
                        <div className="text-gray-700">
                          {formatTime(attendance.check_out_time)}
                        </div>
                        <div>
                          <Badge className={`${
                            attendance.status.toLowerCase() === 'present' ? 'bg-green-500 hover:bg-green-600' :
                            attendance.status.toLowerCase() === 'late' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600'
                          } transition-colors duration-200`}>
                            {attendance.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="font-mono">
                          <span className={`${
                            hasActiveSession(attendance) ? 'text-blue-600 font-semibold' : 'text-gray-700'
                          }`}>
                            {calculateHoursWorked(attendance)}
                          </span>
                          {hasActiveSession(attendance) && (
                            <span className="text-xs text-blue-500 ml-1">(ongoing)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
          <span>* indicates ongoing session</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminEmployeeTable;
