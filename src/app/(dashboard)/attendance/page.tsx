'use client';
import { useEffect, useState } from "react";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { Toast } from "@/components/ui/toast";

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
  sessions?: AttendanceSession[];
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

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
        const adminEmployees = response.attendanceData.map((record: any) => ({
          id: record.Employees?.id.toString() || record.employee_id.toString(),
          name: record.Employees?.name || "Unknown",
          date: record.date,
          timeIn: record.check_in_time,
          timeOut: record.check_out_time,
          status: record.status.toLowerCase() as 'present' | 'absent' | 'late',
          sessions: record.sessions || []
        }));
        setEmployees(adminEmployees);

        if (response.autoProcessed && (response.autoProcessed.autoCheckouts > 0 || response.autoProcessed.absentRecords > 0)) {
          Toast({
            title: `Auto-processed: ${response.autoProcessed.autoCheckouts} checkouts, ${response.autoProcessed.absentRecords} absences`,
            variant: "default",
          });
        }
      } else if (user.role === "employee") {
        const employeeRecords = response.attendanceData.map((record: any) => ({
          id: record.employee_id.toString(),
          name: user.name,
          date: record.date,
          timeIn: record.check_in_time,
          timeOut: record.check_out_time,
          status: record.status.toLowerCase() as 'present' | 'absent' | 'late',
          sessions: record.sessions || []
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

  // Pagination calculations
  const totalPages = Math.ceil(employees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmployees = employees.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

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

          {/* Pagination Controls - Top */}
          {employees.length > 0 && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="itemsPerPage" className="text-sm text-gray-600">
                  Show:
                </label>
                <select
                  id="itemsPerPage"
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-600">
                  entries
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, employees.length)} of {employees.length} records
              </div>
            </div>
          )}

          <EmployeeTable employees={currentEmployees} />

          {/* Pagination Controls - Bottom */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>

              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page as number)}
                    className={`px-3 py-1 border rounded text-sm ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Attendance;