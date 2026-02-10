const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

if (!SUPABASE_URL) {
  throw new Error('Missing VITE_SUPABASE_URL');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY');
}

export const env = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  API_URL
};
