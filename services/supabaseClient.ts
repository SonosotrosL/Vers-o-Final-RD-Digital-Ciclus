
import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Flag to check if we should use Supabase or fallback to LocalStorage
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder-project.supabase.co');

// Initialize with placeholders if not configured to prevent "URL required" crash
const finalUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

if (!isSupabaseConfigured) {
  console.warn("Supabase não configurado. O aplicativo usará Armazenamento Local (LocalStorage). Para usar o banco de dados em nuvem, configure as variáveis SUPABASE_URL e SUPABASE_ANON_KEY no Vercel/Ambiente.");
}

export const supabase = createClient(finalUrl, finalKey);
