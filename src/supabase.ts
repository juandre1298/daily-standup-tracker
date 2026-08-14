/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  localStorage.getItem('SUPABASE_URL') || 
  '';

const supabaseKey = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  localStorage.getItem('SUPABASE_ANON_KEY') || 
  '';

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export interface Participant {
  id: string;
  name: string;
  has_spoken: boolean;
  is_absent: boolean;
  created_at?: string;
}
