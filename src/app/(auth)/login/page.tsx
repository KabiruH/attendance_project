// LoginPage.tsx
'use client';
import LoginForm from '@/components/auth/LoginForm';
import { Building2, Clock, Users } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col justify-between p-16">
        {/* Content */}
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-4xl font-bold text-white mb-6">
            Welcome to our Attendance System
          </h1>
          <p className="text-blue-100 text-lg mb-12">
            Streamline your attendance tracking with our modern, user-friendly platform.
          </p>
         
          {/* Feature List */}
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Clock className="w-6 h-6 text-blue-200" />
              <p className="text-white">Easy check-in and check-out</p>
            </div>
            <div className="flex items-center space-x-4">
              <Users className="w-6 h-6 text-blue-200" />
              <p className="text-white">Track team attendance</p>
            </div>
            <div className="flex items-center space-x-4">
              <Building2 className="w-6 h-6 text-blue-200" />
              <p className="text-white">Multi-branch support</p>
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

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <LoginForm />
      </div>
    </div>
  );
}