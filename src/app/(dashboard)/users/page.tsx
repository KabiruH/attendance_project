'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Upload, Download } from "lucide-react";
import UsersTable from '@/components/users/users';
import * as XLSX from 'xlsx';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { User } from '@/lib/types/user';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    id_number: '',
    role: '',
    phone_number: '',
    gender: '',
    department: '',
    email: '',
    is_active: true
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  
  // Excel import states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      id_number: '',
      role: '',
      phone_number: '',
      gender: '',
      department: '',
      email: '',
      is_active: true
    });
    setError('');
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      id_number: user.id_number,
      role: user.role,
      phone_number: user.phone_number,
      gender: user.gender,
      department: user.department,
      email: user.email ?? '',
      is_active: user.is_active
    });
    setError('');
    setIsDialogOpen(true);
  };  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const url = '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const body = editingUser
        ? { ...formData, id: editingUser.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save user');
      }

      await fetchUsers();
      setIsDialogOpen(false);
      setFormData({
        name: '',
        id_number: '',
        role: '',
        phone_number: '',
        gender: '',
        department: '',
        email: '',
        is_active: true
      });
      setEditingUser(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (user: User) => {
    setDeactivatingUser(user);
  };

  const confirmDeactivate = async () => {
    if (!deactivatingUser) return;

    setIsDeactivating(true);
    try {
      const response = await fetch(`/api/users/deactivate/${deactivatingUser.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate user');
      }

      await fetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
    } finally {
      setIsDeactivating(false);
      setDeactivatingUser(null);
    }
  };

  // Excel import handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResults(null);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Find the sheet with actual data (skip Instructions sheet if present)
      let worksheet;
      const dataSheetIndex = workbook.SheetNames.findIndex(
        name => name.toLowerCase().includes('sample') || name.toLowerCase().includes('data') || name.toLowerCase() === 'users'
      );
      
      if (dataSheetIndex !== -1) {
        worksheet = workbook.Sheets[workbook.SheetNames[dataSheetIndex]];
      } else {
        // If no specific sheet found, use the last sheet (assuming first is instructions)
        worksheet = workbook.Sheets[workbook.SheetNames[workbook.SheetNames.length - 1]];
      }
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Raw Excel data:', jsonData); // Debug log

      // Filter out empty rows and transform Excel data
      const usersToImport = jsonData
        .filter((row: any) => {
          // Skip rows where name is empty or undefined
          return row.name || row.Name;
        })
        .map((row: any) => {
          const user = {
            name: (row.name || row.Name || '').toString().trim(),
            id_number: (row.id_number || row['ID Number'] || row.id_number || '').toString().trim(),
            role: (row.role || row.Role || '').toString().toLowerCase().trim(),
            phone_number: (row.phone_number || row['Phone Number'] || row.phone || '').toString().trim(),
            gender: (row.gender || row.Gender || '').toString().toLowerCase().trim(),
            department: row.department || row.Department || null,
            email: row.email || row.Email || null,
            is_active: row.is_active === false || row.is_active === 'false' ? false : true
          };
          
          // Clean up empty string values to null for optional fields
          if (user.department === '') user.department = null;
          if (user.email === '') user.email = null;
          
          return user;
        });

      console.log('Transformed users:', usersToImport); // Debug log

      if (usersToImport.length === 0) {
        throw new Error('No valid user data found in the Excel file. Please check the format.');
      }

      // Send to API
      const response = await fetch('/api/users/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: usersToImport }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Show detailed error information
        const errorMessage = result.error || 'Failed to import users';
        const details = result.details ? JSON.stringify(result.details, null, 2) : '';
        throw new Error(`${errorMessage}${details ? '\n\nDetails: ' + details : ''}`);
      }

      setImportResults({
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors || []
      });

      // Refresh users list
      await fetchUsers();

    } catch (error) {
      console.error('Import error:', error); // Debug log
      setError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    // Sample data with multiple examples
    const template = [
      {
        name: 'John Doe',
        id_number: '12345678',
        role: 'employee',
        phone_number: '+254712345678',
        gender: 'male',
        department: 'Finance',
        email: 'john.doe@example.com',
        is_active: true
      }
    ];

    // Instructions sheet
    const instructions = [
      { Instruction: 'USERS IMPORT TEMPLATE - INSTRUCTIONS' },
      { Instruction: '' },
      { Instruction: 'Required Fields (must be filled):' },
      { Instruction: '  - name: Full name of the user' },
      { Instruction: '  - id_number: Unique ID or Passport number' },
      { Instruction: '  - role: Must be either "admin" or "employee"' },
      { Instruction: '  - phone_number: Phone number with country code (e.g., +254712345678)' },
      { Instruction: '  - gender: Must be either "male" or "female"' },
      { Instruction: '' },
      { Instruction: 'Optional Fields:' },
      { Instruction: '  - department: User\'s department' },
      { Instruction: '  - email: User\'s email address (must be unique if provided)' },
      { Instruction: '  - is_active: Set to true or false (default is true)' },
      { Instruction: '' },
      { Instruction: 'Valid Departments:' },
      { Instruction: '  - Finance' },
      { Instruction: '  - Human Resources' },
      { Instruction: '  - Engineering' },
      { Instruction: '  - Procurement' },
      { Instruction: '  - Administration' },
      { Instruction: '  - Executive' },
      { Instruction: '  - Building and Civil Engineering' },
      { Instruction: '  - Electrical and Electronics Engineering' },
      { Instruction: '  - Cosmetology' },
      { Instruction: '  - Fashion Design and Clothing Textile' },
      { Instruction: '  - Business and Liberal Studies' },
      { Instruction: '  - Agriculture and Environment Studies' },
      { Instruction: '  - Automotive and Mechanical Engineering' },
      { Instruction: '  - Hospitality and Institutional Management' },
      { Instruction: '' },
      { Instruction: 'Important Notes:' },
      { Instruction: '  - ID numbers must be unique across all users' },
      { Instruction: '  - Email addresses must be unique if provided' },
      { Instruction: '  - Delete the sample data rows before importing your actual data' },
      { Instruction: '  - Keep the column headers exactly as shown' },
      { Instruction: '  - The system will skip duplicate entries and show errors' },
      { Instruction: '' },
      { Instruction: 'After filling the template:' },
      { Instruction: '  1. Save the file' },
      { Instruction: '  2. Go to the Import Excel dialog' },
      { Instruction: '  3. Upload your file' },
      { Instruction: '  4. Review the import results' }
    ];

    const workbook = XLSX.utils.book_new();
    
    // Add instructions sheet
    const instructionsWS = XLSX.utils.json_to_sheet(instructions);
    instructionsWS['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, instructionsWS, 'Instructions');
    
    // Add sample data sheet
    const dataWS = XLSX.utils.json_to_sheet(template);
    dataWS['!cols'] = [
      { wch: 20 }, // name
      { wch: 15 }, // id_number
      { wch: 12 }, // role
      { wch: 18 }, // phone_number
      { wch: 10 }, // gender
      { wch: 40 }, // department
      { wch: 30 }, // email
      { wch: 10 }  // is_active
    ];
    XLSX.utils.book_append_sheet(workbook, dataWS, 'Sample Data');

    XLSX.writeFile(workbook, 'users_import_template.xlsx');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="id_number">ID/Passport Number</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    required
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
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="Human Resources">Human Resources</SelectItem>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Procurement">Procurement</SelectItem>
                      <SelectItem value="Administration">Administration</SelectItem>
                      <SelectItem value="Executive">Executive</SelectItem>
                      <SelectItem value="Building and Civil Engineering">Building and Civil Engineering</SelectItem>
                      <SelectItem value="Electrical and Electronics Engineering">Electrical and Electronics Engineering</SelectItem>
                      <SelectItem value="Cosmetology">Cosmetology</SelectItem>
                      <SelectItem value="Fashion Design and Clothing Textile">Fashion Design and Clothing Textile</SelectItem>
                      <SelectItem value="Business and Liberal Studies">Business and Liberal Studies</SelectItem>
                      <SelectItem value="Agriculture and Environment Studies">Agriculture and Environment Studies</SelectItem>
                      <SelectItem value="Automotive and Mechanical Engineering">Automotive and Mechanical Engineering</SelectItem>
                      <SelectItem value="Hospitality and Institutional Management">Hospitality and Institutional Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editingUser && (
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
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Excel Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Users from Excel</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {importResults && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Import Results:</p>
                    <p>✅ Successfully imported: {importResults.imported} users</p>
                    {importResults.skipped > 0 && (
                      <p>⚠️ Skipped: {importResults.skipped} users</p>
                    )}
                    {importResults.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold text-red-600">Errors:</p>
                        <ul className="list-disc list-inside text-sm max-h-40 overflow-y-auto">
                          {importResults.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Step 1: Download Template</Label>
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Excel Template
              </Button>
              <p className="text-sm text-muted-foreground">
                Download the template file and fill in your user data. Required fields: 
                name, id_number, role, phone_number, gender
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Step 2: Upload Filled Template</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isImporting}
                ref={fileInputRef}
              />
              <p className="text-sm text-muted-foreground">
                Upload your completed Excel file. The system will validate and import the users.
              </p>
            </div>

            {isImporting && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2">Processing file...</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsImportDialogOpen(false);
                  setImportResults(null);
                  setError('');
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deactivatingUser}
        onOpenChange={() => setDeactivatingUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate {deactivatingUser?.name}&apos;s account?
              They will no longer be able to log in to their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeactivating}
            >
              {isDeactivating ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <UsersTable users={users} onEdit={handleEdit} />
    </div>
  );
}