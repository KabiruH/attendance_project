'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signUp } from '@/lib/auth/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

const SignupForm = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    id_number: '',
    email: '',
    role: '',
    password: '',
    confirmPassword: '',
    date_of_birth: '',
    id_card: null as File | null,
    passport_photo: null as File | null,
  });

  // Check if passwords match and meet minimum requirements
  const passwordsValid = useMemo(() => {
    if (!formData.password || !formData.confirmPassword) return false;
    if (formData.password.length < 8) return false;
    return formData.password === formData.confirmPassword;
  }, [formData.password, formData.confirmPassword]);

  // Check if all form fields are filled
  const isFormValid = useMemo(() => {
    return (
      formData.name &&
      formData.id_number &&
      formData.email &&
      formData.role &&
      formData.date_of_birth &&
      formData.id_card &&
      formData.passport_photo &&
      passwordsValid
    );
  }, [formData, passwordsValid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file') {
      const files = e.target.files;
      if (files && files.length > 0) {
        setFormData(prev => ({
          ...prev,
          [name]: files[0]
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    setError('');
  };

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      role: value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
  
    try {
      // Handle file uploads first
      const uploadFormData = new FormData();
      
      if (formData.id_card) {
        uploadFormData.append('id_card', formData.id_card);
      }
      if (formData.passport_photo) {
        uploadFormData.append('passport_photo', formData.passport_photo);
      }
  
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });
  
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload files');
      }
  
      const { id_card_path, passport_photo_path } = await uploadResponse.json();
  
      // Then create the account with the file paths
      await signUp({
        name: formData.name,
        id_number: formData.id_number,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        date_of_birth: formData.date_of_birth,
        id_card_path,
        passport_photo: passport_photo_path, // Note the difference in field name
      });
      
      router.push('/dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Enter your details to create your employee account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_number">ID Number</Label>
            <Input
              id="id_number"
              name="id_number"
              type="text"
              placeholder="Enter your ID number"
              value={formData.id_number}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={handleRoleChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_card">ID Card (Image)</Label>
            <Input
              id="id_card"
              name="id_card"
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passport_photo">Passport Photo</Label>
            <Input
              id="passport_photo"
              name="passport_photo"
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="********"
              value={formData.password}
              onChange={handleChange}
            />
            {formData.password && formData.password.length < 8 && (
              <p className="text-sm text-red-500">
                Password must be at least 8 characters long
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="********"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {formData.confirmPassword && !passwordsValid && (
              <p className="text-sm text-red-500">
                Passwords do not match
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SignupForm;