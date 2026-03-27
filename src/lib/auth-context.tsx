import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthState, User } from '../types';
import { mockUser } from '../mock/data';
import { supabase } from './supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  loginAsDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapSupabaseUser = (sbUser: any): User => ({
  id: sbUser.id,
  email: sbUser.email,
  name: sbUser.user_metadata?.name || 'User',
  plan: 'free',
  createdAt: new Date(sbUser.created_at)
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

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsDemoMode(false);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        }
      }
    });

    if (error) {
      console.error(error);
      return false;
    }
    return true;
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

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        loginAsDemo,
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
