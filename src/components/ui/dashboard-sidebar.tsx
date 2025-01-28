'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
} from "@/components/ui/sidebar";
import { LayoutDashboard, ClipboardCheck, FileBarChart, Users, LogOut, User as UserIcon } from "lucide-react";
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
          router.push('/login');
        }
      } catch (error) {
        console.error('Sidebar auth check error:', error);
        setCurrentUser(null);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

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
      ...baseNavItems.slice(0, 4), // Items before Users
      {
        label: 'Users',
        icon: <Users size={20} />,
        href: '/users',
        type: 'link' as const
        },
      ...baseNavItems.slice(4) // Rest of the items (Profile, Logout)
    ]
  : baseNavItems

  if (!currentUser) {
    return null;
  }

  return (
    <Sidebar className="mt-16">
      <SidebarContent>
        <SidebarGroup>
          <nav className="p-4">
            <ul className="space-y-2">
            {navItems.map((item) => (
  <li key={item.href}>
    {item.type === 'link' ? (
      <Link
        href={item.href}
        className={`flex items-center space-x-2 p-2 rounded-lg text-black-300 hover:bg-gray-800 hover:text-white
          ${pathname === item.href ? 'bg-gray-800 text-white' : ''}`}
      >
        <span>{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    ) : (
      <button
        onClick={item.action}
        className={`w-full flex items-center space-x-2 p-2 rounded-lg text-black-300 hover:bg-gray-800 hover:text-white text-left`}
      >
        <span>{item.icon}</span>
        <span>{item.label}</span>
      </button>
    )}
  </li>
))}
            </ul>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <div className="p-4 space-y-2">
          <div className="text-xs text-gray-500">
            Licensed by Optimum Computer Services
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}