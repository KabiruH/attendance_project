'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
} from "@/components/ui/sidebar";
import { LayoutDashboard, ClipboardCheck, FileBarChart, Users } from "lucide-react";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  name: string;
}

export function DashboardSidebar() {
  const pathname = usePathname();
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
        }
      } catch (error) {
        console.error('Sidebar auth check error:', error);
        setCurrentUser(null);
      }
    };

    checkAuth();
  }, []);

  const baseNavItems = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      href: '/dashboard'
    },
    {
      label: 'Attendance',
      icon: <ClipboardCheck size={20} />,
      href: '/attendance'
    },
    {
      label: 'Reports',
      icon: <FileBarChart size={20} />,
      href: '/reports'
    },
  ];

  const adminNavItems = [
    {
      label: 'Users',
      icon: <Users size={20} />,
      href: '/users'
    },
  ];

  // Combine navigation items based on user role
  const navItems = currentUser?.role === 'admin'
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  return (
    <Sidebar className="mt-16">
      <SidebarContent>
        <SidebarGroup>
          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center space-x-2 p-2 rounded-lg text-black-300 hover:bg-gray-800 hover:text-white
                      ${pathname === item.href ? 'bg-gray-800 text-white' : ''}`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 text-sm text-gray-400">
          Licenced by Optimum Computer Services
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}