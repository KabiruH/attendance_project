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

const ITEMS_PER_PAGE = 50;

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
  const [showNotCheckedIn, setShowNotCheckedIn] = useState(false); // NEW: Toggle for not checked in filter
  const { toast } = useToast();

  // Helper function to get 6PM cutoff time for a given date
  const getSixPMCutoff = (date: Date): Date => {
    const cutoff = new Date(date);
    cutoff.setHours(18, 0, 0, 0); // 6:00 PM
    return cutoff;
  };

  // SIMPLIFIED: Helper function to check if employee has not checked in (Present status check)
  const isNotCheckedIn = (record: AttendanceRecord): boolean => {
    // Show records that are NOT "Present" (includes "Late", "Absent", "Not Checked In")
    return record.status.toLowerCase() !== 'present';
  };

  // Helper function to calculate hours from sessions (updated with 6PM cutoff)
  const calculateTotalHoursFromSessions = (sessions: AttendanceSession[]): number => {
    if (!sessions || sessions.length === 0) return 0;
    
    const currentTime = new Date();
    let totalMinutes = 0;
    
    sessions.forEach(session => {
      if (session.check_in) {
        const checkIn = new Date(session.check_in);
        const sixPM = getSixPMCutoff(checkIn);
        
        let effectiveCheckOut: Date;
        
        if (session.check_out) {
          // Use actual check-out time, but cap at 6PM
          const actualCheckOut = new Date(session.check_out);
          effectiveCheckOut = actualCheckOut > sixPM ? sixPM : actualCheckOut;
        } else {
          // No check-out time
          if (currentTime >= sixPM) {
            // Past 6PM, use 6PM as effective check-out
            effectiveCheckOut = sixPM;
          } else {
            // Before 6PM, use current time
            effectiveCheckOut = currentTime;
          }
        }
        
        const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
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
        // Include sessions data in admin mapping
        const processedData = data.attendanceData.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          date: new Date(record.date).toISOString().split('T')[0], // Format date
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          status: record.status.toLowerCase(),
          sessions: record.sessions || [], // Include sessions data
          Employees: {
            name: record.Employees?.name || record.employee_name // Handle both possible structures
          }
        }));
        setAttendanceData(processedData);
      } else {
        // Include sessions data in employee mapping
        const processedData = data.attendanceData.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          date: new Date(record.date).toISOString().split('T')[0], // Format date
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          status: record.status.toLowerCase(),
          sessions: record.sessions || [], // Include sessions data
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

  // SIMPLIFIED: Filtered data - no more virtual records needed
  const filteredData = useMemo(() => {
    const filtered = attendanceData.filter((record) => {
      const nameMatch = record.Employees?.name?.toLowerCase()
        .includes(filters.employeeName.toLowerCase()) ?? false;
      const statusMatch =
        filters.status === 'all' || record.status.toLowerCase() === filters.status.toLowerCase();
      const dateMatch =
        (!filters.startDate || record.date >= filters.startDate) &&
        (!filters.endDate || record.date <= filters.endDate);
      
      // NEW: Apply not-checked-in filter (shows anyone not "Present")
      const notCheckedInMatch = !showNotCheckedIn || isNotCheckedIn(record);
  
      return nameMatch && statusMatch && dateMatch && notCheckedInMatch;
    });

    // NEW: Sort by status priority when filter is active
    if (showNotCheckedIn) {
      return filtered.sort((a, b) => {
        // Define status priority: Late = 1, Not Checked In = 2, Absent = 3, Present = 4, Others = 5
        const getStatusPriority = (status: string) => {
          const normalizedStatus = status.toLowerCase();
          if (normalizedStatus === 'late') return 1;
          if (normalizedStatus === 'not checked in') return 2;
          if (normalizedStatus === 'absent') return 3;
          if (normalizedStatus === 'present') return 4;
          return 5;
        };

        const priorityA = getStatusPriority(a.status);
        const priorityB = getStatusPriority(b.status);

        // Sort by priority first
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // If same priority, sort by employee name
        return (a.Employees?.name || '').localeCompare(b.Employees?.name || '');
      });
    }

    return filtered;
  }, [filters, attendanceData, showNotCheckedIn]);
  
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
    setCurrentPage(1); // Reset to first page when filters change
  };

  // NEW: Toggle not-checked-in filter
  const toggleNotCheckedInFilter = () => {
    setShowNotCheckedIn(!showNotCheckedIn);
    setCurrentPage(1); // Reset to first page
  };

  // UPDATED: Helper function to calculate hours for export with 6PM cutoff
  const calculateHoursForExport = (record: AttendanceRecord): string => {
    const currentTime = new Date();
    
    // Use sessions data if available (new format)
    if (record.sessions && Array.isArray(record.sessions) && record.sessions.length > 0) {
      let totalMinutes = 0;
      let hasActiveSession = false;
      
      record.sessions.forEach((session: AttendanceSession) => {
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
              hasActiveSession = true;
            }
          }
          
          const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
          const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
          totalMinutes += diffInMinutes;
        }
      });
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      return hasActiveSession ? `${hours}h ${minutes}m (ongoing)` : `${hours}h ${minutes}m`;
    }
    
    // Fallback to old format
    if (!record.check_in_time) return '-';
    
    const recordDate = new Date(record.date).toDateString();
    const today = new Date().toDateString();
    const isToday = recordDate === today;
    
    // Convert to Date objects safely
    const checkIn = record.check_in_time instanceof Date ? record.check_in_time : new Date(record.check_in_time);
    const sixPM = getSixPMCutoff(checkIn);
    
    let effectiveCheckOut: Date;
    let isOngoing = false;
    
    if (record.check_out_time) {
      const actualCheckOut = record.check_out_time instanceof Date ? record.check_out_time : new Date(record.check_out_time);
      effectiveCheckOut = actualCheckOut > sixPM ? sixPM : actualCheckOut;
    } else if (isToday) {
      if (currentTime >= sixPM) {
        effectiveCheckOut = sixPM;
      } else {
        effectiveCheckOut = currentTime;
        isOngoing = true;
      }
    } else {
      return '-';
    }
    
    if (!effectiveCheckOut || isNaN(checkIn.getTime()) || isNaN(effectiveCheckOut.getTime())) return '-';
    
    const diffInMs = effectiveCheckOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    return isOngoing ? `${hours}h ${minutes}m (ongoing)` : `${hours}h ${minutes}m`;
  };

  const formatTimeForCSV = (timeStr: string | Date | null | undefined) => {
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

  const exportToCSV = () => {
    const headers = ['Employee ID', 'Employee Name', 'Date', 'Time In', 'Time Out', 'Status', 'Hours Worked'];
    const csvData = filteredData.map(record => [
      record.employee_id, 
      record.Employees?.name || '-', 
      record.date, 
      formatTimeForCSV(record.check_in_time), 
      formatTimeForCSV(record.check_out_time), 
      record.status,
      calculateHoursForExport(record) // Uses sessions-aware calculation with 6PM cutoff
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

  // Helper function to get visible page numbers for pagination
  const getVisiblePages = () => {
    const maxVisiblePages = 10;
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  // Render the component
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Attendance Reports</h1>
        <div className="flex gap-2">
          {/* NEW: Not Checked In Filter Button */}
          <Button 
            onClick={toggleNotCheckedInFilter} 
            variant={showNotCheckedIn ? "default" : "outline"}
            size="sm"
          >
            {showNotCheckedIn ? "Showing Late/Not Checked In" : "Show Late/Not Checked In"}
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
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
                className={cn(currentPage === 1 && "pointer-events-none opacity-50 cursor-not-allowed")}
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) {
                    setCurrentPage(prev => prev - 1);
                  }
                }}
                href="#"
              />
            </PaginationItem>

            {/* Show first page if not visible */}
            {getVisiblePages()[0] > 1 && (
              <>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(1);
                    }}
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
                {getVisiblePages()[0] > 2 && (
                  <PaginationItem>
                    <span className="px-4 py-2">...</span>
                  </PaginationItem>
                )}
              </>
            )}

            {/* Visible page numbers */}
            {getVisiblePages().map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(pageNum);
                  }}
                  isActive={currentPage === pageNum}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            ))}

            {/* Show last page if not visible */}
            {getVisiblePages()[getVisiblePages().length - 1] < totalPages && (
              <>
                {getVisiblePages()[getVisiblePages().length - 1] < totalPages - 1 && (
                  <PaginationItem>
                    <span className="px-4 py-2">...</span>
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(totalPages);
                    }}
                  >
                    {totalPages}
                  </PaginationLink>
                  </PaginationItem>
              </>
            )}

            <PaginationItem>
              <PaginationNext
                className={cn(currentPage === totalPages && "pointer-events-none opacity-50 cursor-not-allowed")}
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) {
                    setCurrentPage(prev => prev + 1);
                  }
                }}
                href="#"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}