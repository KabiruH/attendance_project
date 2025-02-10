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

interface Employee {
  id: string;
  name: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: 'present' | 'absent' | 'late';
}

interface EmployeeTableProps {
  employees: Employee[];
}

const EmployeeTable: React.FC<EmployeeTableProps> = ({ employees }) => {
  if (!employees || employees.length === 0) {
    return <div>No records to display</div>;
  }

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'present':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'absent':
        return 'bg-red-500 text-white hover:bg-red-600';
      case 'late':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      default:
        return 'bg-gray-500 text-white hover:bg-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    try {
      return new Date(timeStr).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timeStr || '-';
    }
  };

  return (
    <div className="overflow-auto rounded-md border">
      <Table className="min-w-[600px] md:w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Employee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="text-center">Time In</TableHead>
            <TableHead className="text-center">Time Out</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={`${employee.id}-${employee.date}`}>
              <TableCell className="font-medium">{employee.id}</TableCell>
              <TableCell>{employee.name}</TableCell>
              <TableCell>{formatDate(employee.date)}</TableCell>
              <TableCell className="text-center">{formatTime(employee.timeIn)}</TableCell>
              <TableCell className="text-center">{formatTime(employee.timeOut)}</TableCell>
              <TableCell className="text-center">
                <Badge className={`${getStatusColor(employee.status)} px-3 py-1`}>
                  {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EmployeeTable;