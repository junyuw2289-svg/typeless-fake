import { create } from 'zustand';
import type { AuthUser } from '../../shared/types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  setUser: (user) => set({ user, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const result = await window.electronAPI.authGetSession();
      set({
        user: result.isAuthenticated ? result.user! : null,
        isLoading: false,
      });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.authSignInWithGoogle();
      // Google OAuth opens browser — session will arrive via deep link callback
      // and auth state change listener, so we just stop loading
      set({ isLoading: false });
      if (!result.success) {
        set({ error: result.error || 'Failed to start Google sign-in' });
        return false;
      }
      return true;
    } catch (e) {
      set({ error: 'Connection error', isLoading: false });
      return false;
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.authSignIn(email, password);
      if (result.success) {
        set({ user: result.user!, isLoading: false });
        return true;
      } else {
        set({ error: result.error!, isLoading: false });
        return false;
      }
    } catch (e) {
      set({ error: 'Connection error', isLoading: false });
      return false;
    }
  },

  signUp: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.authSignUp(email, password, displayName);
      if (result.success) {
        set({ user: result.user!, isLoading: false });
        return true;
      } else {
        set({ error: result.error!, isLoading: false });
        return false;
      }
    } catch (e) {
      set({ error: 'Connection error', isLoading: false });
      return false;
    }
  },

  signOut: async () => {
    await window.electronAPI.authSignOut();
    set({ user: null });
  },
}));
