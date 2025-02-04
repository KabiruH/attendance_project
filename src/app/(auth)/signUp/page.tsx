// SignupPage.tsx
'use client';
import SignupForm from '@/components/auth/SignupForm';
import { Building2, Clock, Users } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col justify-between p-16">
        {/* Content */}
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-4xl font-bold text-white mb-6">
            Join Our Attendance System,
          </h1>
          <p className="text-blue-100 text-lg mb-12">
            Get started with our modern attendance tracking platform today.
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

      {/* Right side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center">
        <div className="">
          <div className="">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold">Optimum Computer Services</h1>  
                         </div>
                       
            {/* Signup Form Component */}
            <SignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}