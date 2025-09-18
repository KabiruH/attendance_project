'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, LayoutDashboard, Shield, BookIcon, ClipboardCheck, FileBarChart, Users, LogOut, User as UserIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface User {
  id: string;
  email: string;
  role: string;
  name: string;
}

type NavItem = {
  label: string;
  icon: React.ReactNode;
  href: string;
  type?: 'link' | 'action';
  action?: () => void;
};

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  // Check auth on mount and when pathname changes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
        });
       
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Navbar auth check error:', error);
        setCurrentUser(null);
      }
    };
    
    // Check auth whenever pathname changes (including after login redirect)
    checkAuth();
  }, [pathname]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
     
      if (res.ok) {
        toast({
          title: "Success",
          description: "Logged out successfully",
        });
        setCurrentUser(null);
        router.push('/login');
      } else {
        throw new Error('Failed to log out');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  const baseNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      href: '/dashboard',
      type: 'link'
    },
    {
      label: 'Attendance',
      icon: <ClipboardCheck size={20} />,
      href: '/attendance',
      type: 'link'
    },
    {
      label: 'Reports',
      icon: <FileBarChart size={20} />,
      href: '/reports',
      type: 'link'
    },
     {
          label: 'Classes',
          icon: <BookIcon size={20} />,
          href: '/classes',
          type: 'link'
        },
    {
      label: 'Profile',
      icon: <UserIcon size={20} />,
      href: '/profile',
      type: 'link'
    },
    {
      label: 'Logout',
      icon: <LogOut size={20} />,
      href: '#',
      type: 'action',
      action: handleLogout
    }
  ];

  // Combine navigation items based on user role
  const navItems = currentUser?.role === 'admin'
    ? [
        ...baseNavItems.slice(0, 4),
        {
          label: 'Employees',
          icon: <Users size={20} />,
          href: '/users',
          type: 'link' as const
        },
         {
        label: 'Login Logs',
        icon: <Shield size={20} />,
        href: '/login-logs',
        type: 'link' as const
      },
        ...baseNavItems.slice(4)
      ]
    : baseNavItems;

  // Check auth on mount and when pathname changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
        });
       
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Navbar auth check error:', error);
        setCurrentUser(null);
      }
    };
    
    // Always check auth when pathname changes
    checkAuthStatus();
  }, [pathname]);

  // Don't show menu button if not authenticated
  const showMenu = currentUser && !pathname.includes('/login') && !pathname.includes('/register');

  return (
    <>
      <nav className="fixed w-full top-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-300 via-white to-blue-100 opacity-95"></div>
       
        {/* Subtle accent gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
       
        {/* Glass effect overlay */}
        <div className="absolute inset-0 backdrop-blur-sm bg-white/5"></div>
       
        {/* Content */}
        <div className="relative py-2 md:py-4 px-4 md:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
           
            {/* Left side: Mobile menu + Logo */}
            <div className="flex items-center space-x-3">
              {/* Mobile menu button - only shows on mobile when authenticated */}
              {showMenu && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg text-blue-900 hover:bg-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              )}
             
              {/* Logo */}
              <Link
                href="/dashboard"
                className="flex items-center space-x-1 md:space-x-2 group"
              >
                <span>
                  <Image
                    src="/logo.png"  
                    alt="logo"
                    width={150}  
                    height={30}
                    className="h-8 md:h-10 w-auto rounded-lg shadow-md"
                  />
                </span>
                {/* Responsive company name */}
                <span className="hidden sm:block text-lg md:text-2xl lg:text-3xl font-bold text-blue-900 tracking-tight leading-tight relative overflow-hidden transition-transform hover:scale-105 duration-300 ease-out">
                  <span className="hidden lg:inline">Mukiria Technical Training Institute</span>
                  <span className="lg:hidden">Mukiria TTI</span>
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-900 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"></span>
                </span>
              </Link>
            </div>
           
            {/* Right side - empty for now, ready for future additions */}
            <div className="flex items-center">
              {/* You can add user info, notifications, etc. here later if needed */}
            </div>
          </div>
        </div>
       
        {/* Animated border effect */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
       
        {/* Optional: Animated glow effect */}
        <div className="absolute -bottom-1 left-0 right-0 h-[2px]">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 animate-pulse opacity-50"></div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {showMenu && mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="fixed left-0 top-0 h-full w-64 bg-slate-300 shadow-xl transform transition-transform duration-300 ease-in-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Menu Content */}
            <div className="pt-20 px-4">
              <nav>
                <ul className="space-y-2">
                  {navItems.map((item) => (
                    <li key={item.href}>
                      {item.type === 'link' ? (
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center space-x-3 p-3 rounded-lg
                            transition-all duration-200
                            ${pathname === item.href 
                              ? 'bg-blue-600 text-white font-semibold shadow-lg' 
                              : 'text-black hover:bg-blue-500 hover:text-white'
                            }`}
                        >
                          <span className="transition-transform duration-200 hover:scale-110">
                            {item.icon}
                          </span>
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            item.action?.();
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center space-x-3 p-3 rounded-lg
                            text-black hover:bg-red-600 
                            transition-all duration-200 text-left"
                        >
                          <span className="transition-transform duration-200 hover:scale-110">
                            {item.icon}
                          </span>
                          <span className="font-medium">{item.label}</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
                <div className="text-sm text-white/80 text-center font-medium">
                  Licensed by Optimum Computer Services
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;