import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Building, Calendar, CheckCircle, XCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClassAssignment {
  id: number;
  class_id: number;
  assigned_at: string;
  class: {
    id: number;
    name: string;
    code: string;
    description?: string;
    department: string;
    duration_hours: number;
  };
  lastAttendance?: {
    date: string;
    check_in_time: string;
    status: string;
  };
  totalSessions?: number;
}

interface MyClassesProps {
  userId: number;
  showRemoveOption?: boolean;
  onClassRemoved?: () => void;
}

export default function MyClasses({ userId, showRemoveOption = true, onClassRemoved }: MyClassesProps) {
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingClassId, setRemovingClassId] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    fetchMyClasses();
  }, [userId]);

  const fetchMyClasses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/trainers/${userId}/my-classes`);
      if (!response.ok) throw new Error('Failed to fetch assigned classes');
      const data = await response.json();
      setAssignments(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load classes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveClass = (classId: number) => {
    setRemovingClassId(classId);
  };

  const confirmRemoveClass = async () => {
    if (!removingClassId) return;

    setIsRemoving(true);
    try {
      const response = await fetch(`/api/trainers/${userId}/assignments/${removingClassId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove class assignment');
      }

      await fetchMyClasses();
      
      // Notify parent component that a class was removed
      onClassRemoved?.();
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to remove class');
    } finally {
      setIsRemoving(false);
      setRemovingClassId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <h2 className="text-xl font-semibold">My Classes</h2>
          <p className="text-muted-foreground">
            Classes you're currently assigned to teach
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {assignments.length} {assignments.length === 1 ? 'Class' : 'Classes'}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Classes Assigned</h3>
            <p className="text-muted-foreground mb-4">
              You haven't selected any classes to teach yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Use the "Select Your Classes" section above to choose classes you want to teach.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {assignment.class.code}
                      </Badge>
                      {assignment.lastAttendance && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <CardTitle className="text-base">{assignment.class.name}</CardTitle>
                  </div>
                  {showRemoveOption && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveClass(assignment.class_id)}
                      className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {assignment.class.description && (
                  <CardDescription className="text-sm">
                    {assignment.class.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {assignment.class.department}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {assignment.class.duration_hours}h
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-muted-foreground mb-2">
                    Assigned: {formatDate(assignment.assigned_at)}
                  </div>
                  
                  {assignment.lastAttendance ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Last attended
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(assignment.lastAttendance.date)} at {formatTime(assignment.lastAttendance.check_in_time)}
                      </div>
                      {assignment.totalSessions && (
                        <div className="text-xs text-muted-foreground">
                          Total sessions: {assignment.totalSessions}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-amber-600">
                      <XCircle className="h-3 w-3" />
                      No attendance yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={!!removingClassId}
        onOpenChange={() => setRemovingClassId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Class Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove yourself from this class? You will no longer be able to check attendance for this class unless you reassign yourself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveClass}
              className="bg-red-600 hover:bg-red-700"
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}