
import React, { useState, useEffect } from 'react';
import { User, UserRole, RDData, RDStatus } from './types';
import { Dashboard } from './components/Dashboard';
import { RDForm } from './components/RDForm';
import { AdminPanel } from './components/AdminPanel';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Login } from './components/Login';
import * as StorageService from './services/storageService';
import { isSupabaseConfigured } from './services/supabaseClient';
import { Menu, LogOut, Plus, Database, LayoutDashboard, BarChart3, Loader2, CloudOff, Cloud } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'new' | 'admin' | 'analytics'>('dashboard');
  const [rds, setRds] = useState<RDData[]>([]);
  const [editingRD, setEditingRD] = useState<RDData | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = StorageService.getCachedUser();
    if (cached) {
      setCurrentUser(cached);
      refreshRDs();
    }
  }, []);

  const refreshRDs = async () => {
    setLoading(true);
    const data = await StorageService.getRDs();
    setRds(data);
    setLoading(false);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setView('dashboard');
    refreshRDs();
  };

  const handleLogout = () => {
    StorageService.logout();
    setCurrentUser(null);
    setEditingRD(undefined);
  };

  const handleSaveRD = async (data: RDData) => {
    setLoading(true);
    await StorageService.saveRD(data);
    await refreshRDs();
    setEditingRD(undefined);
    setView('dashboard');
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: RDStatus, note?: string) => {
    await StorageService.updateRDStatus(id, status, note);
    refreshRDs();
  };

  const handleDeleteRD = async (id: string) => {
    if(confirm("Tem certeza que deseja excluir?")) {
        setLoading(true);
        await StorageService.deleteRD(id);
        await refreshRDs();
        setLoading(false);
    }
  };

  const handleEditRD = (rd: RDData) => {
    setEditingRD(rd);
    setView('new');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-ciclus-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">C</div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-none">Ciclus</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Digital RD</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-700">{currentUser.name}</p>
              <p className="text-xs text-gray-400 uppercase">{currentUser.role}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors text-gray-400"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 pb-20">
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
           <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${view === 'dashboard' ? 'bg-gray-800 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><LayoutDashboard className="w-4 h-4" /> Visão Geral</button>
           {currentUser.role === UserRole.CCO && (
             <button onClick={() => setView('analytics')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${view === 'analytics' ? 'bg-gray-800 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><BarChart3 className="w-4 h-4" /> Indicadores</button>
           )}
           {(currentUser.role === UserRole.CCO || currentUser.role === UserRole.SUPERVISOR) && (
             <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${view === 'admin' ? 'bg-gray-800 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Database className="w-4 h-4" /> Gestão</button>
           )}
        </div>

        {loading && view === 'dashboard' ? (
             <div className="flex justify-center items-center py-20"><Loader2 className="w-10 h-10 text-ciclus-600 animate-spin" /></div>
        ) : (
            <>
                {view === 'dashboard' && (
                <>
                    <div className="flex justify-between items-end mb-6">
                    <div><h2 className="text-2xl font-bold text-gray-800">Relatórios</h2><p className="text-gray-500 text-sm">Acompanhamento diário de produção.</p></div>
                    {(currentUser.role === UserRole.ENCARREGADO || currentUser.role === UserRole.SUPERVISOR) && (
                        <button onClick={() => { setEditingRD(undefined); setView('new'); }} className="bg-ciclus-600 hover:bg-ciclus-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 font-medium transition-all hover:scale-105 active:scale-95"><Plus className="w-5 h-5" /><span className="hidden sm:inline">Novo RD</span><span className="sm:hidden">Criar</span></button>
                    )}
                    </div>
                    <Dashboard rds={rds} currentUser={currentUser} onUpdateStatus={handleUpdateStatus} onEditRD={handleEditRD} onDeleteRD={handleDeleteRD} />
                </>
                )}
                {view === 'analytics' && currentUser.role === UserRole.CCO && <AnalyticsDashboard rds={rds} />}
                {view === 'new' && <RDForm currentUser={currentUser} onSave={handleSaveRD} onCancel={() => { setEditingRD(undefined); setView('dashboard'); }} existingData={editingRD} />}
                {view === 'admin' && <AdminPanel currentUser={currentUser} />}
            </>
        )}
      </main>

      {/* Database Status Indicator */}
      <div className="fixed bottom-4 right-4 z-50">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg border ${isSupabaseConfigured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              {isSupabaseConfigured ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
              {isSupabaseConfigured ? 'NUVEM ATIVA' : 'MODO LOCAL'}
          </div>
      </div>
    </div>
  );
};

export default App;
