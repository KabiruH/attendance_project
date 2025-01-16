'use client';
import React, { useState, useMemo } from 'react';
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

// Sample data remains the same
const sampleData: AttendanceRecord[] = [
  {
    id: '1',
    employeeId: 'EMP001',
    employeeName: 'John Doe',
    date: '2025-01-16',
    timeIn: '09:00 AM',
    timeOut: '05:00 PM',
    status: 'present',
  },
  {
    id: '2',
    employeeId: 'EMP002',
    employeeName: 'Jane Smith',
    date: '2025-01-16',
    timeIn: '09:30 AM',
    timeOut: '05:30 PM',
    status: 'late',
  },
];

const ITEMS_PER_PAGE = 10;

export default function ReportsPage() {
  const [filters, setFilters] = useState<FilterState>({
    employeeName: '',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    return sampleData.filter((record) => {
      const nameMatch = record.employeeName
        .toLowerCase()
        .includes(filters.employeeName.toLowerCase());
      const statusMatch =
        filters.status === 'all' || record.status === filters.status;
      
      const dateMatch = (!filters.startDate || record.date >= filters.startDate) &&
        (!filters.endDate || record.date <= filters.endDate);

      return nameMatch && statusMatch && dateMatch;
    });
  }, [filters]);

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
      [record.employeeId, record.employeeName, record.date, record.timeIn, record.timeOut, record.status]
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
      
      <ReportsTable data={paginatedData} />
      
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