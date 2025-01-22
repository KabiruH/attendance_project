'use client';

import { useEffect, useState } from "react";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { Toast } from "@/components/ui/toast"; // Assuming you have a toast component

interface Employee {
  id: string;
  name: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: "present" | "late" | "absent";
}

function Attendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Authenticate and fetch attendance data
  const authenticateAndFetchAttendance = async () => {
    try {
      // Authenticate user
      const authResponse = await fetch("/api/auth/check", { method: "GET" });

      if (!authResponse.ok) {
        throw new Error("Authentication failed");
      }

      const authData = await authResponse.json();
      const { user } = authData;

      setUserRole(user.role); // Set the user role (e.g., "admin" or "employee")

      // Fetch attendance data based on role
      const attendanceResponse = await fetch("/api/attendance", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authData.token}`,
          "Content-Type": "application/json",
        },
      });

      if (!attendanceResponse.ok) {
        throw new Error("Failed to fetch attendance data");
      }

      const attendanceData = await attendanceResponse.json();

      // Process data based on role
      if (user.role === "admin") {
        // Admin: View all employees
        const adminEmployees = attendanceData.attendanceData.map((record: any) => ({
          id: record.employee_id.toString(),
          name: record.Employees.name,
          date: record.date,
          timeIn: record.check_in_time,
          timeOut: record.check_out_time,
          status: record.status.toLowerCase() as 'present' | 'absent' | 'late',
        }));
        setEmployees(adminEmployees);
      } else if (user.role === "employee") {
        // Employee: View their own attendance
        const employeeRecords = attendanceData.attendanceData.map((record: any) => ({
          id: record.employee_id.toString(),
          name: user.name,  
          date: record.date,
          timeIn: record.check_in_time,
          timeOut: record.check_out_time,
          status: record.status.toLowerCase() as 'present' | 'absent' | 'late',
        }));
        setEmployees(employeeRecords);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      Toast({
        title: "Error",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Run authentication and fetch attendance on mount
  useEffect(() => {
    authenticateAndFetchAttendance();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mt-11 mb-6">Employee Attendance</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {userRole === "admin" && <p className="text-xl mb-4">Viewing all employees</p>}
          {userRole === "employee" && <p className="text-xl mb-4">Viewing your attendance</p>}
          <EmployeeTable employees={employees} />
        </div>
      )}
    </div>
  );
}

export default Attendance;
