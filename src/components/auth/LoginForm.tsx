// src/components/auth/LoginForm.tsx - WebAuthn fixes
'use client';
import { useState, useEffect, useRef } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { checkLocation } from '@/lib/geofence';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const biometricButtonRef = useRef<HTMLButtonElement>(null);

  // Check if biometric auth is supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (window.PublicKeyCredential) {
          console.log('WebAuthn is supported in this browser');
          setBiometricSupported(true);
          
          // Check if we're in a secure context
          if (window.isSecureContext) {
            console.log('Running in a secure context');
          } else {
            console.warn('NOT running in a secure context - WebAuthn may not work');
          }
          
        } else {
          setBiometricSupported(false);
        }
      } catch (error) {
        console.error('Error checking WebAuthn support:', error);
        setBiometricSupported(false);
      }
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isLocationAllowed = await checkLocation();
      
      if (!isLocationAllowed) {
        toast({
          title: "Access Denied",
          description: "You must be within the allowed area to access this application",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
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
        if (data.error === 'Invalid credentials') {
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

const handleBiometricLogin = async () => {
  if (!email) {
    toast({
      title: "Email Required",
      description: "Please enter your email first",
      variant: "destructive",
    });
    return;
  }
  
  setBiometricLoading(true);
  
  try {
    // Check location first
    const isLocationAllowed = await checkLocation();
    
    if (!isLocationAllowed) {
      toast({
        title: "Access Denied",
        description: "You must be within the allowed area to access this application",
        variant: "destructive"
      });
      setBiometricLoading(false);
      return;
    }
    
    // Find user ID number from email
    const idLookupResponse = await fetch('/api/auth/get-id-from-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    if (!idLookupResponse.ok) {
      const errorData = await idLookupResponse.json();
      console.error('ID lookup error:', errorData);
      if (errorData.error === 'User not found') {
        toast({
          title: "User Not Found",
          description: "No account found with this email",
          variant: "destructive",
        });
        setBiometricLoading(false);
        return;
      }
      throw new Error(errorData.error || 'Failed to retrieve user ID');
    }
    
    const { idNumber } = await idLookupResponse.json();
    
    if (!idNumber) {
      throw new Error('Could not determine your ID number');
    }
    
    // 1. Request authentication options from server
    const optionsResponse = await fetch('/api/webauthn/generate-authentication-options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: idNumber }),
    });
    
    if (!optionsResponse.ok) {
      // Handle specific error for no credentials found
      if (optionsResponse.status === 400) {
        const errorData = await optionsResponse.json();
        console.error('Auth options error:', errorData);
        if (errorData.error === 'No registered credentials found for user') {
          toast({
            title: "No Biometric Found",
            description: "You need to register your fingerprint first. Please login with password.",
            variant: "destructive",
          });
          setBiometricLoading(false);
          return;
        }
      }
      
      const errorData = await optionsResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to get authentication options');
    }
    
    const options = await optionsResponse.json();
    console.log('Received authentication options:', {
      challenge: options.challenge ? options.challenge.substring(0, 10) + '...' : 'MISSING',
      rpId: options.rpId || 'NOT SET',
      allowCredentials: options.allowCredentials?.length || 0,
      timeout: options.timeout || 'default',
      userVerification: options.userVerification || 'default'
    });
    
    // Make sure allowCredentials is properly formatted
    if (!options.allowCredentials || !Array.isArray(options.allowCredentials) || options.allowCredentials.length === 0) {
      console.error('Invalid allowCredentials in options:', options.allowCredentials);
      throw new Error('Invalid authentication options received from server');
    }
    
    // ✅ CRITICAL FIX: Do NOT override the rpId from server
    // Trust the server's rpId completely
    console.log('Using server rpId:', options.rpId);
    
    // Add proper timeout if missing
    if (!options.timeout) {
      options.timeout = 60000; // 1 minute
    }

    // ✅ CRITICAL FIX: Call directly without setTimeout
    const authenticationResponse = await startAuthentication(options);
    
    // 3. Send the response to the server for verification
    const verificationResponse = await fetch('/api/webauthn/verify-authentication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authenticationResponse,
        username: idNumber,
      }),
    });
    
    if (!verificationResponse.ok) {
      const errorData = await verificationResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Verification error:', errorData);
      throw new Error(errorData.error || 'Authentication failed');
    }
    
    const verificationResult = await verificationResponse.json();
    
    if (verificationResult.verified) {
      // 4. Using the server response to complete biometric login
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: verificationResult.user.id,  
          email: verificationResult.user.email,
          biometricAuth: true,
        }),
      });
      
      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Biometric login error:', errorData);
        throw new Error(errorData.error || 'Login failed');
      }
      
      // Show success message
      toast({
        title: "Success!",
        description: "Logged in successfully with biometrics",
      });
      
      // Redirect to dashboard
      router.push('/dashboard');
    } else {
      throw new Error('Authentication verification failed');
    }
    
  } catch (error: any) {
    handleAuthError(error);
  } finally {
    setBiometricLoading(false);
  }
};
  
  const handleAuthError = (error: any) => {
    console.error('Biometric login error:', error);
    
    // User-friendly error message based on error type
    let errorMessage = 'Authentication failed';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Biometric verification was denied or cancelled';
      
      if (error.message.includes('CredentialContainer request is not allowed')) {
        errorMessage = 'Authentication not allowed - please ensure you\'re using HTTPS or localhost';
      }
    } else if (error.name === 'SecurityError') {
      errorMessage = 'A security error occurred - check if the site is using HTTPS';
    } else if (error.name === 'AbortError') {
      errorMessage = 'Authentication was cancelled';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'This type of authentication is not supported on this device';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    toast({
      title: "Login Failed",
      description: errorMessage,
      variant: "destructive",
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* Header Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <svg 
              className="w-8 h-8 text-blue-600" 
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Employee Dashboard
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Sign in to your account
          </h2>
          <p className="text-gray-500 text-sm">
            Check-in and Check-out of work with one simple click
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
            
            {/* Biometric Login Button - Only after email is entered */}
            {biometricSupported && email && (
              <button
                type="button"
                ref={biometricButtonRef}
                onClick={() => {
                  // Direct user activation for WebAuthn
                  if (biometricButtonRef.current) {
                    biometricButtonRef.current.focus();
                  }
                  handleBiometricLogin();
                }}
                disabled={biometricLoading}
                className="w-full mt-3 bg-gray-100 text-gray-700 py-2 rounded-xl hover:bg-gray-200 
                  transition-all duration-200 font-medium flex items-center justify-center text-sm"
              >
                {biometricLoading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 11c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12z" />
                    </svg>
                    Sign in with fingerprint
                  </>
                )}
              </button>
            )}
          </div>

          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
            <div className="flex justify-between mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <span>Get your account?</span>
                <Link
                  href="/signUp"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sign Up Here
                </Link>
              </div>
              <Link
                href="/forgot-password"
                className="text-gray-600 hover:text-gray-800"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 
              transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}