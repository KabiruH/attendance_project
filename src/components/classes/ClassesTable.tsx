import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Class {
  id: number;
  name: string;
  code: string;
  term: string;
  description?: string;
  department: string;
  duration_hours: number;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

interface ClassesTableProps {
  classes: Class[];
  onEdit: (classItem: Class) => void;
  onDeactivate: (classItem: Class) => void;
}

export default function ClassesTable({ classes, onEdit, onDeactivate }: ClassesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Sort classes by code alphabetically
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => a.code.localeCompare(b.code));
  }, [classes]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClasses = sortedClasses.slice(startIndex, endIndex);

  // Reset to page 1 when items per page changes or classes change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Reset to page 1 when classes array changes (e.g., after filtering)
  useMemo(() => {
    setCurrentPage(1);
  }, [classes.length]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-12 px-4 text-left align-middle font-medium">Class Name</th>
              <th className="h-12 px-4 text-left align-middle font-medium">Code</th>
              <th className="h-12 px-4 text-left align-middle font-medium">Department</th>
              <th className="h-12 px-4 text-left align-middle font-medium">Duration (hrs)</th>
              <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
              <th className="h-12 px-4 text-left align-middle font-medium">Term</th>
              <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClasses.map((classItem) => (
              <tr key={classItem.id} className="border-b">
                <td className="p-4 align-middle">
                  <div>
                    <div className="font-medium">{classItem.name}</div>
                    {classItem.description && (
                      <div className="text-sm text-muted-foreground">{classItem.description}</div>
                    )}
                  </div>
                </td>
                <td className="p-4 align-middle">
                  <code className="bg-muted px-2 py-1 rounded text-sm">{classItem.code}</code>
                </td>
                <td className="p-4 align-middle">{classItem.department}</td>
                <td className="p-4 align-middle">{classItem.duration_hours}h</td>
                <td className="p-4 align-middle">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    classItem.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {classItem.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 align-middle">{classItem.term}</td>
                <td className="p-4 align-middle">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(classItem)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeactivate(classItem)}
                      className="text-red-600 hover:text-red-700"
                    >
                      {classItem.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedClasses.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No classes found. Add your first class to get started.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {sortedClasses.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, sortedClasses.length)} of {sortedClasses.length} classes
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per page:</span>
              <div className="flex gap-1">
                <Button
                  variant={itemsPerPage === 50 ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleItemsPerPageChange(50)}
                >
                  50
                </Button>
                <Button
                  variant={itemsPerPage === 100 ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleItemsPerPageChange(100)}
                >
                  100
                </Button>
              </div>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}