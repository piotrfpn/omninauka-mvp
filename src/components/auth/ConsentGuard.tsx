import { useState, useEffect, useRef } from 'react';
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
  const { user, isLoading, isProfileLoading, isProfileMissing, refreshUser, logout } = useAuth();
  const { t } = useTranslation('common');

  const DEBUG_ALLOWED_EMAILS = ['bojki@tlen.pl'];
  const hasParam = new URLSearchParams(window.location.search).get('uploadDebug') === '1';
  const isAllowed = !!user?.email && DEBUG_ALLOWED_EMAILS.includes(user.email.toLowerCase());
  const debugEnabled = import.meta.env.DEV || (hasParam && isAllowed);

  const consentDebug = (msg: string, data?: any) => {
    if (debugEnabled) console.log('[consent-debug]', msg, data);
  };

  // State for retroactive link attempt (under_13 who logs in after parent adds their email)
  const [isLinking, setIsLinking] = useState(false);
  const [linkAttempted, setLinkAttempted] = useState(false);
  const [expiryConfirmed, setExpiryConfirmed] = useState(false);
  const linkAttemptStarted = useRef(false);

  const isUnder13Pending =
    user?.ageBand === 'under_13' &&
    user?.accountStatus === 'pending_parent_preapproval' &&
    requireApproval;

  // On every mount where the user is under_13 and pending,
  // attempt retroactive linking (parent may have added the email since last login)
  useEffect(() => {
    if (!isUnder13Pending || linkAttempted || linkAttemptStarted.current || expiryConfirmed || isProfileMissing) return;

    const attemptLink = async () => {
      linkAttemptStarted.current = true;
      setLinkAttempted(true);
      setIsLinking(true);
      try {
        consentDebug('Attempting retroactive link for under_13');
        const { data } = await supabase.rpc('link_child_account');
        if (data?.reason === 'preapproval_window_expired') {
          // Fail closed immediately; a subsequent profile read may fail.
          setExpiryConfirmed(true);
        }
        if (data?.linked === true || data?.reason === 'preapproval_window_expired') {
          consentDebug('Link status changed, refreshing user');
          // Read the authoritative profile after activation or deadline expiry.
          await refreshUser();
        }
      } catch (err) {
        consentDebug('Link attempt failed', err);
        // Non-fatal — user stays blocked
      } finally {
        setIsLinking(false);
      }
    };

    attemptLink();
  }, [isUnder13Pending, linkAttempted, expiryConfirmed, isProfileMissing, refreshUser]);

  // ANTI-FLICKER: Don't make decisions until INITIAL profile is fully resolved
  // BUT: Do not unmount if we already have a user (prevents remount on background refresh)
  if (isLoading || (isProfileLoading && !user)) {
    consentDebug('Waiting for INITIAL profile resolution...', { isLoading, isProfileLoading, hasUser: !!user });
    return null;
  }

  consentDebug('Consent decision logic', { 
    pathname: window.location.pathname,
    status: user?.accountStatus, 
    isProfileLoading 
  });

  // ── Case 1: 13-15 pending consent ────────────────────────────────────────
  if (
    user?.ageBand === '13_15' &&
    user?.accountStatus === 'pending_parent_consent' &&
    requireApproval
  ) {
    return <Navigate to="/pending-consent" replace />;
  }

  // ── Case 2: under_13 without parent pre-approval ─────────────────────────
  if (isUnder13Pending && !expiryConfirmed && !isProfileMissing) {
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

  // ── Case 3: blocked/withdrawn ─────────────────────────────────────────────
  const blockingStatuses = ['parent_withdrawn', 'suspended', 'withdrawn', 'under_13', 'expired_pending_preapproval'];
  const under13StatusUnavailable = user?.ageBand === 'under_13' && requireApproval &&
    !['active', 'parent_approved', 'pending_parent_preapproval', ...blockingStatuses].includes(user.accountStatus ?? '');
  if (expiryConfirmed || isProfileMissing || under13StatusUnavailable ||
      (user?.accountStatus && blockingStatuses.includes(user.accountStatus))) {
    consentDebug('Blocking access due to status', user?.accountStatus);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)] px-6">
        <div className="omni-card p-8 bg-red-50 border border-red-200 rounded-2xl text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Dostęp zablokowany</h2>
          <p className="text-red-700 mb-6">
            {expiryConfirmed || user?.accountStatus === 'expired_pending_preapproval'
              ? t('auth.pending.under13.cleanupRule')
              : isProfileMissing || under13StatusUnavailable
                ? 'Nie możemy potwierdzić uprawnień tego konta. Wyloguj się i spróbuj ponownie.'
                : `Twoje konto jest obecnie zablokowane lub zgoda rodzicielska została wycofana (Status: ${user?.accountStatus}).`}
          </p>
          <button
            onClick={() => logout()}
            className="omni-btn-secondary w-full flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {t('auth.pending.logout')}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
