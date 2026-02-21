import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Store from 'electron-store';
import { safeStorage } from 'electron';

// Supabase project credentials (anon key is designed to be public, security is via RLS)
const SUPABASE_URL = 'https://bvfiguherguupddrdcdl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZmlndWhlcmd1dXBkZHJkY2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODgxNTcsImV4cCI6MjA4NzI2NDE1N30.cGr9g7tjOcGEvWqB-727-EvOs8zKDICqnOr74HK2nRg';

// Encrypted session storage using electron-store + safeStorage
const sessionStore = new Store({ name: 'supabase-session' });

const customStorage = {
  getItem: (key: string): string | null => {
    const encrypted = sessionStore.get(key) as string | undefined;
    if (!encrypted) return null;
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    const encrypted = safeStorage.encryptString(value).toString('base64');
    sessionStore.set(key, encrypted);
  },
  removeItem: (key: string): void => {
    sessionStore.delete(key);
  },
};

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}
