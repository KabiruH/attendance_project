import { Button } from "@/components/ui/button";

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

interface ClassesTableProps {
  classes: Class[];
  onEdit: (classItem: Class) => void;
  onDeactivate: (classItem: Class) => void;
}

export default function ClassesTable({ classes, onEdit, onDeactivate }: ClassesTableProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-12 px-4 text-left align-middle font-medium">Class Name</th>
            <th className="h-12 px-4 text-left align-middle font-medium">Code</th>
            <th className="h-12 px-4 text-left align-middle font-medium">Department</th>
            <th className="h-12 px-4 text-left align-middle font-medium">Duration (hrs)</th>
            <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
            <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classItem) => (
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
      {classes.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No classes found. Add your first class to get started.
        </div>
      )}
    </div>
  );
}