import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';

interface ConsentGuardProps {
  children: ReactNode;
  requireApproval?: boolean;
}

/**
 * Guard to check if a minor user has parental consent.
 * If age band is 13-15 and status is pending_parent_consent, 
 * it blocks the children and redirects (or shows a locked state).
 */
export function ConsentGuard({ children, requireApproval = true }: ConsentGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  // If user is 13-15 and pending consent, redirect to pending page
  if (
    user?.ageBand === '13_15' && 
    user?.accountStatus === 'pending_parent_consent' && 
    requireApproval
  ) {
    return <Navigate to="/pending-consent" replace />;
  }

  // Also block if consent was withdrawn
  if (user?.accountStatus === 'parent_withdrawn') {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
        <h2 className="text-xl font-bold text-red-800 mb-2">Dostęp zablokowany</h2>
        <p className="text-red-700">Twoja zgoda rodzicielska została wycofana. Skontaktuj się z rodzicem lub administratorem.</p>
      </div>
    );
  }

  return <>{children}</>;
}
