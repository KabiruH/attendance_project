import React from 'react';
import Link from 'next/link';

const Navbar = () => {
  return (
    <nav className="fixed w-full top-0 z-50">
    <div className="absolute inset-0 bg-gradient-to-r from-black via-navy-900 to-slate-900 opacity-95"></div>
      
      {/* Subtle accent gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
      
      {/* Glass effect overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/5"></div>
    {/* Content */}
      <div className="relative py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link 
            href="/dashboard" 
            className="flex items-center space-x-2 group"
          >
            <span className="text-2xl font-bold text-white relative overflow-hidden transition-transform hover:scale-105 duration-300 ease-out">
              Logo Here
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"></span>
            </span>
          </Link>
          
          {/* You can add additional nav items here with similar hover effects */}
        </div>
      </div>
      
      {/* Animated border effect */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
      
      {/* Optional: Animated glow effect */}
      <div className="absolute -bottom-1 left-0 right-0 h-[2px]">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse opacity-50"></div>
      </div>
    </nav>
  );
};

export default Navbar;