
import { createClient } from '@supabase/supabase-js';

// Get URL and Key from environment variables if available, otherwise use hardcoded fallbacks
const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const envKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

export const SUPABASE_URL = envUrl || 'https://ajgrlnqzwwdliaelvgoq.supabase.co'; 
export const SUPABASE_ANON_KEY = envKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZ3JsbnF6d3dkbGlhZWx2Z29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzQ5NjAsImV4cCI6MjA4NjA1MDk2MH0.Y39Ly94CXedvrheLKYZB8DYKwZjr6rJlaDOq_8crVkU';

export const MASTER_USER_ID = '329a8566-838f-4e61-a91c-2e6c6d492420';
export const PRIMARY_ADMIN = 'rajshahi.jibon@gmail.com';

// Conditionally create the client to prevent URL constructor errors if URL is missing or invalid
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const supabase = isValidUrl(SUPABASE_URL) && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

if (!supabase) {
  console.warn("Supabase is not initialized. Please check your environment variables or hardcoded credentials.");
}
