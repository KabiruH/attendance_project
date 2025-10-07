'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Upload, Download, Settings, User, Search, X } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ClassesTable from '@/components/classes/ClassesTable';
import ClassesForm from '@/components/classes/ClassesForm';
import ClassSelection from '@/components/classes/ClassSelection';
import MyClasses from '@/components/classes/MyClasses';
import * as XLSX from 'xlsx';

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

interface User {
    id: number;
    name: string;
    role: string;
    department: string;
}

export default function ClassesPage() {
    // State management
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState('');
    const [importError, setImportError] = useState('');
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [deactivatingClass, setDeactivatingClass] = useState<Class | null>(null);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('');

    // Add refresh triggers for child components
    const [refreshMyClasses, setRefreshMyClasses] = useState(0);
    const [refreshClassSelection, setRefreshClassSelection] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = userRole === 'admin';
    const isTrainer = userRole === 'employee'; // All employees can potentially be trainers

    // Filtered classes based on search term
    const filteredClasses = useMemo(() => {
        if (!searchTerm.trim()) return classes;
        
        const term = searchTerm.toLowerCase();
        return classes.filter(classItem => 
            classItem.name.toLowerCase().includes(term) ||
            classItem.code.toLowerCase().includes(term) ||
            classItem.department.toLowerCase().includes(term) ||
            classItem.term.toLowerCase().includes(term)  // Include term in search
        );
    }, [classes, searchTerm]);

    // Clear search function
    const clearSearch = () => {
        setSearchTerm('');
    };

    // Fetch current user using your auth pattern
    useEffect(() => {
        authenticateUser();
    }, []);

    const authenticateUser = async () => {
        try {
            const authResponse = await fetch("/api/auth/check", { method: "GET" });
            if (!authResponse.ok) {
                throw new Error("Authentication failed");
            }

            const authData = await authResponse.json();
            const { user } = authData;

            setUser(user);
            setUserRole(user.role);
        } catch (error) {
            console.error('Error authenticating user:', error);
            // Handle auth error - redirect to login or show error
        }
    };

    // Set default tab based on role
    useEffect(() => {
        if (userRole) {
            if (isAdmin) {
                setActiveTab('manage');
            } else {
                setActiveTab('select');
            }
        }
    }, [userRole, isAdmin]);

    // Fetch classes on component mount
    useEffect(() => {
        if (userRole) {
            if (isAdmin) {
                fetchClasses(); // Admin fetches all classes directly
            } else {
                // For employees, just set loading to false - ClassSelection handles its own data
                setIsLoading(false);
            }
        }
    }, [userRole, isAdmin]);

    // API Functions
    const fetchClasses = async () => {
        try {
            const response = await fetch('/api/classes');
            if (!response.ok) throw new Error('Failed to fetch classes');
            const data = await response.json();
            setClasses(data);
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Form handlers (Admin only)
    const handleOpenForm = () => {
        setEditingClass(null);
        setError('');
        setIsFormOpen(true);
    };

    const handleEdit = (classItem: Class) => {
        setEditingClass(classItem);
        setError('');
        setIsFormOpen(true);
    };

    const handleSaveClass = async (formData: any) => {
        setError('');
        setIsSubmitting(true);

        try {
            const url = '/api/classes';
            const method = editingClass ? 'PUT' : 'POST';
            const body = editingClass
                ? { ...formData, id: editingClass.id }
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
                throw new Error(data.error || 'Failed to save class');
            }

            await fetchClasses();
            setIsFormOpen(false);
            setEditingClass(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to save class');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingClass(null);
        setError('');
    };

    // Deactivation handlers (Admin only)
    const handleDeactivate = async (classItem: Class) => {
        setDeactivatingClass(classItem);
    };

    const confirmDeactivate = async () => {
        if (!deactivatingClass) return;

        setIsDeactivating(true);
        try {
            const response = await fetch(`/api/classes/${deactivatingClass.id}/toggle-status`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to update class status');
            }

            await fetchClasses();
        } catch (error) {
            console.error('Error updating class:', error);
        } finally {
            setIsDeactivating(false);
            setDeactivatingClass(null);
        }
    };

    // Excel import/export handlers (Admin only)
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportError('');

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const formattedClasses = jsonData.map((row: any, index: number) => {
                const requiredFields = ['name', 'code', 'department', 'term'];
                const missingFields = requiredFields.filter(field => !row[field]);

                if (missingFields.length > 0) {
                    throw new Error(`Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`);
                }

                return {
                    name: row.name,
                    code: row.code.toString().toUpperCase(),
                    term: row.term,
                    description: row.description || '',
                    department: row.department,
                    duration_hours: row.duration_hours || 2,
                    is_active: row.is_active !== false,
                    created_by: 'excel_import'
                };
            });

            const response = await fetch('/api/classes/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ classes: formattedClasses }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to import classes');
            }

            await fetchClasses();
            alert(`Successfully imported ${result.imported} classes!`);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Failed to import file');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const downloadTemplate = () => {
        const template = [
            {
                name: 'Digital Marketing Fundamentals',
                code: 'DM101',
                term: 'Fall 2024',
                description: 'Introduction to digital marketing strategies',
                department: 'Marketing',
                duration_hours: 2,
                is_active: true
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(template);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Classes');
        XLSX.writeFile(workbook, 'classes_template.xlsx');
    };

    // Callback functions to handle component synchronization
    const handleClassSelectionSaved = () => {
        // Only refresh MyClasses when selection is actually SAVED
        setRefreshMyClasses(prev => prev + 1);
    };

    const handleClassRemoved = () => {
        // When a class is removed from MyClasses, refresh ClassSelection to update checkboxes
        setRefreshClassSelection(prev => prev + 1);
    };

    // For employees, we get classes from the ClassSelection component instead
    const handleClassesLoaded = (loadedClasses: Class[]) => {
        setClasses(loadedClasses);
        setIsLoading(false);
    };

    if (isLoading || !userRole || !user) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">
                        {isAdmin ? 'Classes Management' : 'My Training Classes'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                            {user.name}
                        </Badge>
                        <Badge variant={isAdmin ? "default" : "secondary"}>
                            {isAdmin ? 'Administrator' : 'Trainer'}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Import error alert */}
            {importError && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{importError}</AlertDescription>
                </Alert>
            )}

            {/* Role-based content */}
            {isAdmin ? (
                // ADMIN VIEW
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="manage" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Manage Classes
                        </TabsTrigger>
                        <TabsTrigger value="select" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            My Teaching
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="manage" className="space-y-6">
                        {/* Search Section */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="Search by class name, code, department, or term..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-10"
                                />
                                {searchTerm && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSearch}
                                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-gray-200"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            
                            {/* Results count */}
                            {searchTerm && (
                                <div className="text-sm text-gray-500">
                                    {filteredClasses.length} of {classes.length} classes found
                                </div>
                            )}
                        </div>

                        {/* Admin Controls */}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={downloadTemplate}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Template
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                {isImporting ? 'Importing...' : 'Import Excel'}
                            </Button>
                            <Button onClick={handleOpenForm}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Class
                            </Button>
                        </div>

                        {/* No results message */}
                        {searchTerm && filteredClasses.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                                <p className="text-lg font-medium">No classes found</p>
                                <p className="text-sm">Try adjusting your search terms</p>
                                <Button
                                    variant="outline"
                                    onClick={clearSearch}
                                    className="mt-3"
                                >
                                    Clear search
                                </Button>
                            </div>
                        )}

                        {/* Classes Table */}
                        {(!searchTerm || filteredClasses.length > 0) && (
                            <ClassesTable
                                classes={filteredClasses}
                                onEdit={handleEdit}
                                onDeactivate={handleDeactivate}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="select" className="space-y-6">
                        {/* Admin's Teaching Assignments */}
                        <div className="grid gap-6 lg:grid-cols-1">
                            <MyClasses
                                userId={user.id}
                                showRemoveOption={true}
                                onClassRemoved={handleClassRemoved}
                                key={`classes-${refreshMyClasses}`}
                            />
                            <ClassSelection
                                userId={user.id}
                                onSelectionSaved={handleClassSelectionSaved}
                                key={`selection-${refreshClassSelection}`}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            ) : (
                // TRAINER VIEW  
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="select" className="flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            Select Classes
                        </TabsTrigger>
                        <TabsTrigger value="my-classes" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            My Classes
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="select" className="space-y-6">
                        {/* Search Section for Employee - Class Selection */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="Search available classes..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-10"
                                />
                                {searchTerm && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSearch}
                                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-gray-200"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            
                            {/* Results count - only show if we have classes data */}
                            {searchTerm && classes.length > 0 && (
                                <div className="text-sm text-gray-500">
                                    {filteredClasses.length} of {classes.length} classes found
                                </div>
                            )}
                        </div>

                        {/* ClassSelection Component - always show, it handles its own search */}
                        <ClassSelection
                            userId={user.id}
                            onSelectionSaved={handleClassSelectionSaved}
                            searchTerm={searchTerm}
                            onClassesLoaded={handleClassesLoaded}
                            key={`selection-${refreshClassSelection}`}
                        />
                    </TabsContent>

                    <TabsContent value="my-classes" className="space-y-6">
                        <MyClasses
                            userId={user.id}
                            showRemoveOption={true}
                            onClassRemoved={handleClassRemoved}
                            key={`classes-${refreshMyClasses}`}
                        />
                    </TabsContent>
                </Tabs>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
            />

            {/* Admin-only dialogs */}
            {isAdmin && (
                <>
                    {/* Classes Form Dialog */}
                    <ClassesForm
                        isOpen={isFormOpen}
                        onClose={handleCloseForm}
                        editingClass={editingClass}
                        onSave={handleSaveClass}
                        isSubmitting={isSubmitting}
                        error={error}
                    />

                    {/* Deactivation Confirmation Dialog */}
                    <AlertDialog
                        open={!!deactivatingClass}
                        onOpenChange={() => setDeactivatingClass(null)}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {deactivatingClass?.is_active ? 'Deactivate' : 'Activate'} Class
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to {deactivatingClass?.is_active ? 'deactivate' : 'activate'} the class "{deactivatingClass?.name}"?
                                    {deactivatingClass?.is_active && ' Trainers will no longer be able to check into this class.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={confirmDeactivate}
                                    className={deactivatingClass?.is_active ? "bg-red-600 hover:bg-red-700" : ""}
                                    disabled={isDeactivating}
                                >
                                    {isDeactivating ? 'Updating...' : deactivatingClass?.is_active ? 'Deactivate' : 'Activate'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
}