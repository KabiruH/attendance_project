'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Clock, Users, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message || 'Failed to send reset link');
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
        <h2 className="text-2xl font-bold mb-4 text-green-600">Reset Link Sent</h2>
        <p>A password reset link has been sent to your E-mail.</p>
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
            Reset Your<br />Password
          </h1>
          <p className="text-blue-100 text-lg mb-12">
            Securely recover access to your account.
          </p>
         
          {/* Feature List */}
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <KeyRound className="w-6 h-6 text-blue-200" />
              <p className="text-white">Secure Password Recovery</p>
            </div>
            <div className="flex items-center space-x-4">
              <Clock className="w-6 h-6 text-blue-200" />
              <p className="text-white">Quick Reset Process</p>
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

      {/* Right side - Forgot Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {success ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-green-600">Reset Link Sent</h2>
              <p className="mb-6">A password reset link has been sent to your email.</p>
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold mb-6 text-center">Forgot Password</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="block mb-2 text-gray-700">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="Enter your email"
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
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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