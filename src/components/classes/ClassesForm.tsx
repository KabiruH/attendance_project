import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

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

interface ClassesFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingClass: Class | null;
  onSave: (formData: any) => Promise<void>;
  isSubmitting: boolean;
  error: string;
}

export default function ClassesForm({ 
  isOpen, 
  onClose, 
  editingClass, 
  onSave, 
  isSubmitting, 
  error 
}: ClassesFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    department: '',
    duration_hours: 2,
    is_active: true
  });

  // Reset form when dialog opens/closes or editing class changes
  useEffect(() => {
    if (isOpen) {
      if (editingClass) {
        setFormData({
          name: editingClass.name,
          code: editingClass.code,
          description: editingClass.description || '',
          department: editingClass.department,
          duration_hours: editingClass.duration_hours,
          is_active: editingClass.is_active
        });
      } else {
        setFormData({
          name: '',
          code: '',
          description: '',
          department: '',
          duration_hours: 2,
          is_active: true
        });
      }
    }
  }, [isOpen, editingClass]);

  const handleSubmit = async () => {
    await onSave(formData);
  };

  const handleClose = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      department: '',
      duration_hours: 2,
      is_active: true
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Class Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Digital Marketing Fundamentals"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Class Code</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., DM101"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the class"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => setFormData({ ...formData, department: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Human Resources">Human Resources</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Customer Service">Customer Service</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
                <SelectItem value="Administration">Administration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (Hours)</Label>
            <Select
              value={formData.duration_hours.toString()}
              onValueChange={(value) => setFormData({ ...formData, duration_hours: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="3">3 hours</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {editingClass && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onValueChange={(value) => setFormData({ ...formData, is_active: value === 'active' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Saving...' : editingClass ? 'Update Class' : 'Create Class'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}