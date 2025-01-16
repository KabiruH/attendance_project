'use client';

import EmployeeTable from "@/components/employees/EmployeeTable";

// Sample data - replace with your actual data source
interface Employee {
    id: string;
    name: string;
    timeIn: string | null; // Allow null for timeIn and timeOut
    timeOut: string | null;
    status: "present" | "late" | "absent"; 
  }

  const sampleEmployees: Employee[] = [
    {
      id: "EMP001",
      name: "John Doe",
      timeIn: "09:00 AM",
      timeOut: "05:00 PM",
      status: "present" 
    },
    {
      id: "EMP002",
      name: "Jane Smith",
      timeIn: "09:30 AM",
      timeOut: null,
      status: "late" 
    },
    {
      id: "EMP003",
      name: "Bob Johnson",
      timeIn: null,
      timeOut: null,
      status: "absent" 
    },
  ];

function Attendance() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mt-11 mb-6">Employee Attendance</h1>
      <EmployeeTable employees={sampleEmployees} />
    </div>
  );
}

export default Attendance;