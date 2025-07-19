// components/dashboard/WelcomeHeader.tsx
'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface WelcomeHeaderProps {
  employeeName: string | null;
  currentTime: string;
}

const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ 
  employeeName, 
  currentTime 
}) => {
  return (
    <div className="flex justify-between items-center bg-white rounded-lg p-4 shadow-md">
      <h1 className="text-3xl font-bold text-slate-900">
        Welcome, <span className="text-blue-600">{employeeName || 'Loading...'}</span>
      </h1>
      <div className="flex items-center space-x-2 text-lg font-bold text-slate-900">
        <Clock className="w-6 h-6 text-blue-600" />
        <span>{currentTime}</span>
      </div>
    </div>
  );
};

export default WelcomeHeader;