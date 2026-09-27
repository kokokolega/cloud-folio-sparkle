import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://owpuwzkcnhkcgpwvlsgb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHV3emtjbmhrY2dwd3Zsc2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQwNTcsImV4cCI6MjEwMTg0MDA1N30.bJGbLjmZ_gqiAXPSxtdAL1mcRpB8cpYifK2Hofu_M_o";

export const SUPABASE_URL_VALUE = SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY_VALUE = SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
