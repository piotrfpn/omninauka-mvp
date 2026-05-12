import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthState, User } from '../types';
import { mockUser } from '../mock/data';
import { supabase } from './supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, ageBand: string, userRole?: string) => Promise<{ success: boolean; message?: string; requireEmailVerification?: boolean }>;
  logout: () => void;
  loginAsDemo: () => void;
  updateProfile: (updates: any) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  isDemoMode: boolean;
  isProfileLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUser = (sbUser: any, dbProfile?: any): User => ({
  id: sbUser.id,
  email: sbUser.email,
  name: dbProfile?.name || sbUser.user_metadata?.name || 'User',
  plan: dbProfile?.plan || 'free',
  createdAt: new Date(sbUser.created_at),
  ageBand: dbProfile?.age_band || sbUser.user_metadata?.ageBand,
  accountStatus: dbProfile?.account_status || sbUser.user_metadata?.accountStatus || 'active',
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
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Debug helper
  const authDebug = (msg: string, data?: any) => {
    if (new URLSearchParams(window.location.search).get('uploadDebug') === '1') {
      console.log('[auth-debug]', msg, data);
    }
  };

  useEffect(() => {
    // AUTH FIRST, DATA SECOND pattern:
    // 1. Set auth state immediately from Supabase session.
    // 2. Fetch profile metadata non-blocking in background.
    // Profile fetch failure must NEVER block login.

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user && !isDemoMode) {
          authDebug('Session detected, initializing state');
          // Step 1: Set authenticated state immediately
          setState({
            user: mapSupabaseUser(session.user),
            isAuthenticated: true,
            isLoading: false,
          });

          // Step 2: Enrich with profile data non-blocking (best-effort)
          // INITIAL load if we just mounted
          void fetchAndMergeProfile(session.user, true);
        } else if (!isDemoMode) {
          authDebug('No session detected');
          setState(prev => ({ ...prev, isLoading: false }));
          setIsProfileLoading(false);
        }
      } catch (error) {
        authDebug('Auth session error', error);
        console.error("Auth session error:", error);
        if (!isDemoMode) {
          setState(prev => ({ ...prev, isLoading: false }));
          setIsProfileLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isDemoMode) return;

        if (session && session.user) {
          authDebug('Auth state changed: SIGNED_IN');
          // Step 1: Set authenticated state immediately from Auth data
          setState({
            user: mapSupabaseUser(session.user),
            isAuthenticated: true,
            isLoading: false,
          });

          // Step 2: Enrich with profile data non-blocking (best-effort)
          // BACKGROUND refresh if user already exists
          void fetchAndMergeProfile(session.user, false);
        } else {
          authDebug('Auth state changed: SIGNED_OUT');
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          setIsProfileLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  // Best-effort: fetch profile and effective plan from DB and merge into state.
  // If this fails for any reason, the user remains logged in from Auth data.
  const fetchAndMergeProfile = async (sbUser: any, isInitial = false) => {
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

      const dbProfile = profileRes.data;
      const effectiveData = effectivePlanRes.data;

      if (dbProfile) {
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

        setState(prev => ({
          ...prev,
          user,
        }));

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
        authDebug('No profile record found in DB during merge');
      }
    } catch (err) {
      authDebug('Profile fetch/merge encountered an error', err);
    } finally {
      if (isInitial) {
        setIsProfileLoading(false);
        authDebug('INITIAL profile fetch complete');
      } else {
        authDebug('BACKGROUND profile refresh complete');
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsDemoMode(false);
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
    
    // Initial status based on age band logic (matching the DB trigger and guard)
    let initialStatus = 'active';
    if (ageBand === '13_15') initialStatus = 'pending_parent_consent';
    if (ageBand === 'under_13') initialStatus = 'pending_parent_preapproval';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          ageBand,
          accountStatus: initialStatus,
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

  const logout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setState({ user: null, isAuthenticated: false, isLoading: false });
    } else {
      await supabase.auth.signOut();
    }
  };

  const loginAsDemo = () => {
    setIsDemoMode(true);
    setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
    });
    setIsProfileLoading(false);
  };

  const refreshUser = async () => {
    if (isDemoMode || !state.user) return;

    try {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (!sbUser) return;

      const [profileRes, effectivePlanRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, name, plan, plan_expires_at, plan_updated_at, age_band, account_status, user_role, school_type, education_level, grade_level, postal_code, profile_completed, profile_completed_at, pending_preapproval_since')
          .eq('id', sbUser.id)
          .maybeSingle(),
        supabase.rpc('get_my_effective_plan')
      ]);

      const dbProfile = profileRes.data;
      const effectiveData = effectivePlanRes.data;

      let user = mapSupabaseUser(sbUser, dbProfile ?? undefined);
      
      if (effectiveData && !effectiveData.error) {
        user = {
          ...user,
          effectivePlan: effectiveData.effective_plan,
          planSource: effectiveData.plan_source,
          inheritedFromParent: effectiveData.inherited_from_parent,
          sourcePlanExpiresAt: effectiveData.source_plan_expires_at
        };
      }

      setState(prev => ({
        ...prev,
        user
      }));
    } catch (error) {
      console.error("Refresh User Error:", error);
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
        
        // Strategy A: Update first
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', state.user.id)
          .select();
          
        if (updateError) throw updateError;
        
        // If profile doesn't exist yet, fallback to upsert with required NOT NULL columns
        if (!updateData || updateData.length === 0) {
          const fullPayload = {
            ...dbUpdates,
            email: state.user.email || '',
            name: state.user.name || "User",
            plan: state.user.plan || "free"
          };
          
          const { error: upsertError } = await supabase
            .from('profiles')
            .upsert(fullPayload, { onConflict: 'id' });
            
          if (upsertError) throw upsertError;
        }
      }

      // 3. Refresh local state
      await refreshUser();
      
      return { success: true };
    } catch (error: any) {
      console.error("Update Profile Error:", error);
      return { success: false, error: error.message };
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
      }}
    >
      {children}
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
