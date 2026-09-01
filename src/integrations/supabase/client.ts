import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cptvplkhvscwrrhzhojh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwdHZwbGtodnNjd3JyaHpob2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDYzNjMsImV4cCI6MjA4Njk4MjM2M30.JUP6TP9FC5noqQz47DVV1wvtLFDlnFWYQgrZC5n4w0I";

export const SUPABASE_URL_VALUE = SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY_VALUE = SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
