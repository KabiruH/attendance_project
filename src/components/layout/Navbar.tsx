'use client';
import React from 'react';
import Link from 'next/link';

const Navbar = () => {

  return (
    <nav className="bg-gray-900 text-gray-100 py-4 px-6 fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <span className="text-xl font-bold">Logo Here</span>
        </Link>
      
      </div>
    </nav>
  );
};

export default Navbar;