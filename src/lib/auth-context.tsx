import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthState, User } from '../types';
import { mockUser } from '../mock/data';
import { supabase } from './supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, ageBand: string) => Promise<{ success: boolean; message?: string; requireEmailVerification?: boolean }>;
  logout: () => void;
  loginAsDemo: () => void;
  updateProfile: (updates: { name?: string }) => Promise<{ success: boolean; error?: string }>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUser = (sbUser: any): User => ({
  id: sbUser.id,
  email: sbUser.email,
  name: sbUser.user_metadata?.name || 'User',
  plan: 'free',
  createdAt: new Date(sbUser.created_at),
  ageBand: sbUser.user_metadata?.ageBand,
  accountStatus: sbUser.user_metadata?.accountStatus || 'active'
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
    // Check initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user && !isDemoMode) {
          setState({
            user: mapSupabaseUser(session.user),
            isAuthenticated: true,
            isLoading: false,
          });
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
        if (isDemoMode) return; // Ignore Supabase events if in demo mode
        
        if (session && session.user) {
          setState({
            user: mapSupabaseUser(session.user),
            isAuthenticated: true,
            isLoading: false,
          });
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

  const updateProfile = async (updates: { name?: string }): Promise<{ success: boolean; error?: string }> => {
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
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) throw error;

      if (data.user) {
        setState(prev => ({
          ...prev,
          user: mapSupabaseUser(data.user)
        }));
      }
      
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
