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
import { cn } from '@/lib/utils';
import type { AttendanceRecord, FilterState } from '@/components/reports/reportType';
import { useToast } from "@/components/ui/use-toast";

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

  // Authenticate user and fetch attendance data
  const authenticateAndFetchAttendance = async () => {
    try {
      const authResponse = await fetch("/api/auth/check", { 
        method: "GET",
        credentials: 'include'  // Add this
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
        credentials: 'include',  // Add this
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (!attendanceResponse.ok) {
        throw new Error("Failed to fetch attendance data");
      }
  
      const data = await attendanceResponse.json();
  
      if (user.role === "admin") {
        const processedData = data.attendanceData.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          date: new Date(record.date).toISOString().split('T')[0], // Format date
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          status: record.status.toLowerCase(),
          Employees: {
            name: record.Employees?.name || record.employee_name // Handle both possible structures
          }
        }));
        setAttendanceData(processedData);
      } else {
        const processedData = data.attendanceData.map((record: any) => ({
          id: record.id,
          employee_id: record.employee_id,
          date: new Date(record.date).toISOString().split('T')[0], // Format date
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          status: record.status.toLowerCase(),
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

  const exportToCSV = () => {
    const headers = ['Employee ID', 'Employee Name', 'Date', 'Time In', 'Time Out', 'Status'];
    const csvData = filteredData.map(record => 
      [record.employee_id, record.Employees?.name, record.date, record.check_in_time, record.check_out_time, record.status]
    );
    
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
