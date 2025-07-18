'use client';
import { useEffect, useState } from "react";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { Toast } from "@/components/ui/toast";

// UPDATED: Add sessions support to Employee interface
interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

interface Employee {
  id: string;
  name: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: "present" | "late" | "absent";
  sessions?: AttendanceSession[]; // ADD THIS LINE
}

interface AttendanceResponse {
  role: string;
  attendanceData: any[];
  autoProcessed?: {
    autoCheckouts: number;
    absentRecords: number;
  };
  isCheckedIn?: boolean;
}

function Attendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);

  const authenticateAndFetchAttendance = async () => {
    try {
      const authResponse = await fetch("/api/auth/check", { method: "GET" });
      if (!authResponse.ok) {
        throw new Error("Authentication failed");
      }

      const authData = await authResponse.json();
      const { user } = authData;
      setUserRole(user.role);

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

      const response: AttendanceResponse = await attendanceResponse.json();

      if (user.role === "admin") {
        // FIXED: Include sessions data in admin mapping
        const adminEmployees = response.attendanceData.map((record: any) => ({
          id: record.Employees?.id.toString() || record.employee_id.toString(),
          name: record.Employees?.name || "Unknown",
          date: record.date,
          timeIn: record.check_in_time,
          timeOut: record.check_out_time,
          status: record.status.toLowerCase() as 'present' | 'absent' | 'late',
          sessions: record.sessions || [] // ADD THIS LINE - Include sessions data
        }));
        setEmployees(adminEmployees);

        if (response.autoProcessed && (response.autoProcessed.autoCheckouts > 0 || response.autoProcessed.absentRecords > 0)) {
          Toast({
            title: `Auto-processed: ${response.autoProcessed.autoCheckouts} checkouts, ${response.autoProcessed.absentRecords} absences`,
            variant: "default",
          });
        }
      } else if (user.role === "employee") {
        // FIXED: Include sessions data in employee mapping
        const employeeRecords = response.attendanceData.map((record: any) => ({
          id: record.employee_id.toString(),
          name: user.name,
          date: record.date,
          timeIn: record.check_in_time,
          timeOut: record.check_out_time,
          status: record.status.toLowerCase() as 'present' | 'absent' | 'late',
          sessions: record.sessions || [] // ADD THIS LINE - Include sessions data
        }));
        setEmployees(employeeRecords);
        setIsCheckedIn(response.isCheckedIn || false);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      Toast({
        title: error instanceof Error ? error.message : "Failed to load attendance data",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

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
          {userRole === "employee" && (
            <div className="mb-4">
              <p className="text-xl">Viewing your attendance</p>
              <p className="text-sm text-gray-600">
                Status: {isCheckedIn ? "Checked In" : "Not Checked In"}
              </p>
            </div>
          )}
          <EmployeeTable employees={employees} />
        </div>
      )}
    </div>
  );
}

export default Attendance;