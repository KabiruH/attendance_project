import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, Building, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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

interface ClassSelectionProps {
  userId: number;
  onSelectionSaved?: () => void;
  searchTerm?: string;
  onClassesLoaded?: (classes: Class[]) => void;
}

export default function ClassSelection({ 
  userId, 
  onSelectionSaved, 
  searchTerm = '',
  onClassesLoaded 
}: ClassSelectionProps) {
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [savedClassIds, setSavedClassIds] = useState<number[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Get unique departments sorted alphabetically
  const departments = useMemo(() => {
    const uniqueDepts = Array.from(new Set(availableClasses.map(c => c.department)));
    return uniqueDepts.sort((a, b) => a.localeCompare(b));
  }, [availableClasses]);

  // Filter and sort classes
  const filteredClasses = useMemo(() => {
    let filtered = availableClasses;

    // Filter by department
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(c => c.department === selectedDepartment);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(classItem => 
        classItem.name.toLowerCase().includes(term) ||
        classItem.code.toLowerCase().includes(term) ||
        classItem.term.toLowerCase().includes(term)
      );
    }

    // Sort by code alphabetically
    return [...filtered].sort((a, b) => a.code.localeCompare(b.code));
  }, [availableClasses, searchTerm, selectedDepartment]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDepartment, filteredClasses.length]);

  // Fetch available classes and user's current assignments
  useEffect(() => {
    fetchClassesAndAssignments();
  }, [userId]);

  // Send classes to parent when they're loaded
  useEffect(() => {
    if (availableClasses.length > 0) {
      onClassesLoaded?.(availableClasses);
    }
  }, [availableClasses, onClassesLoaded]);

  const fetchClassesAndAssignments = async () => {
    try {
      setIsLoading(true);
      
      const classesResponse = await fetch('/api/classes?active_only=true');
      if (!classesResponse.ok) throw new Error('Failed to fetch classes');
      const classes = await classesResponse.json();
      
      let assignedClassIds: number[] = [];
      
      try {
        const assignmentsResponse = await fetch(`/api/trainers/${userId}/assignments`);
        if (assignmentsResponse.ok) {
          const assignments = await assignmentsResponse.json();
          assignedClassIds = assignments.map((assignment: any) => assignment.class_id);
        } else {
          console.warn(`Failed to fetch assignments for user ${userId}: ${assignmentsResponse.status}`);
        }
      } catch (assignmentError) {
        console.warn('Error fetching assignments:', assignmentError);
      }
      
      setAvailableClasses(classes);
      setSelectedClassIds(assignedClassIds);
      setSavedClassIds(assignedClassIds);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassToggle = (classId: number, checked: boolean) => {
    const newSelectedIds = checked 
      ? [...selectedClassIds, classId]
      : selectedClassIds.filter(id => id !== classId);
    
    setSelectedClassIds(newSelectedIds);
  };

  const handleSaveSelections = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const combinedClassIds = [...new Set([...savedClassIds, ...selectedClassIds])];
            
      const response = await fetch(`/api/trainers/${userId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_ids: combinedClassIds
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('API Error:', result);
        throw new Error(result.error || 'Failed to save selections');
      }

      setSavedClassIds(combinedClassIds);
      setSelectedClassIds(combinedClassIds);

      setSuccessMessage(`Successfully updated class assignments! You are now assigned to ${combinedClassIds.length} classes.`);
      
      onSelectionSaved?.();
      
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Save selections error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save selections');
    } finally {
      setIsSaving(false);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const clearDepartmentFilter = () => {
    setSelectedDepartment('all');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Select Your Classes</h2>
          <p className="text-muted-foreground">
            Choose the classes you want to teach. You can check attendance only for selected classes.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedClassIds.length} of {availableClasses.length} classes selected
        </div>
      </div>

      {/* Department Filter */}
      <div className="flex items-center gap-2">
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedDepartment !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearDepartmentFilter}
            className="h-9"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {(searchTerm || selectedDepartment !== 'all') && (
          <div className="text-sm text-muted-foreground ml-2">
            Showing {filteredClasses.length} of {availableClasses.length} classes
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Save Button - Top */}
      {filteredClasses.length > 0 && (
        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleSaveSelections}
            disabled={isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? 'Saving...' : 'Save Selection'}
          </Button>
        </div>
      )}

      {/* Classes Grid */}
      {paginatedClasses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedClasses.map((classItem) => {
            const isSelected = selectedClassIds.includes(classItem.id);
            const isAlreadySaved = savedClassIds.includes(classItem.id);
            const isNewlySelected = isSelected && !isAlreadySaved;
            
            return (
              <Card 
                key={classItem.id} 
                className={`cursor-pointer transition-all ${
                  isAlreadySaved
                    ? 'ring-2 ring-green-500 bg-green-50/50'
                    : isNewlySelected 
                      ? 'ring-2 ring-blue-500 bg-blue-50/50'
                      : 'hover:shadow-md'
                }`}
                onClick={() => handleClassToggle(classItem.id, !isSelected)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox 
                          checked={isSelected}
                          onChange={() => {}}
                        />
                        <Badge variant="outline" className="text-xs">
                          {classItem.code}
                        </Badge>
                        {isAlreadySaved && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Saved
                          </Badge>
                        )}
                        {isNewlySelected && (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            New
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">{classItem.name}</CardTitle>
                    </div>
                  </div>
                  {classItem.description && (
                    <CardDescription className="text-sm">
                      {classItem.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      {classItem.department}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {classItem.duration_hours}h
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* No results messages */}
      {(searchTerm || selectedDepartment !== 'all') && filteredClasses.length === 0 && availableClasses.length > 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No classes match your filters</p>
          <p className="text-sm">Try adjusting your search or department filter</p>
        </div>
      )}

      {availableClasses.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No classes available yet.</p>
          <p className="text-sm">Contact your administrator to add classes.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredClasses.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredClasses.length)} of {filteredClasses.length} classes
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
            {totalPages > 1 && (
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
            )}
          </div>
        </div>
      )}

      {/* Save Button - Bottom */}
      {filteredClasses.length > 0 && (
        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleSaveSelections}
            disabled={isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? 'Saving...' : 'Save Selection'}
          </Button>
        </div>
      )}
    </div>
  );
}