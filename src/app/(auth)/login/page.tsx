'use client';
import { useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import QuickCheckIn from '@/components/attendance/QuickCheckIn';
import { Building2, Clock, Users, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [showLoginForm, setShowLoginForm] = useState(false);

  const handleQuickCheckInSuccess = () => {
    // Optionally refresh the page or show additional success UI
    console.log('Quick check-in successful!');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col justify-between p-16">
        {/* Content */}
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-4xl font-bold text-white mb-6">
            Welcome to our Attendance System
          </h1>
          <p className="text-blue-100 text-2xl mb-12">
            Streamline your attendance tracking with our modern, user-friendly platform.
          </p>
         
          {/* Feature List */}
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Clock className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Easy check-in and check-out</p>
            </div>
            <div className="flex items-center space-x-4">
              <Users className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Track team attendance</p>
            </div>
            <div className="flex items-center space-x-4">
              <Building2 className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Multi-branch support</p>
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

      {/* Right side - Quick Check-In or Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          
          {!showLoginForm ? (
            // Quick Check-In View
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Quick Attendance
                </h2>
                <p className="text-gray-600">
                  Check in to work instantly with your biometric authentication
                </p>
              </div>

              {/* Quick Check-In Component */}
              <QuickCheckIn onSuccess={handleQuickCheckInSuccess} />

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              {/* Full Login Option */}
              <Card className="border-gray-200">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-900">Need Full Access?</h3>
                      <p className="text-sm text-gray-600">
                        Access your dashboard, reports, and account settings
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowLoginForm(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Full Login Form View
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Sign In to Your Account
                </h2>
                <p className="text-gray-600">
                  Access your dashboard and account settings
                </p>
              </div>

              <LoginForm />

              {/* Back to Quick Check-In */}
              <div className="text-center">
                <Button
                  onClick={() => setShowLoginForm(false)}
                  variant="ghost"
                  className="text-blue-600 hover:text-blue-700"
                >
                  ← Back to Quick Check-In
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}