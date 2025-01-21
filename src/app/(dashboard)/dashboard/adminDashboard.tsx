import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AdminDashboardProps {
    data: unknown; // Use unknown if you don't know the type yet
  }

const AdminDashboard: React.FC<AdminDashboardProps> = ({ data }) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold">{data.attendanceData.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Present Today</p>
              <p className="text-2xl font-bold">
                {data.attendanceData.filter(a => 
                  new Date(a.date).toDateString() === new Date().toDateString() && 
                  (a.status === 'present' || a.status === 'late')
                ).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Late Today</p>
              <p className="text-2xl font-bold">
                {data.attendanceData.filter(a => 
                  new Date(a.date).toDateString() === new Date().toDateString() && 
                  a.status === 'late'
                ).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.attendanceData.map((attendance) => (
                <TableRow key={attendance.employee_id}>
                  <TableCell>{attendance.employee_name}</TableCell>
                  <TableCell>{formatTime(attendance.check_in_time)}</TableCell>
                  <TableCell>
                    {attendance.check_out_time ? formatTime(attendance.check_out_time) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      attendance.status === 'present' ? 'bg-green-500' :
                      attendance.status === 'late' ? 'bg-yellow-500' : 'bg-red-500'
                    }>
                      {attendance.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;