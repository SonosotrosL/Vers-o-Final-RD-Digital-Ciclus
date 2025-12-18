
import { RDData, RDStatus, Employee, User, UserRole } from "../types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// --- Utilitários LocalStorage ---

const getLocal = <T>(key: string, defaultValue: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveLocal = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- RDs (Relatórios Diários) ---

export const getRDs = async (): Promise<RDData[]> => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('rds')
        .select('*')
        .order('date', { ascending: false });

      if (!error) return data || [];
      console.warn("Supabase fetch error, falling back to local:", error);
    } catch (e) {
      console.error("Supabase connection failed:", e);
    }
  }
  return getLocal<RDData[]>('ciclus_rds_local', []);
};

export const saveRD = async (rd: RDData): Promise<RDData> => {
  // Sempre salva no local como backup/cache
  const localRds = getLocal<RDData[]>('ciclus_rds_local', []);
  
  if (isSupabaseConfigured) {
    try {
      if (!rd.id || rd.id === '') {
        const { id, ...dataToInsert } = rd;
        const { data, error } = await supabase.from('rds').insert([dataToInsert]).select().single();
        if (!error) return data;
      } else {
        const { data, error } = await supabase.from('rds').update(rd).eq('id', rd.id).select().single();
        if (!error) return data;
      }
    } catch (e) {
      console.error("Supabase save failed, using local only", e);
    }
  }

  // Fallback Local
  if (!rd.id) rd.id = `RD-${Date.now()}`;
  const idx = localRds.findIndex(r => r.id === rd.id);
  if (idx > -1) localRds[idx] = rd;
  else localRds.push(rd);
  saveLocal('ciclus_rds_local', localRds);
  return rd;
};

export const deleteRD = async (id: string): Promise<void> => {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('rds').delete().eq('id', id);
    } catch (e) {}
  }
  const rds = getLocal<RDData[]>('ciclus_rds_local', []);
  saveLocal('ciclus_rds_local', rds.filter(r => r.id !== id));
};

export const updateRDStatus = async (id: string, status: RDStatus, note?: string): Promise<void> => {
  if (isSupabaseConfigured) {
    try {
      const updatePayload: any = { status };
      if (note !== undefined) updatePayload.supervisorNote = note;
      await supabase.from('rds').update(updatePayload).eq('id', id);
    } catch (e) {}
  }
  
  const rds = getLocal<RDData[]>('ciclus_rds_local', []);
  const idx = rds.findIndex(r => r.id === id);
  if (idx > -1) {
    rds[idx].status = status;
    if (note !== undefined) rds[idx].supervisorNote = note;
    saveLocal('ciclus_rds_local', rds);
  }
};

// --- Funcionários ---

export const getEmployees = async (): Promise<Employee[]> => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('employees').select('*').order('name');
      if (!error) return data || [];
    } catch (e) {}
  }
  return getLocal<Employee[]>('ciclus_employees_local', []);
};

export const saveEmployee = async (employee: Employee): Promise<Employee> => {
  if (isSupabaseConfigured) {
    try {
      if (!employee.id) {
        const { id, ...ins } = employee;
        const { data, error } = await supabase.from('employees').insert([ins]).select().single();
        if (!error) return data;
      } else {
        const { data, error } = await supabase.from('employees').update(employee).eq('id', employee.id).select().single();
        if (!error) return data;
      }
    } catch (e) {}
  }

  const emps = getLocal<Employee[]>('ciclus_employees_local', []);
  if (!employee.id) employee.id = `EMP-${Date.now()}`;
  const idx = emps.findIndex(e => e.id === employee.id);
  if (idx > -1) emps[idx] = employee;
  else emps.push(employee);
  saveLocal('ciclus_employees_local', emps);
  return employee;
};

export const deleteEmployee = async (id: string): Promise<void> => {
  if (isSupabaseConfigured) {
    try { await supabase.from('employees').delete().eq('id', id); } catch (e) {}
  }
  const emps = getLocal<Employee[]>('ciclus_employees_local', []);
  saveLocal('ciclus_employees_local', emps.filter(e => e.id !== id));
};

export const getExistingRoles = async (): Promise<string[]> => {
  const defaultRoles = ['Ajudante', 'Gari', 'Pintor', 'Roçador', 'OP. Roçadeira', 'ASG', 'Motorista'];
  const emps = await getEmployees();
  return Array.from(new Set([...defaultRoles, ...emps.map(e => e.role)])).sort();
};

// --- Usuários e Autenticação ---

export const getUsers = async (): Promise<User[]> => {
  let dbUsers: User[] = [];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (!error) dbUsers = data || [];
    } catch (e) {}
  }
  
  const localUsers = getLocal<User[]>('ciclus_users_local', []);
  
  // Se não houver nenhum usuário em lugar nenhum, injeta o admin padrão
  if (dbUsers.length === 0 && localUsers.length === 0) {
    return [{ 
      id: 'admin-id', 
      name: 'Administrador Local', 
      registration: 'admin', 
      password: 'admin', 
      role: UserRole.CCO 
    }];
  }
  
  return [...dbUsers, ...localUsers];
};

export const saveUser = async (user: User): Promise<User> => {
  if (isSupabaseConfigured) {
    try {
       if (!user.id) {
         const { id, ...ins } = user;
         const { data, error } = await supabase.from('users').insert([ins]).select().single();
         if (!error) return data;
       } else {
         const { data, error } = await supabase.from('users').update(user).eq('id', user.id).select().single();
         if (!error) return data;
       }
    } catch (e) {}
  }
  const users = getLocal<User[]>('ciclus_users_local', []);
  if (!user.id) user.id = `USR-${Date.now()}`;
  users.push(user);
  saveLocal('ciclus_users_local', users);
  return user;
};

export const deleteUser = async (id: string): Promise<void> => {
  if (isSupabaseConfigured) {
    try { await supabase.from('users').delete().eq('id', id); } catch (e) {}
  }
  const users = getLocal<User[]>('ciclus_users_local', []);
  saveLocal('ciclus_users_local', users.filter(u => u.id !== id));
};

export const authenticate = async (reg: string, pass: string): Promise<User | null> => {
  // Primeiro tenta no Supabase se configurado
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('registration', reg).eq('password', pass).maybeSingle();
      if (!error && data) {
        localStorage.setItem('ciclus_user', JSON.stringify(data));
        return data;
      }
    } catch (e) {}
  }

  // Fallback: Busca nos usuários locais ou o admin padrão
  const users = await getUsers();
  const found = users.find(u => u.registration === reg && u.password === pass);
  if (found) {
    localStorage.setItem('ciclus_user', JSON.stringify(found));
    return found;
  }
  return null;
};

export const getCachedUser = (): User | null => {
  const stored = localStorage.getItem('ciclus_user');
  return stored ? JSON.parse(stored) : null;
};

export const logout = () => { localStorage.removeItem('ciclus_user'); };
