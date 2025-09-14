// components/layout/ConditionalNavbar.tsx
'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide navbar on SuperAdmin pages
  const hiddenRoutes = ['/superadmin'];
  const shouldHideNavbar = hiddenRoutes.some(route => pathname.startsWith(route));
  
  if (shouldHideNavbar) {
    return null;
  }
  
  return (
    <div className="sticky top-0 z-50 w-full">
      <Navbar />
    </div>
  );
}