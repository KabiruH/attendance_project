'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import Filters from '@/components/reports/Filters';
import ReportsTable from '@/components/reports/ReportsTable';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils/utils';
import type { AttendanceRecord, FilterState } from '@/components/reports/reportType';
import { useToast } from "@/components/ui/use-toast";

// Add sessions support interface
interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function ReportsPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    employeeName: '',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Helper function to calculate hours from sessions (same logic as other components)
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
    
    return totalMinutes / 60; // Convert to hours
  };

  // Authenticate user and fetch attendance data
  const authenticateAndFetchAttendance = async () => {
    try {
      const authResponse = await fetch("/api/auth/check", { 
        method: "GET",
        credentials: 'include'
      });
      if (!authResponse.ok) {
        throw new Error("Authentication failed");
      }
  
      const authData = await authResponse.json();
      const { user } = authData;
      setUserRole(user.role);
  
      // Fetch attendance data
      const attendanceResponse = await fetch("/api/attendance", {
        method: "GET",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (!attendanceResponse.ok) {
        throw new Error("Failed to fetch attendance data");
      }
  
      const data = await attendanceResponse.json();
  
      if (user.role === "admin") {
        // FIXED: Include sessions data in admin mapping
        const processedData = data.attendanceData.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          date: new Date(record.date).toISOString().split('T')[0], // Format date
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          status: record.status.toLowerCase(),
          sessions: record.sessions || [], // ADD THIS LINE - Include sessions data
          Employees: {
            name: record.Employees?.name || record.employee_name // Handle both possible structures
          }
        }));
        setAttendanceData(processedData);
      } else {
        // FIXED: Include sessions data in employee mapping
        const processedData = data.attendanceData.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          date: new Date(record.date).toISOString().split('T')[0], // Format date
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          status: record.status.toLowerCase(),
          sessions: record.sessions || [], // ADD THIS LINE - Include sessions data
          Employees: {
            name: user.name
          }
        }));
        setAttendanceData(processedData);
      }
  
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch attendance data",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    authenticateAndFetchAttendance();
  }, []);

  // Filtered and paginated data
  const filteredData = useMemo(() => {
    return attendanceData.filter((record) => {
      const nameMatch = record.Employees?.name?.toLowerCase()
        .includes(filters.employeeName.toLowerCase()) ?? false;
      const statusMatch =
        filters.status === 'all' || record.status.toLowerCase() === filters.status.toLowerCase();
      const dateMatch =
        (!filters.startDate || record.date >= filters.startDate) &&
        (!filters.endDate || record.date <= filters.endDate);
  
      return nameMatch && statusMatch && dateMatch;
    });
  }, [filters, attendanceData]);
  
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  };

  // UPDATED: Helper function to calculate hours for export using sessions
  const calculateHoursForExport = (record: AttendanceRecord): string => {
    // Use sessions data if available (new format)
    if (record.sessions && Array.isArray(record.sessions) && record.sessions.length > 0) {
      let totalMinutes = 0;
      let hasActiveSession = false;
      
      record.sessions.forEach((session: AttendanceSession) => {
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
    
    // Fallback to old format
    if (!record.check_in_time) return '-';
    
    const recordDate = new Date(record.date).toDateString();
    const today = new Date().toDateString();
    const isToday = recordDate === today;
    
    // Convert to Date objects safely
    const checkIn = record.check_in_time instanceof Date ? record.check_in_time : new Date(record.check_in_time);
    const checkOut = record.check_out_time 
      ? (record.check_out_time instanceof Date ? record.check_out_time : new Date(record.check_out_time))
      : (isToday ? new Date() : null);
    
    if (!checkOut || isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return '-';
    
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 0) return '-';
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  const exportToCSV = () => {
    const headers = ['Employee ID', 'Employee Name', 'Date', 'Time In', 'Time Out', 'Status', 'Hours Worked'];
    const csvData = filteredData.map(record => [
      record.employee_id, 
      record.Employees?.name || '-', 
      record.date, 
      record.check_in_time || '-', 
      record.check_out_time || '-', 
      record.status,
      calculateHoursForExport(record) // UPDATED: Use sessions-aware calculation
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Render the component
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Attendance Reports</h1>
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <Filters
        filters={filters}
        onFilterChange={handleFilterChange}
        resultCount={filteredData.length}
      />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <ReportsTable data={paginatedData} />
      )}

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                href="#"
              />
            </PaginationItem>

            {[...Array(totalPages)].map((_, index) => (
              <PaginationItem key={index + 1}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(index + 1);
                  }}
                  isActive={currentPage === index + 1}
                >
                  {index + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                href="#"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}