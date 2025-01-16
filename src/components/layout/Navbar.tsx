import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, onLogout }) => {
  const router = useRouter();

  // Logout Handler
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent with the request
      });

      if (res.ok) {
        // Call the passed onLogout prop to update parent state
        onLogout();
        // Redirect to the login page
        router.push('/login');
      } else {
        console.error('Failed to log out');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <nav className="bg-gray-900 text-gray-100 py-4 px-6 fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">YourLogo</span>
        </Link>

        {/* Auth Section */}
        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <>
              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <Link href="/profile" className="w-full">
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-300 hover:text-white"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </Button>
            </>
          ) : (
            <>
             
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
