//components/classes/classSelection.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, Building } from "lucide-react";

interface Class {
  id: number;
  name: string;
  code: string;
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
  searchTerm?: string; // Add search support
  onClassesLoaded?: (classes: Class[]) => void; // Callback to send classes to parent
}

export default function ClassSelection({ 
  userId, 
  onSelectionSaved, 
  searchTerm = '',
  onClassesLoaded 
}: ClassSelectionProps) {
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [savedClassIds, setSavedClassIds] = useState<number[]>([]); // Track what's actually saved
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filter classes based on search term
  const filteredClasses = useMemo(() => {
    if (!searchTerm.trim()) return availableClasses;
    
    const term = searchTerm.toLowerCase();
    return availableClasses.filter(classItem => 
      classItem.name.toLowerCase().includes(term) ||
      classItem.code.toLowerCase().includes(term) ||
      classItem.department.toLowerCase().includes(term)
    );
  }, [availableClasses, searchTerm]);

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
      
      // Fetch all active classes
      const classesResponse = await fetch('/api/classes?active_only=true');
      if (!classesResponse.ok) throw new Error('Failed to fetch classes');
      const classes = await classesResponse.json();
      
      let assignedClassIds: number[] = [];
      
      // Try to fetch user's current assignments, but don't fail if it doesn't work
      try {
        const assignmentsResponse = await fetch(`/api/trainers/${userId}/assignments`);
        if (assignmentsResponse.ok) {
          const assignments = await assignmentsResponse.json();
          assignedClassIds = assignments.map((assignment: any) => assignment.class_id);
        } else {
          console.warn(`Failed to fetch assignments for user ${userId}: ${assignmentsResponse.status}`);
          // Continue with empty assignments - user can still select classes
        }
      } catch (assignmentError) {
        console.warn('Error fetching assignments:', assignmentError);
        // Continue with empty assignments - user can still select classes
      }
      
      setAvailableClasses(classes);
      setSelectedClassIds(assignedClassIds); // Will be empty array if assignments failed
      setSavedClassIds(assignedClassIds); // Will be empty array if assignments failed
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
      // Combine currently selected with previously saved (additive behavior)
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

      // Update our saved state to match what was actually saved
      setSavedClassIds(combinedClassIds);
      setSelectedClassIds(combinedClassIds);

      setSuccessMessage(`Successfully updated class assignments! You are now assigned to ${combinedClassIds.length} classes.`);
      
      // Notify parent component that selection was saved (not just changed)
      onSelectionSaved?.();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Save selections error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save selections');
    } finally {
      setIsSaving(false);
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Select Your Classes</h2>
          <p className="text-muted-foreground">
            Choose the classes you want to teach. You can check attendance only for selected classes.
          </p>
          {searchTerm && (
            <p className="text-sm text-blue-600 mt-1">
              Showing {filteredClasses.length} of {availableClasses.length} classes for "{searchTerm}"
            </p>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedClassIds.length} of {availableClasses.length} classes selected
        </div>
      </div>

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

      {/* Classes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredClasses.map((classItem) => {
          const isSelected = selectedClassIds.includes(classItem.id);
          const isAlreadySaved = savedClassIds.includes(classItem.id);
          const isNewlySelected = isSelected && !isAlreadySaved;
          
          return (
            <Card 
              key={classItem.id} 
              className={`cursor-pointer transition-all ${
                isAlreadySaved
                  ? 'ring-2 ring-green-500 bg-green-50/50' // Already saved
                  : isNewlySelected 
                    ? 'ring-2 ring-blue-500 bg-blue-50/50' // Newly selected
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
                        onChange={() => {}} // Handled by card click
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

      {/* Handle case when search returns no results */}
      {searchTerm && filteredClasses.length === 0 && availableClasses.length > 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No classes match your search for "{searchTerm}"</p>
          <p className="text-sm">Try adjusting your search terms</p>
        </div>
      )}

      {/* Handle case when no classes available at all */}
      {availableClasses.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No classes available yet.</p>
          <p className="text-sm">Contact your administrator to add classes.</p>
        </div>
      )}

      {/* Save Button */}
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