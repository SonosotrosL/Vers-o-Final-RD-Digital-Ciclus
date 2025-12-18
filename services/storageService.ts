
import { RDData, RDStatus, Employee, User, UserRole } from "../types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// --- LocalStorage Fallback Logic ---

const getLocal = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const saveLocal = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- RDs ---

export const getRDs = async (): Promise<RDData[]> => {
  if (!isSupabaseConfigured) {
    return getLocal<RDData[]>('ciclus_rds_local', []);
  }

  const { data, error } = await supabase
    .from('rds')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error("Error fetching RDs from Supabase:", error);
    return getLocal<RDData[]>('ciclus_rds_local', []);
  }
  return data || [];
};

export const saveRD = async (rd: RDData): Promise<RDData> => {
  if (!isSupabaseConfigured) {
    const rds = getLocal<RDData[]>('ciclus_rds_local', []);
    if (!rd.id) {
      rd.id = `RD-${Date.now()}`;
      rds.push(rd);
    } else {
      const idx = rds.findIndex(r => r.id === rd.id);
      if (idx > -1) rds[idx] = rd;
      else rds.push(rd);
    }
    saveLocal('ciclus_rds_local', rds);
    return rd;
  }

  if (!rd.id || rd.id === '') {
    const { id, ...dataToInsert } = rd;
    const { data, error } = await supabase
      .from('rds')
      .insert([dataToInsert])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('rds')
      .update(rd)
      .eq('id', rd.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

export const deleteRD = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    const rds = getLocal<RDData[]>('ciclus_rds_local', []);
    saveLocal('ciclus_rds_local', rds.filter(r => r.id !== id));
    return;
  }

  const { error } = await supabase
    .from('rds')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const updateRDStatus = async (id: string, status: RDStatus, note?: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    const rds = getLocal<RDData[]>('ciclus_rds_local', []);
    const idx = rds.findIndex(r => r.id === id);
    if (idx > -1) {
      rds[idx].status = status;
      if (note !== undefined) rds[idx].supervisorNote = note;
      if (status === RDStatus.PENDING) rds[idx].supervisorNote = undefined;
      saveLocal('ciclus_rds_local', rds);
    }
    return;
  }

  const updatePayload: any = { status };
  if (note !== undefined) updatePayload.supervisorNote = note;
  if (status === RDStatus.PENDING) updatePayload.supervisorNote = null;

  const { error } = await supabase
    .from('rds')
    .update(updatePayload)
    .eq('id', id);
  
  if (error) throw error;
};

// --- Employees ---

export const getEmployees = async (): Promise<Employee[]> => {
  if (!isSupabaseConfigured) {
    return getLocal<Employee[]>('ciclus_employees_local', []);
  }

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error("Error fetching employees from Supabase:", error);
    return getLocal<Employee[]>('ciclus_employees_local', []);
  }
  return data || [];
};

export const saveEmployee = async (employee: Employee): Promise<Employee> => {
  if (!isSupabaseConfigured) {
    const emps = getLocal<Employee[]>('ciclus_employees_local', []);
    if (!employee.id) {
      employee.id = `EMP-${Date.now()}`;
      emps.push(employee);
    } else {
      const idx = emps.findIndex(e => e.id === employee.id);
      if (idx > -1) emps[idx] = employee;
      else emps.push(employee);
    }
    saveLocal('ciclus_employees_local', emps);
    return employee;
  }

  if (!employee.id || employee.id === '') {
    const { id, ...dataToInsert } = employee;
    const { data, error } = await supabase
      .from('employees')
      .insert([dataToInsert])
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('employees')
      .update(employee)
      .eq('id', employee.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const deleteEmployee = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    const emps = getLocal<Employee[]>('ciclus_employees_local', []);
    saveLocal('ciclus_employees_local', emps.filter(e => e.id !== id));
    return;
  }

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const getExistingRoles = async (): Promise<string[]> => {
  const defaultRoles = ['Ajudante', 'Gari', 'Pintor', 'Roçador', 'OP. Roçadeira', 'ASG', 'Motorista'];
  const employees = await getEmployees();
  const dbRoles = employees.map(e => e.role);
  return Array.from(new Set([...defaultRoles, ...dbRoles])).sort();
};

// --- Users / Auth ---

export const getUsers = async (): Promise<User[]> => {
  if (!isSupabaseConfigured) {
    // Return a default admin if local is empty
    const local = getLocal<User[]>('ciclus_users_local', []);
    if (local.length === 0) {
      const admin: User = { id: 'admin-id', name: 'Administrador Local', registration: 'admin', password: 'admin', role: UserRole.CCO };
      return [admin];
    }
    return local;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error("Error fetching users from Supabase:", error);
    return getLocal<User[]>('ciclus_users_local', []);
  }
  return data || [];
};

export const saveUser = async (user: User): Promise<User> => {
  if (!isSupabaseConfigured) {
    const users = getLocal<User[]>('ciclus_users_local', []);
    if (!user.id) {
      user.id = `USR-${Date.now()}`;
      users.push(user);
    } else {
      const idx = users.findIndex(u => u.id === user.id);
      if (idx > -1) users[idx] = user;
      else users.push(user);
    }
    saveLocal('ciclus_users_local', users);
    return user;
  }

  if (!user.id || user.id === '') {
    const { id, ...dataToInsert } = user;
    const { data, error } = await supabase
      .from('users')
      .insert([dataToInsert])
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('users')
      .update(user)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const deleteUser = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    const users = getLocal<User[]>('ciclus_users_local', []);
    saveLocal('ciclus_users_local', users.filter(u => u.id !== id));
    return;
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const authenticate = async (registration: string, password: string): Promise<User | null> => {
  if (!isSupabaseConfigured) {
    const users = await getUsers(); // Gets from local or default admin
    const found = users.find(u => u.registration === registration && u.password === password);
    if (found) {
      localStorage.setItem('ciclus_user', JSON.stringify(found));
      return found;
    }
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('registration', registration)
    .eq('password', password)
    .maybeSingle();

  if (error || !data) return null;

  localStorage.setItem('ciclus_user', JSON.stringify(data));
  return data;
};

export const getCachedUser = (): User | null => {
  const stored = localStorage.getItem('ciclus_user');
  return stored ? JSON.parse(stored) : null;
};

export const logout = () => {
  localStorage.removeItem('ciclus_user');
};
