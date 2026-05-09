import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { ShieldAlert, Loader2, LogOut } from 'lucide-react';

interface ConsentGuardProps {
  children: ReactNode;
  requireApproval?: boolean;
}

/**
 * Guard to check if a minor user has parental consent.
 *
 * Handles three cases:
 *   1. age_band = '13_15' AND account_status = 'pending_parent_consent'
 *      → Redirect to /pending-consent
 *   2. age_band = 'under_13' AND account_status = 'pending_parent_preapproval'
 *      → Show blocked screen, attempt retroactive link on mount
 *   3. account_status = 'parent_withdrawn'
 *      → Show blocked screen
 */
export function ConsentGuard({ children, requireApproval = true }: ConsentGuardProps) {
  const { user, isLoading, refreshUser, logout } = useAuth();
  const { t } = useTranslation('common');

  // State for retroactive link attempt (under_13 who logs in after parent adds their email)
  const [isLinking, setIsLinking] = useState(false);
  const [linkAttempted, setLinkAttempted] = useState(false);

  const isUnder13Pending =
    user?.ageBand === 'under_13' &&
    user?.accountStatus === 'pending_parent_preapproval' &&
    requireApproval;

  // On every mount where the user is under_13 and pending,
  // attempt retroactive linking (parent may have added the email since last login)
  useEffect(() => {
    if (!isUnder13Pending || linkAttempted) return;

    const attemptLink = async () => {
      setIsLinking(true);
      try {
        const { data } = await supabase.rpc('link_child_account');
        if (data?.linked === true) {
          // Success: refresh profile so account_status becomes 'active'
          await refreshUser();
        }
      } catch {
        // Non-fatal — user stays blocked
      } finally {
        setIsLinking(false);
        setLinkAttempted(true);
      }
    };

    attemptLink();
  }, [isUnder13Pending, linkAttempted, refreshUser]);

  if (isLoading) return null;

  // ── Case 1: 13-15 pending consent ────────────────────────────────────────
  if (
    user?.ageBand === '13_15' &&
    user?.accountStatus === 'pending_parent_consent' &&
    requireApproval
  ) {
    return <Navigate to="/pending-consent" replace />;
  }

  // ── Case 2: under_13 without parent pre-approval ─────────────────────────
  if (isUnder13Pending) {
    if (isLinking) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--omni-accent)]" />
            <p className="text-[var(--omni-text-muted)] text-sm">Sprawdzamy zgodę rodzica...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)] px-6">
        <div className="w-full max-w-md">
          <div className="omni-card p-8 flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[var(--omni-text)]">
              {t('auth.pending.under13.title')}
            </h2>
            <p className="text-[var(--omni-text-muted)]">
              {t('auth.pending.under13.blockedSubtitle')}
            </p>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 text-left w-full">
              <p className="font-semibold mb-2">{t('auth.pending.under13.nextStepsTitle')}</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>{t('auth.pending.under13.step1')}</li>
                <li>{t('auth.pending.under13.step2')}</li>
                <li>{t('auth.pending.under13.step3')}</li>
              </ol>
            </div>
            <p className="text-xs text-[var(--omni-text-muted)] italic">
              {t('auth.pending.under13.cleanupRule')}
            </p>
            
            <div className="flex flex-col gap-4 w-full mt-2">
              <button
                onClick={() => logout()}
                className="omni-btn-secondary w-full flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {t('auth.pending.logout')}
              </button>
              
              <p className="text-xs text-[var(--omni-text-muted)]">
                {t('auth.pending.under13.loginAgain')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Case 3: consent withdrawn ─────────────────────────────────────────────
  if (user?.accountStatus === 'parent_withdrawn') {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
        <h2 className="text-xl font-bold text-red-800 mb-2">Dostęp zablokowany</h2>
        <p className="text-red-700">
          Twoja zgoda rodzicielska została wycofana. Skontaktuj się z rodzicem lub administratorem.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
