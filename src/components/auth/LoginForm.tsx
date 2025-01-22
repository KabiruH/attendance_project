// src/components/auth/LoginForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error from the API response
        const errorMessage = data.error || 'Login failed';  // If the API sends a specific error
        if (data.error === 'Invalid email or password') {
          toast({
            title: "Error",
            description: "Wrong email or password",
            variant: "destructive",  // Set the toast to "destructive" for error styling
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
        throw new Error(errorMessage);
      }

      // Show success message
      toast({
        title: "Success!",
        description: "Logged in successfully",
      });

      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Login failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className=" fixed inset-0 flex items-center justify-center min-h-screen mt-7 bg-gray-50">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-lg p-8">
          {/* Header Icon */}
          <div className="flex justify-center mt-6 mb-6">
            <div className="bg-gray-50 p-3 rounded-xl">
              <svg 
                className="w-6 h-6 text-gray-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" 
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-center mb-2">
           Employee dashboard
          </h1>
          <h1 className="text-xl font-semibold text-center mb-2">
            Sign in with email
          </h1>
          <p className="text-gray-500 text-center text-sm mb-8">
           Check-in and Check-out of work with <br />
           one simple click
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  <svg 
                    className="w-5 h-5 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" />
                    <path d="M20 4L12 12L4 4" />
                  </svg>
                </span>
              </div>
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <svg 
                    className="w-5 h-5 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    {showPassword ? (
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    ) : (
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    )}
                  </svg>
                </button>
              </div>
              <div className="flex justify-end mt-2">
               <span>Have an account?</span> <br/> 
               <Link
                  href="/signUp"
                  className="text-sm text-green hover:text-gray-800"
                >
                  Sign Up Here
                </Link>
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 rounded-xl hover:bg-gray-800 transition-colors"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}