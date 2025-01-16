'use client';

import { useState, useEffect  } from 'react';
import Navbar from './Navbar';

export default function NavbarWrapper() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    // Check the cookie or authentication status on mount to set the login state
    const checkLoginStatus = async () => {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='));
      if (token) {
        setIsLoggedIn(true); // Assuming the token means logged in
      }
    };

    checkLoginStatus();
  }, []);

  const handleLogout = async () => {
    // Call logout API, and update state
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      setIsLoggedIn(false);
      // Optionally redirect to the login page
    }
  };

  return (
    <Navbar 
        isLoggedIn={isLoggedIn} 
        onLogout={handleLogout} 
    />
  );
}