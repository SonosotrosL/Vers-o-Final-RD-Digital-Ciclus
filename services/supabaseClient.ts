
import { createClient } from '@supabase/supabase-js';

// Função segura para pegar variáveis de ambiente
const getEnv = (key: string): string => {
  try {
    return process.env[key] || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

// Verifica se o Supabase foi realmente configurado com valores válidos
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  supabaseUrl !== 'https://placeholder-project.supabase.co'
);

// Fallbacks seguros
const finalUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const finalKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key';

// Inicializa o cliente sem crashar
export const supabase = createClient(finalUrl, finalKey);

if (!isSupabaseConfigured) {
  console.info("⚙️ Modo Local Ativo: O Supabase não foi detectado no ambiente.");
}
