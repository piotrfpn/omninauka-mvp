import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthState, User } from '../types';
import { mockUser } from '../mock/data';
import { supabase } from './supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, ageBand: string) => Promise<{ success: boolean; message?: string; requireEmailVerification?: boolean }>;
  logout: () => void;
  loginAsDemo: () => void;
  updateProfile: (updates: any) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  isDemoMode: boolean;
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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Track if user is explicitly in demo mode
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // AUTH FIRST, DATA SECOND pattern:
    // 1. Set auth state immediately from Supabase session.
    // 2. Fetch profile metadata non-blocking in background.
    // Profile fetch failure must NEVER block login.

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user && !isDemoMode) {
          // Step 1: Set authenticated state immediately
          setState({
            user: mapSupabaseUser(session.user),
            isAuthenticated: true,
            isLoading: false,
          });

          // Step 2: Enrich with profile data non-blocking (best-effort)
          void fetchAndMergeProfile(session.user);
        } else if (!isDemoMode) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Auth session error:", error);
        if (!isDemoMode) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isDemoMode) return;

        if (session && session.user) {
          // Step 1: Set authenticated state immediately from Auth data
          setState({
            user: mapSupabaseUser(session.user),
            isAuthenticated: true,
            isLoading: false,
          });

          // Step 2: Enrich with profile data non-blocking (best-effort)
          void fetchAndMergeProfile(session.user);
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  // Best-effort: fetch profile from DB and merge into state.
  // If this fails for any reason, the user remains logged in from Auth data.
  const fetchAndMergeProfile = async (sbUser: any) => {
    try {
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle(); // maybeSingle() returns null (no error) when row doesn't exist

      if (dbProfile) {
        setState(prev => ({
          ...prev,
          user: mapSupabaseUser(sbUser, dbProfile),
        }));
      }
    } catch {
      // Profile fetch failure is non-fatal. User stays logged in.
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

  const register = async (email: string, password: string, name: string, ageBand: string) => {
    setIsDemoMode(false);
    
    // Initial status based on age band logic (matching the DB trigger)
    const initialStatus = ageBand === '13_15' ? 'pending_parent_consent' : 'active';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          ageBand,
          accountStatus: initialStatus
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
  };

  const refreshUser = async () => {
    if (isDemoMode || !state.user) return;

    try {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (!sbUser) return;

      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle(); // maybeSingle() avoids error when row doesn't exist

      setState(prev => ({
        ...prev,
        user: mapSupabaseUser(sbUser, dbProfile ?? undefined)
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
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.userRole) dbUpdates.user_role = updates.userRole;
      if (updates.schoolType) dbUpdates.school_type = updates.schoolType;
      if (updates.educationLevel) dbUpdates.education_level = updates.educationLevel;
      if (updates.gradeLevel) dbUpdates.grade_level = updates.gradeLevel;
      if (updates.postalCode) dbUpdates.postal_code = updates.postalCode;
      if (updates.profileCompleted !== undefined) dbUpdates.profile_completed = updates.profileCompleted;
      if (updates.profileCompletedAt) dbUpdates.profile_completed_at = updates.profileCompletedAt;

      if (Object.keys(dbUpdates).length > 0) {
        const { error: dbError } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', state.user?.id);
        
        if (dbError) throw dbError;
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
