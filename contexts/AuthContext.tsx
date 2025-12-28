// File: contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, User as SupabaseUser } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  is_admin?: boolean;
  user_type?: 'individual' | 'parent' | 'guest';
  goals?: string[];
  check_in_frequency?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        checkAsyncStorageAuth();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAsyncStorageAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error checking AsyncStorage auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      const userData: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: 'user',
        user_type: data.user_type,
        is_admin: data.is_admin || false,
        goals: data.goals,
        check_in_frequency: data.check_in_frequency,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setUser(userData);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please login instead.');
        } else if (authError.message.includes('invalid')) {
          throw new Error('Please enter a valid email address.');
        } else {
          throw authError;
        }
      }

      if (!authData.user) {
        throw new Error('No user returned from signup');
      }

      console.log('✅ Auth user created:', authData.user.id);

      // Set session immediately BEFORE any other operations
      if (authData.session) {
        setSession(authData.session);
        await AsyncStorage.setItem('authToken', authData.session.access_token);
        console.log('✅ Session set in context');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      console.log('✅ User profile created');

      const userData: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: 'user',
        user_type: profileData.user_type,
        goals: profileData.goals,
        check_in_frequency: profileData.check_in_frequency,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
      };

      setUser(userData);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('✅ User signed up successfully');
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        if (data.session) {
          setSession(data.session);
          await AsyncStorage.setItem('authToken', data.session.access_token);
        }
        await fetchUserProfile(data.user.id);
        console.log('✅ User logged in successfully');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');

      setUser(null);
      setSession(null);
      console.log('✅ User logged out successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Failed to logout');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    try {
      setIsLoading(true);

      // Get user ID - check multiple sources
      let userId = user?.id;
      
      if (!userId) {
        console.log('⚠️ No user in context, checking session state...');
        
        // Check React state session first
        if (session?.user?.id) {
          userId = session.user.id;
          console.log('✅ Got user ID from React session state:', userId);
        }
      }

      // If still no userId, fetch from Supabase
      if (!userId) {
        console.log('⚠️ No session in state, fetching from Supabase...');
        const { data: { session: fetchedSession } } = await supabase.auth.getSession();
        
        if (fetchedSession?.user?.id) {
          userId = fetchedSession.user.id;
          console.log('✅ Got user ID from Supabase session:', userId);
        }
      }

      // Final check
      if (!userId) {
        throw new Error('No active session. Please try logging in again.');
      }

      // Remove read-only fields
      const { role, id, email, created_at, updated_at, ...supabaseData } = data;

      console.log('📝 Updating profile for user:', userId);
      console.log('📝 Update data:', JSON.stringify(supabaseData, null, 2));

      const { error } = await supabase
        .from('users')
        .update(supabaseData)
        .eq('id', userId);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      // Refresh user profile
      await fetchUserProfile(userId);
      console.log('✅ User profile updated successfully');
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw new Error(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session && !!user,
        signup,
        login,
        logout,
        setUser,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};