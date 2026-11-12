import { createContext, useContext, useState, useEffect, useRef, Fragment, type ReactNode } from 'react';
import type { AuthState, User } from '../types';
import { mockUser } from '../mock/data';
import { supabase } from './supabase';
import { activateDemoClientState, activateUserClientState, captureUserClientState, clearDemoClientState,
  clearUserClientState, clientStateOwnerKey, getClientStateVersion, getPersistedDemoTabToken,
  hasPersistedDemoClientState, type ClientStateCleanupReason } from './client-state-cleanup';

type RefreshUserResult =
  | { success: true }
  | { success: false; reason: 'profile_refresh_failed' | 'profile_missing' | 'auth_unavailable' };

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, ageBand: string, userRole?: string) => Promise<{ success: boolean; message?: string; requireEmailVerification?: boolean }>;
  logout: (reason?: 'logout' | 'account_delete') => Promise<void>;
  loginAsDemo: () => void;
  updateProfile: (updates: any) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<RefreshUserResult>;
  isDemoMode: boolean;
  isProfileLoading: boolean;
  isProfileMissing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUser = (sbUser: any, dbProfile?: any): User => ({
  id: sbUser.id,
  email: sbUser.email,
  name: dbProfile?.name || sbUser.user_metadata?.name || 'User',
  plan: dbProfile?.plan || 'free',
  createdAt: new Date(sbUser.created_at),
  ageBand: dbProfile?.age_band || sbUser.user_metadata?.ageBand,
  accountStatus: dbProfile?.account_status,
  userRole: dbProfile?.user_role,
  schoolType: dbProfile?.school_type,
  educationLevel: dbProfile?.education_level,
  gradeLevel: dbProfile?.grade_level,
  postalCode: dbProfile?.postal_code,
  profileCompleted: dbProfile?.profile_completed,
  profileCompletedAt: dbProfile?.profile_completed_at ? new Date(dbProfile.profile_completed_at) : undefined,
  lastLoginAt: dbProfile?.last_login_at ? new Date(dbProfile.last_login_at) : (sbUser?.last_sign_in_at ? new Date(sbUser.last_sign_in_at) : undefined),
  planExpiresAt: dbProfile?.plan_expires_at ?? null,
  planUpdatedAt: dbProfile?.plan_updated_at ?? null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isProfileMissing, setIsProfileMissing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [clientStateVersion, setClientStateVersion] = useState(0);
  const isDemoModeRef = useRef(false);
  const demoInstanceIdRef = useRef<string>(crypto.randomUUID());
  const initSessionPromiseRef = useRef<Promise<unknown> | null>(null);
  const startupHandledRef = useRef(false);
  const logoutRequested = useRef(false);
  const lastAcceptedUserId = useRef<string | null>(null);
  const lastAcceptedEmailRef = useRef<string | null>(null);
  const currentClientScope = useRef<() => boolean>(() => true);
  const profileInitialized = useRef(false);

  const resetClientState = (reason: ClientStateCleanupReason, preserveSharedState = false) => {
    const hadActiveUser = lastAcceptedUserId.current !== null || isDemoModeRef.current;
    isDemoModeRef.current = false;
    lastAcceptedEmailRef.current = null;
    profileInitialized.current = false;
    setIsDemoMode(false);
    try {
      clearUserClientState(reason, preserveSharedState);
    } catch {
      // Fail closed: no account workspace is rendered if storage cannot be cleared.
      console.warn('Client state cleanup unavailable');
    }
    if (reason !== 'startup_without_valid_session' || hadActiveUser) {
      setClientStateVersion(getClientStateVersion());
    }
    setIsProfileMissing(false);
    setIsProfileLoading(false);
    setState({ user: null, isAuthenticated: false, isLoading: false });
  };

  const applyDemoSession = (): boolean => {
    try {
      const nextVersion = activateDemoClientState(mockUser.id);
      lastAcceptedUserId.current = mockUser.id;
      lastAcceptedEmailRef.current = mockUser.email;
      currentClientScope.current = captureUserClientState(mockUser.id);
      isDemoModeRef.current = true;
      setClientStateVersion(nextVersion);
      setIsProfileMissing(false);
      setIsDemoMode(true);
      setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      });
      setIsProfileLoading(false);
      return true;
    } catch {
      resetClientState('auth_invalidated');
      return false;
    }
  };

  // Debug helper
  const authDebug = (msg: string, data?: any) => {
    const DEBUG_ALLOWED_EMAILS = ['bojki@tlen.pl'];
    const hasParam = new URLSearchParams(window.location.search).get('uploadDebug') === '1';
    const activeEmail = lastAcceptedEmailRef.current ?? state.user?.email;
    const isAllowed = !!activeEmail && DEBUG_ALLOWED_EMAILS.includes(activeEmail.toLowerCase());
    
    if (import.meta.env.DEV || (hasParam && isAllowed)) {
      console.log('[auth-debug]', msg, data);
    }
  };

  useEffect(() => {
    let alive = true;
    let eventVersion = 0;
    let realSessionReceived = false;
    let demoProbePromise: Promise<boolean> | null = null;
    let cancelPendingProbe: (() => void) | null = null;
    let notifyDuplicateFound: (() => void) | null = null;
    const initialVersion = getClientStateVersion();
    const instanceId = demoInstanceIdRef.current;

    const BroadcastChannelCtor = typeof window !== 'undefined' ? window.BroadcastChannel : undefined;
    let demoChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannelCtor === 'function') {
      try {
        demoChannel = new BroadcastChannelCtor('omninauka_demo_tab');
        demoChannel.onmessage = (event: MessageEvent) => {
          if (!alive) return;
          const msg = event?.data;
          if (!msg || typeof msg.tabToken !== 'string') return;
          const currentToken = getPersistedDemoTabToken(mockUser.id);
          if (!currentToken || msg.tabToken !== currentToken) return;

          if (msg.type === 'demo_tab_probe' && msg.instanceId !== instanceId && isDemoModeRef.current) {
            demoChannel?.postMessage({
              type: 'demo_tab_active',
              tabToken: currentToken,
              ownerInstanceId: instanceId,
            });
          } else if (msg.type === 'demo_tab_active' && msg.ownerInstanceId !== instanceId) {
            notifyDuplicateFound?.();
            if (!realSessionReceived && isDemoModeRef.current) {
              clearDemoClientState();
              resetClientState('auth_invalidated', true);
            }
          }
        };
      } catch {
        demoChannel = null;
      }
    }

    const checkDemoNotDuplicated = (tabToken: string): Promise<boolean> => {
      if (demoProbePromise) return demoProbePromise;
      if (!demoChannel) {
        demoProbePromise = Promise.resolve(true);
        return demoProbePromise;
      }
      demoProbePromise = new Promise<boolean>(resolve => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const finish = (allowed: boolean) => {
          if (settled) return;
          settled = true;
          if (timer !== null) clearTimeout(timer);
          notifyDuplicateFound = null;
          cancelPendingProbe = null;
          resolve(allowed);
        };
        notifyDuplicateFound = () => finish(false);
        cancelPendingProbe = () => finish(false);
        try {
          demoChannel!.postMessage({
            type: 'demo_tab_probe',
            tabToken,
            instanceId,
          });
        } catch {
          finish(true);
          return;
        }
        timer = setTimeout(() => finish(true), 50);
      });
      return demoProbePromise;
    };

    const acceptSession = (session: { user: unknown }) => {
      try {
        const sessionUser = session.user as { id: string };
        realSessionReceived = true;
        cancelPendingProbe?.();
        clearDemoClientState();
        isDemoModeRef.current = false;
        setIsDemoMode(false);
        startupHandledRef.current = true;
        const mappedUser = mapSupabaseUser(session.user);
        const nextVersion = activateUserClientState(sessionUser.id);
        lastAcceptedUserId.current = sessionUser.id;
        lastAcceptedEmailRef.current = mappedUser.email || null;
        currentClientScope.current = captureUserClientState(sessionUser.id);
        setClientStateVersion(nextVersion);
        setIsProfileMissing(false);
        setState({ user: mappedUser, isAuthenticated: true, isLoading: false });
        const initialProfileLoad = !profileInitialized.current;
        profileInitialized.current = true;
        void fetchAndMergeProfile(session.user, initialProfileLoad);
      } catch {
        resetClientState('auth_invalidated');
      }
    };

    const handleStartupWithoutSession = async () => {
      if (!alive || realSessionReceived || isDemoModeRef.current || logoutRequested.current || startupHandledRef.current) return;
      const persistedTabToken = getPersistedDemoTabToken(mockUser.id);
      if (persistedTabToken) {
        const allowed = await checkDemoNotDuplicated(persistedTabToken);
        if (!alive || realSessionReceived || isDemoModeRef.current || logoutRequested.current || startupHandledRef.current) return;
        if (allowed) {
          authDebug('Restoring persisted Demo session');
          startupHandledRef.current = true;
          applyDemoSession();
          return;
        }
        clearDemoClientState();
        startupHandledRef.current = true;
        authDebug('Duplicate Demo tab detected; starting signed out');
        resetClientState('startup_without_valid_session', true);
        return;
      }
      startupHandledRef.current = true;
      authDebug('No session detected');
      const hasSharedOwner = Boolean(window.localStorage.getItem(clientStateOwnerKey));
      resetClientState('startup_without_valid_session', !hasSharedOwner);
    };

    // AUTH FIRST, DATA SECOND pattern:
    // 1. Set auth state immediately from Supabase session.
    // 2. Fetch profile metadata non-blocking in background.
    // Profile fetch failure must NEVER block login.

    const initializeAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        initSessionPromiseRef.current = sessionPromise;
        const { data: { session } } = await sessionPromise;
        if (!alive || eventVersion !== 0 || initialVersion !== getClientStateVersion() || logoutRequested.current) return;

        if (session && session.user) {
          authDebug('Session detected, initializing state');
          acceptSession(session);
        } else {
          await handleStartupWithoutSession();
        }
      } catch {
        if (alive && eventVersion === 0 && !isDemoModeRef.current) {
          startupHandledRef.current = true;
          resetClientState('auth_invalidated');
        }
      } finally {
        initSessionPromiseRef.current = null;
      }
    };

    initializeAuth();

    // SDK SIGNED_OUT normally handles other tabs. A failed remote sign-out does
    // not emit it, so the ownership marker supplies a storage-event fallback.
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && event.key === clientStateOwnerKey &&
          !currentClientScope.current()) {
        logoutRequested.current = true;
        resetClientState('auth_invalidated', true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        eventVersion++;
        if (!alive) return;

        if (session && session.user) {
          if (logoutRequested.current && session.user.id === lastAcceptedUserId.current) return;
          logoutRequested.current = false;
          authDebug('Auth state changed: SIGNED_IN');
          acceptSession(session);
        } else if (event === 'INITIAL_SESSION') {
          void handleStartupWithoutSession();
        } else if (!isDemoModeRef.current && !hasPersistedDemoClientState(mockUser.id)) {
          authDebug('Auth state changed: SIGNED_OUT');
          resetClientState('auth_invalidated', logoutRequested.current);
        }
      }
    );

    return () => {
      alive = false;
      cancelPendingProbe?.();
      window.removeEventListener('storage', handleStorageChange);
      try { demoChannel?.close(); } catch { /* ignore */ }
      subscription.unsubscribe();
    };
  }, []);

  // Best-effort: fetch profile and effective plan from DB and merge into state.
  // If this fails for any reason, the user remains logged in from Auth data.
  const fetchAndMergeProfile = async (sbUser: any, isInitial = false) => {
    const isCurrentUser = captureUserClientState(sbUser.id);
    if (isInitial) {
      setIsProfileLoading(true);
      authDebug('Starting INITIAL profile fetch', sbUser.id);
    } else {
      authDebug('Starting BACKGROUND profile refresh', sbUser.id);
    }

    try {
      // Fetch both profile and effective plan in parallel
      const [profileRes, effectivePlanRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, name, plan, plan_expires_at, plan_updated_at, age_band, account_status, user_role, school_type, education_level, grade_level, postal_code, profile_completed, profile_completed_at, pending_preapproval_since')
          .eq('id', sbUser.id)
          .maybeSingle(),
        supabase.rpc('get_my_effective_plan')
      ]);
      if (!isCurrentUser()) return;

      const dbProfile = profileRes.data;
      const effectiveData = effectivePlanRes.data;

      if (profileRes.error) return;

      if (dbProfile) {
        setIsProfileMissing(false);
        authDebug('Profile loaded from DB', { status: dbProfile.account_status, isInitial });
        let user = mapSupabaseUser(sbUser, dbProfile);
        
        // Merge effective plan data if available
        if (effectiveData && !effectiveData.error) {
          user = {
            ...user,
            effectivePlan: effectiveData.effective_plan,
            planSource: effectiveData.plan_source,
            inheritedFromParent: effectiveData.inherited_from_parent,
            sourcePlanExpiresAt: effectiveData.source_plan_expires_at
          };
        }

        setState(prev => isCurrentUser() && prev.user?.id === sbUser.id ? { ...prev, user } : prev);

        // ── Self-Healing Metadata ───────────────────────────────────────────
        const activeStatuses = ['active', 'parent_approved'];
        const currentMetaStatus = sbUser.user_metadata?.accountStatus;
        
        if (
          activeStatuses.includes(dbProfile.account_status) && 
          currentMetaStatus !== dbProfile.account_status &&
          currentMetaStatus !== 'active'
        ) {
          authDebug('Self-healing metadata detected', { from: currentMetaStatus, to: dbProfile.account_status });
          void supabase.auth.updateUser({
            data: { accountStatus: dbProfile.account_status }
          }).catch(err => authDebug('Self-healing update failed', err));
        }
      } else {
        setIsProfileMissing(true);
        authDebug('No profile record found in DB during merge');
      }
    } catch (err) {
      authDebug('Profile fetch/merge encountered an error', err);
    } finally {
      if (isCurrentUser() && isInitial) {
        setIsProfileLoading(false);
        authDebug('INITIAL profile fetch complete');
      } else if (isCurrentUser()) {
        authDebug('BACKGROUND profile refresh complete');
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    logoutRequested.current = false;
    clearDemoClientState();
    isDemoModeRef.current = false;
    setIsDemoMode(false);
    if (initSessionPromiseRef.current) {
      try {
        await initSessionPromiseRef.current;
      } catch {
        // Ignore initial session lookup errors before explicit login
      }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error(error);
      return false;
    }
    
    return true;
  };

  const register = async (email: string, password: string, name: string, ageBand: string, userRole: string = 'student') => {
    setIsDemoMode(false);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          ageBand,
          user_role: userRole
        }
      }
    });

    if (error) {
      console.error("SignUp Error:", error);
      let errorMessage = error.message;
      if (errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'Przekroczono chwilowy limit prób mailowych. Odczekaj chwilę i spróbuj ponownie.';
      } else if (errorMessage.toLowerCase().includes('password')) {
        errorMessage = 'Hasło jest zbyt proste lub brakuje mu znaków (minimum 6).';
      }
      return { success: false, message: errorMessage };
    }

    // Supabase obfuscates "User Already Exists" by returning a fake success with an empty identities array
    // to prevent email enumeration. We must check this to provide explicit UX feedback.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { success: false, message: "Konto powiązane z tym adresem email już istnieje." };
    }

    // If session is null, it means email confirmation is required before login
    if (data.user && !data.session) {
      return { success: true, requireEmailVerification: true };
    }

    return { success: true };
  };

  const logout = async (reason: 'logout' | 'account_delete' = 'logout') => {
    const wasDemo = isDemoModeRef.current || isDemoMode || hasPersistedDemoClientState(mockUser.id);
    logoutRequested.current = true;
    clearDemoClientState();
    resetClientState(reason);
    if (wasDemo) {
      lastAcceptedUserId.current = null;
    } else {
      // Preserve the existing SDK default scope (global). Do not edit SDK keys.
      try {
        const { error } = await supabase.auth.signOut();
        if (error) console.warn('Auth sign-out failed; educational client state was cleared');
      } catch {
        console.warn('Auth sign-out unavailable; educational client state was cleared');
      }
    }
  };

  const loginAsDemo = () => {
    if (!isDemoModeRef.current && !logoutRequested.current && state.isAuthenticated && state.user && state.user.id !== mockUser.id) {
      authDebug('Ignoring loginAsDemo because a real authenticated session is active');
      return;
    }
    logoutRequested.current = false;
    startupHandledRef.current = true;
    applyDemoSession();
  };

  const refreshUser = async (): Promise<RefreshUserResult> => {
    if (isDemoMode) return { success: true };
    if (!state.user) return { success: false, reason: 'auth_unavailable' };
    const isCurrentUser = captureUserClientState(state.user.id);

    try {
      const { data: { user: sbUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !sbUser || sbUser.id !== state.user.id || !isCurrentUser()) return { success: false, reason: 'auth_unavailable' };

      const [profileRes, effectivePlanRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, name, plan, plan_expires_at, plan_updated_at, age_band, account_status, user_role, school_type, education_level, grade_level, postal_code, profile_completed, profile_completed_at, pending_preapproval_since')
          .eq('id', sbUser.id)
          .maybeSingle(),
        supabase.rpc('get_my_effective_plan')
      ]);
      if (!isCurrentUser()) return { success: false, reason: 'auth_unavailable' };

      const dbProfile = profileRes.data;
      const effectiveData = effectivePlanRes.data;

      // A failed read is not evidence that the authoritative profile is missing.
      // Keep the last trusted authorization fields until a successful refresh.
      if (profileRes.error) return { success: false, reason: 'profile_refresh_failed' };
      if (!dbProfile) {
        setIsProfileMissing(true);
        return { success: false, reason: 'profile_missing' };
      }

      let user = mapSupabaseUser(sbUser, dbProfile);
      
      if (effectiveData && !effectiveData.error) {
        user = {
          ...user,
          effectivePlan: effectiveData.effective_plan,
          planSource: effectiveData.plan_source,
          inheritedFromParent: effectiveData.inherited_from_parent,
          sourcePlanExpiresAt: effectiveData.source_plan_expires_at
        };
      }

      setState(prev => isCurrentUser() && prev.user?.id === sbUser.id ? { ...prev, user } : prev);
      setIsProfileMissing(false);
      return { success: true };
    } catch {
      return { success: false, reason: 'profile_refresh_failed' };
    }
  };

  const updateProfile = async (updates: any): Promise<{ success: boolean; error?: string }> => {
    if (isDemoMode) {
      if (state.user) {
        setState(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, ...updates } : null
        }));
      }
      return { success: true };
    }

    const profileUpdateError = 'Nie udało się zaktualizować profilu.';

    try {
      // 1. Update Auth user metadata (for fields like name)
      const authUpdates: any = {};
      if (updates.name) authUpdates.name = updates.name;
      
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.updateUser({
          data: authUpdates
        });
        if (authError) throw authError;
      }

      // 2. Update Public Profile
      const dbUpdates: any = {};
      if ("name" in updates) dbUpdates.name = updates.name;
      if ("userRole" in updates) dbUpdates.user_role = updates.userRole;
      if ("schoolType" in updates) dbUpdates.school_type = updates.schoolType;
      if ("educationLevel" in updates) dbUpdates.education_level = updates.educationLevel;
      if ("gradeLevel" in updates) dbUpdates.grade_level = updates.gradeLevel;
      if ("postalCode" in updates) dbUpdates.postal_code = updates.postalCode;
      if ("profileCompleted" in updates) dbUpdates.profile_completed = updates.profileCompleted;
      if ("profileCompletedAt" in updates) dbUpdates.profile_completed_at = updates.profileCompletedAt;

      if (Object.keys(dbUpdates).length > 0 && state.user?.id) {
        dbUpdates.id = state.user.id;
        
        // Update existing profiles only; creation belongs to the Auth trigger.
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', state.user.id)
          .select();
          
        if (updateError) throw updateError;
        
        if (!updateData || updateData.length === 0) {
          return { success: false, error: profileUpdateError };
        }
      }

      // 3. Refresh local state
      await refreshUser();
      
      return { success: true };
    } catch {
      console.error("Update Profile Error");
      return { success: false, error: profileUpdateError };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        loginAsDemo,
        updateProfile,
        refreshUser,
        isDemoMode,
        isProfileLoading,
        isProfileMissing,
      }}
    >
      <Fragment key={clientStateVersion}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
