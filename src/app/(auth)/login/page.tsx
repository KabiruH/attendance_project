// src/app/login/page.tsx
'use client';
import LoginForm from '@/components/auth/LoginForm';


export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Attendance System</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}