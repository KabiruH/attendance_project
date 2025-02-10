// app/reset-password/page.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { Building2, Clock, Users, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')


export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate token
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    // Validate passwords
    try {
      passwordSchema.parse(password);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        setError(validationError.errors[0].message);
        return;
      }
    }

    // Check password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-green-600">Password Reset Successful</h2>
        <p>Your password has been successfully reset. You can now log in with your new password.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col justify-between p-16">
        {/* Content */}
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-4xl font-bold text-white mb-6">
            Create New<br />Password
          </h1>
          <p className="text-blue-100 text-lg mb-12">
            Secure your account with a strong password.
          </p>
         
          {/* Feature List */}
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <KeyRound className="w-6 h-6 text-blue-200" />
              <p className="text-white">Strong Password Guidelines</p>
            </div>
            <div className="flex items-center space-x-4">
              <Clock className="w-6 h-6 text-blue-200" />
              <p className="text-white">Quick and Secure Reset</p>
            </div>
            <div className="flex items-center space-x-4">
              <Users className="w-6 h-6 text-blue-200" />
              <p className="text-white">Account Protection</p>
            </div>
          </div>
        </div>
       
        {/* Footer */}
        <div>
          <p className="text-blue-200 text-sm">
            © 2025 Optimum Computer Services. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side - Reset Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {success ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-green-600">Password Reset Successful</h2>
              <p className="mb-6">Your password has been successfully reset.</p>
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold mb-6 text-center">Reset Password</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="password" className="block mb-2 text-gray-700">New Password</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="Enter new password"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="confirm-password" className="block mb-2 text-gray-700">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="Confirm new password"
                  />
                </div>
                {error && (
                  <div className="mb-4 text-red-600 bg-red-100 p-2 rounded">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
                <div className="mt-4 text-center">
                  <button 
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-blue-500 hover:underline"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}