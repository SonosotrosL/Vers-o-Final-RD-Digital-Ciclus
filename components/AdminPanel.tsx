
import React, { useState, useEffect } from 'react';
import { Employee, User, UserRole, TEAMS } from '../types';
import { getEmployees, saveEmployee, deleteEmployee, getExistingRoles, getUsers, saveUser, deleteUser } from '../services/storageService';
import { Plus, Trash2, Save, User as UserIcon, Briefcase, Shield, AlertTriangle, Check, X, Loader2 } from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'users'>('employees');
  const [loading, setLoading] = useState(false);
  
  // Employees State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpReg, setNewEmpReg] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);

  // Users State (CCO Only)
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserReg, setNewUserReg] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.ENCARREGADO);
  const [newUserTeam, setNewUserTeam] = useState<string>('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const emps = await getEmployees();
    setEmployees(emps);
    const roles = await getExistingRoles();
    setAvailableRoles(roles);
    const usrs = await getUsers();
    setUsers(usrs);
    setLoading(false);
  };

  // --- Employee Logic ---

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const newEmp: Employee = {
      id: ``, // Backend generates ID
      name: newEmpName,
      registration: newEmpReg,
      role: newEmpRole,
      supervisorId: currentUser.id 
    };
    await saveEmployee(newEmp);
    await refreshData();
    setIsAddingEmp(false);
    setNewEmpName('');
    setNewEmpReg('');
    setNewEmpRole('');
    setLoading(false);
  };

  const handleConfirmDeleteEmployee = async (id: string) => {
    setLoading(true);
    await deleteEmployee(id);
    await refreshData();
    setDeletingEmpId(null);
    setLoading(false);
  };

  // --- User Logic ---

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const newUser: User = {
      id: ``, // Backend generates ID
      name: newUserName,
      registration: newUserReg,
      password: newUserPass,
      role: newUserRole,
      team: newUserTeam || undefined
    };
    try {
        await saveUser(newUser);
        await refreshData();
        setIsAddingUser(false);
        setNewUserName('');
        setNewUserReg('');
        setNewUserPass('');
        setNewUserTeam('');
    } catch(e) {
        alert("Erro ao salvar usuário.");
    }
    setLoading(false);
  };

  const handleConfirmDeleteUser = async (id: string) => {
    setLoading(true);
    await deleteUser(id);
    await refreshData();
    setDeletingUserId(null);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden relative min-h-[400px]">
      
      {loading && (
          <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-ciclus-600 animate-spin" />
          </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('employees')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'employees' ? 'bg-white text-ciclus-600 border-b-2 border-ciclus-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >
          <Briefcase className="w-4 h-4" /> Banco de Colaboradores
        </button>
        {currentUser.role === UserRole.CCO && (
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-white text-purple-600 border-b-2 border-purple-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
          >
            <Shield className="w-4 h-4" /> Usuários do Sistema
          </button>
        )}
      </div>

      {/* --- EMPLOYEES TAB --- */}
      {activeTab === 'employees' && (
        <div>
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-500">Cadastre os funcionários para preencher a lista de presença automaticamente.</p>
            <button 
              onClick={() => setIsAddingEmp(!isAddingEmp)}
              className="bg-ciclus-600 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 hover:bg-ciclus-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar Colaborador
            </button>
          </div>

          {isAddingEmp && (
            <form onSubmit={handleSaveEmployee} className="p-4 bg-blue-50 border-b border-blue-100 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[10px] font-bold text-blue-800 uppercase">Nome</label>
                <input required className="w-full text-sm p-2 rounded border border-blue-200" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-blue-800 uppercase">Matrícula</label>
                <input required className="w-full text-sm p-2 rounded border border-blue-200" value={newEmpReg} onChange={e => setNewEmpReg(e.target.value)} placeholder="00000" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-blue-800 uppercase">Função/Cargo</label>
                <input 
                  list="roles-list" 
                  required 
                  className="w-full text-sm p-2 rounded border border-blue-200" 
                  value={newEmpRole} 
                  onChange={e => setNewEmpRole(e.target.value)} 
                  placeholder="Selecione ou digite..." 
                />
                <datalist id="roles-list">
                  {availableRoles.map(r => <option key={r} value={r} />)}
                </datalist>
              </div>
              <button type="submit" className="bg-green-600 text-white p-2 rounded text-sm font-bold hover:bg-green-700 flex justify-center items-center gap-1">
                <Save className="w-4 h-4" /> Salvar
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhum colaborador encontrado.</td></tr>
                ) : (
                    employees.map(emp => (
                        <tr key={emp.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                            <td className="px-4 py-3 font-mono text-xs">{emp.registration}</td>
                            <td className="px-4 py-3">
                              <span className="bg-gray-100 px-2 py-1 rounded text-xs">{emp.role}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                {deletingEmpId === emp.id ? (
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setDeletingEmpId(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                                        <button onClick={() => handleConfirmDeleteEmployee(emp.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700">Confirmar</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setDeletingEmpId(emp.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- USERS TAB (CCO ONLY) --- */}
      {activeTab === 'users' && currentUser.role === UserRole.CCO && (
        <div>
          <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
            <p className="text-xs text-purple-800">Gerencie quem tem acesso ao aplicativo (Login) e vincule Supervisores às suas Equipes.</p>
            <button 
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar Usuário
            </button>
          </div>

          {isAddingUser && (
            <form onSubmit={handleSaveUser} className="p-4 bg-white border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Nome</label>
                <input required className="w-full text-sm p-2 rounded border border-gray-300" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Login</label>
                <input required className="w-full text-sm p-2 rounded border border-gray-300" value={newUserReg} onChange={e => setNewUserReg(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Senha</label>
                <input required className="w-full text-sm p-2 rounded border border-gray-300" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Nível</label>
                <select className="w-full text-sm p-2 rounded border border-gray-300" value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}>
                  <option value={UserRole.ENCARREGADO}>Encarregado</option>
                  <option value={UserRole.SUPERVISOR}>Supervisor</option>
                  <option value={UserRole.CCO}>CCO (Admin)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Equipe (Opcional)</label>
                <select className="w-full text-sm p-2 rounded border border-gray-300" value={newUserTeam} onChange={e => setNewUserTeam(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {TEAMS.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="bg-green-600 text-white p-2 rounded text-sm font-bold hover:bg-green-700 flex justify-center items-center gap-1">
                <Save className="w-4 h-4" /> Salvar
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3">Nível</th>
                  <th className="px-4 py-3">Equipe</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{u.registration}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            u.role === UserRole.CCO ? 'bg-purple-100 text-purple-800' :
                            u.role === UserRole.SUPERVISOR ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                            {u.team ? <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">{u.team}</span> : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                            {u.registration !== 'admin' && (
                              <>
                                {deletingUserId === u.id ? (
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setDeletingUserId(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                                        <button onClick={() => handleConfirmDeleteUser(u.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700">Confirmar</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setDeletingUserId(u.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                              </>
                            )}
                        </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
