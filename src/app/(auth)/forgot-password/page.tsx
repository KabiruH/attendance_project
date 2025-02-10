// app/forgot-password/page.tsx
import { Suspense } from 'react';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}