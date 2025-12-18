
import { createClient } from '@supabase/supabase-js';

// No Vercel, estas variáveis virão do ambiente. 
// No AI Studio/Local, elas podem estar vazias.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Verifica se o Supabase foi realmente configurado com valores válidos
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  supabaseUrl !== 'https://placeholder-project.supabase.co'
);

// Fallbacks para evitar que o SDK do Supabase lance exceção no construtor
const finalUrl = isSupabaseConfigured ? supabaseUrl! : 'https://placeholder-project.supabase.co';
const finalKey = isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey);

if (!isSupabaseConfigured) {
  console.info("⚙️ Modo Local Ativo: O Supabase não foi configurado. Os dados serão salvos apenas neste dispositivo.");
}
