
import React, { useEffect, useState, useMemo } from 'react';
import { RDData, Shift, TEAMS, User, UserRole } from '../types';
import { getUsers } from '../services/storageService';
import { generateStrategicAnalysis } from '../services/geminiService';
import { BarChart3, TrendingUp, Users, Filter, Calendar, Sparkles, Target, Award, Search, Paintbrush, Shovel, Ruler, Brush, AlertCircle, UserCheck } from 'lucide-react';

interface AnalyticsDashboardProps {
  rds: RDData[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ rds }) => {
  // --- Filters / Slicers State ---
  const [dateMode, setDateMode] = useState<'month' | 'day'>('month');
  const [selectedDateValue, setSelectedDateValue] = useState(new Date().toISOString().slice(0, 7)); // Stores YYYY-MM or YYYY-MM-DD
  
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('ALL');
  const [selectedForeman, setSelectedForeman] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // --- AI State ---
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Load users to get team links and names
  useEffect(() => {
    const loadUsers = async () => {
        const users = await getUsers();
        setAllUsers(users);
    };
    loadUsers();
  }, [rds]); // Reload when RDs change

  // --- Derived Data Lists (Dropdowns) ---
  
  // 1. Supervisors List
  const supervisorsList = useMemo(() => {
    const systemSups = allUsers.filter(u => u.role === UserRole.SUPERVISOR);
    const rdSupIds = new Set(rds.map(r => r.supervisorId).filter(Boolean));
    const supMap = new Map<string, string>();
    
    systemSups.forEach(u => supMap.set(u.id, u.name));
    rdSupIds.forEach(id => {
        if (!supMap.has(id as string)) {
             const found = allUsers.find(u => u.id === id);
             supMap.set(id as string, found ? found.name : `Supervisor (ID: ${id?.toString().slice(0,4)})`);
        }
    });
    return Array.from(supMap.entries()).map(([id, name]) => ({ id, name }));
  }, [rds, allUsers]);

  // 2. Foremen List (Encarregados) - STRICTLY FILTERED
  const foremenList = useMemo(() => {
    const map = new Map<string, string>();
    rds.forEach(rd => {
        const idKey = rd.foremanId;
        const nameKey = rd.foremanName;
        const userInDb = allUsers.find(u => u.id === idKey);

        if (userInDb) {
            if (userInDb.role === UserRole.ENCARREGADO) {
                if (!map.has(idKey)) map.set(idKey, nameKey);
            }
        } else {
            const isKnownSupervisor = supervisorsList.some(s => s.id === idKey);
            const isCCO = allUsers.some(u => u.id === idKey && u.role === UserRole.CCO);
            if (!isKnownSupervisor && !isCCO) {
                if (!map.has(idKey)) map.set(idKey, nameKey);
            }
        }
    });
    allUsers.forEach(u => {
        if (u.role === UserRole.ENCARREGADO) {
            if (!map.has(u.id)) map.set(u.id, u.name);
        }
    });
    return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [rds, allUsers, supervisorsList]);

  // --- Filtering Logic ---
  const filteredData = useMemo(() => {
    return rds.filter(rd => {
      const rdDate = rd.date.split('T')[0]; // YYYY-MM-DD
      if (dateMode === 'month') {
        if (!rdDate.startsWith(selectedDateValue)) return false;
      } else {
        if (rdDate !== selectedDateValue) return false;
      }
      if (selectedSupervisor !== 'ALL' && rd.supervisorId !== selectedSupervisor) return false;
      if (selectedShift !== 'ALL' && rd.shift !== selectedShift) return false;
      if (selectedForeman !== 'ALL') {
         if (rd.foremanId !== selectedForeman) return false;
      }
      return true;
    });
  }, [rds, dateMode, selectedDateValue, selectedSupervisor, selectedShift, selectedForeman]);

  // --- Aggregation Logic ---

  // Calculate distinct active days in the filtered set for averaging
  const distinctDaysCount = new Set(filteredData.map(rd => rd.date.split('T')[0])).size;
  const avgDivisor = distinctDaysCount === 0 ? 1 : distinctDaysCount;

  // Specific Totals
  const totalCapina = filteredData.reduce((acc, rd) => acc + (rd.metrics.capinaM || 0), 0);
  const totalVarricao = filteredData.reduce((acc, rd) => acc + (rd.metrics.varricaoM || 0), 0);
  const totalPinturaVias = filteredData.reduce((acc, rd) => acc + (rd.metrics.pinturaViasM || 0), 0);
  const totalPinturaPostes = filteredData.reduce((acc, rd) => acc + (rd.metrics.pinturaPostesUnd || 0), 0);
  const totalRocagem = filteredData.reduce((acc, rd) => acc + (rd.metrics.rocagemM2 || 0), 0);

  // Total Linear (Used for Simulator and Charts)
  const totalLinearMeters = totalCapina + totalVarricao + totalPinturaVias;

  // Averages
  const avgCapina = Math.round(totalCapina / avgDivisor);
  const avgVarricao = Math.round(totalVarricao / avgDivisor);
  const avgPintura = Math.round(totalPinturaVias / avgDivisor);
  const avgPostes = Math.round(totalPinturaPostes / avgDivisor);
  const avgRocagem = Math.round(totalRocagem / avgDivisor);


  // 2. Daily Timeline & Goal Analysis
  const dailyStats = useMemo(() => {
    const contextMonth = dateMode === 'month' ? selectedDateValue : selectedDateValue.substring(0, 7);
    const [year, month] = contextMonth.split('-').map(Number);
    
    // Structure now includes Rocagem separatly
    const stats: Record<string, { linear: number, teamsLinear: number, rocagem: number, teamsRocagem: number }> = {};
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        stats[dayKey] = { linear: 0, teamsLinear: 0, rocagem: 0, teamsRocagem: 0 };
    }

    filteredData.forEach(rd => {
      const dayKey = rd.date.split('T')[0];
      if (stats[dayKey]) {
        // Linear logic
        const linearSum = (rd.metrics.capinaM || 0) + (rd.metrics.varricaoM || 0) + (rd.metrics.pinturaViasM || 0);
        if (linearSum > 0) {
            stats[dayKey].linear += linearSum;
            stats[dayKey].teamsLinear += 1;
        }

        // Rocagem logic
        const rocagemVal = (rd.metrics.rocagemM2 || 0);
        if (rocagemVal > 0) {
            stats[dayKey].rocagem += rocagemVal;
            stats[dayKey].teamsRocagem += 1;
        }
      }
    });

    return Object.entries(stats).map(([date, data]) => ({
      date,
      day: date.split('-')[2],
      totalLinear: data.linear,
      activeTeamsLinear: data.teamsLinear,
      avgLinearPerTeam: data.teamsLinear > 0 ? data.linear / data.teamsLinear : 0,
      totalRocagem: data.rocagem,
      activeTeamsRocagem: data.teamsRocagem,
      avgRocagemPerTeam: data.teamsRocagem > 0 ? data.rocagem / data.teamsRocagem : 0
    }));
  }, [filteredData, selectedDateValue, dateMode]);

  // 3. Supervisor Ranking
  const supervisorRanking = useMemo(() => {
    const rank: Record<string, { total: number, count: number }> = {};
    
    filteredData.forEach(rd => {
        const key = rd.supervisorId || 'unknown'; 
        if (!rank[key]) rank[key] = { total: 0, count: 0 };
        // Combine everything just for general ranking activity, or focus on linear
        rank[key].total += (rd.metrics.capinaM || 0) + (rd.metrics.varricaoM || 0) + (rd.metrics.pinturaViasM || 0);
        rank[key].count += 1;
    });
    
    return Object.entries(rank)
        .map(([id, val]) => {
            const user = allUsers.find(u => u.id === id);
            return { 
                id, 
                name: user ? user.name : (id === 'unknown' ? 'Não Identificado' : `ID: ${id.substring(0,4)}`),
                team: user?.team,
                total: val.total, 
                count: val.count 
            };
        })
        .sort((a, b) => b.total - a.total);
  }, [filteredData, allUsers]);

  // 4. Linked Team Performance Logic (Linear)
  const teamPerformance = useMemo(() => {
      if (selectedSupervisor === 'ALL') return null;

      const user = allUsers.find(u => u.id === selectedSupervisor);
      if (!user || !user.team) return { hasTeam: false, name: user?.name };

      const teamConfig = TEAMS.find(t => t.name === user.team);
      if (!teamConfig) return { hasTeam: false, name: user.name };

      const daysWorked = distinctDaysCount; 
      const expectedSoFar = daysWorked * 1950; 
      const actual = totalLinearMeters;
      const balance = actual - expectedSoFar;
      const isPositive = balance >= 0;
      const fullCycleTotal = teamConfig.days * 1950;
      const cycleProgress = fullCycleTotal > 0 ? (actual / fullCycleTotal) * 100 : 0;

      return {
          hasTeam: true,
          teamName: teamConfig.name,
          teamDays: teamConfig.days,
          supervisorName: user.name,
          daysWorked,
          expectedSoFar,
          actual,
          balance,
          isPositive,
          fullCycleTotal,
          cycleProgress
      };
  }, [selectedSupervisor, allUsers, distinctDaysCount, totalLinearMeters]);


  // --- AI Trigger (Debounced) ---
  useEffect(() => {
    if (filteredData.length > 0) {
      
      const timer = setTimeout(() => {
        setIsLoadingAI(true);
        
        const metaDaysLinear = dailyStats.filter(d => d.avgLinearPerTeam >= 1950).length;
        const metaDaysRocagem = dailyStats.filter(d => d.avgRocagemPerTeam >= 1000).length;

        const metaAnalysis = {
            daysAnalyzed: dailyStats.filter(d => d.activeTeamsLinear > 0 || d.activeTeamsRocagem > 0).length,
            daysAboveMetaLinear: metaDaysLinear,
            daysAboveMetaRocagem: metaDaysRocagem,
            globalAvgLinear: Math.round(totalLinearMeters / filteredData.length || 0),
            globalAvgRocagem: Math.round(totalRocagem / filteredData.length || 0)
        };

        const kpis = { totalCapina, totalVarricao, totalPinturaVias, totalRocagem };

        generateStrategicAnalysis(kpis, supervisorRanking.slice(0,3), metaAnalysis)
            .then(res => {
                setAnalysis(res);
                setIsLoadingAI(false);
            });
      }, 2000); // 2 seconds debounce

      return () => clearTimeout(timer);
    } else {
        setAnalysis(null);
    }
  }, [filteredData, dailyStats, totalLinearMeters, totalRocagem, supervisorRanking]);

  // --- Constants ---
  const META_DAILY_LINEAR = 1950; // 1.95 km
  const META_DAILY_ROCAGEM = 1000; // 1000 m2

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-ciclus-600" /> Business Intelligence
            </h2>
            <p className="text-xs text-gray-500">Análise Estratégica de Produção e Metas</p>
        </div>
        {filteredData.length > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${isLoadingAI ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                <Sparkles className={`w-3 h-3 ${isLoadingAI ? 'animate-pulse' : ''}`} />
                {isLoadingAI ? "AI Analisando..." : "Análise Inteligente"}
            </div>
        )}
      </div>

      {/* --- SLICERS (FILTERS) --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Date Slicer (Month/Day Toggle) */}
          <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
             <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Período
                </label>
                <div className="flex bg-white rounded border border-gray-200 overflow-hidden">
                    <button 
                        onClick={() => { setDateMode('month'); setSelectedDateValue(new Date().toISOString().slice(0, 7)); }}
                        className={`px-2 py-0.5 text-[10px] font-bold ${dateMode === 'month' ? 'bg-ciclus-100 text-ciclus-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Mês
                    </button>
                    <div className="w-px bg-gray-200"></div>
                    <button 
                         onClick={() => { setDateMode('day'); setSelectedDateValue(new Date().toISOString().slice(0, 10)); }}
                         className={`px-2 py-0.5 text-[10px] font-bold ${dateMode === 'day' ? 'bg-ciclus-100 text-ciclus-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Dia
                    </button>
                </div>
             </div>
             
             {dateMode === 'month' ? (
                 <input 
                    type="month" 
                    value={selectedDateValue}
                    onChange={e => setSelectedDateValue(e.target.value)}
                    className="w-full text-sm p-1.5 border border-gray-200 rounded bg-white focus:ring-2 focus:ring-ciclus-500 outline-none font-bold text-gray-700"
                />
             ) : (
                 <input 
                    type="date" 
                    value={selectedDateValue}
                    onChange={e => setSelectedDateValue(e.target.value)}
                    className="w-full text-sm p-1.5 border border-gray-200 rounded bg-white focus:ring-2 focus:ring-ciclus-500 outline-none font-bold text-gray-700"
                />
             )}
          </div>

          {/* Supervisor Slicer */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Supervisor
            </label>
            <select 
                value={selectedSupervisor}
                onChange={e => setSelectedSupervisor(e.target.value)}
                className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-ciclus-500 outline-none text-gray-700"
            >
                <option value="ALL">Todos os Supervisores</option>
                {supervisorsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          </div>

          {/* Foreman Slicer (Dropdown) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Encarregado
            </label>
            <select 
                value={selectedForeman}
                onChange={e => setSelectedForeman(e.target.value)}
                className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-ciclus-500 outline-none text-gray-700"
            >
                <option value="ALL">Todos os Encarregados</option>
                {foremenList.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>
          </div>

          {/* Shift Slicer */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Turno
            </label>
            <select 
                value={selectedShift}
                onChange={e => setSelectedShift(e.target.value)}
                className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-ciclus-500 outline-none text-gray-700"
            >
                <option value="ALL">Todos os Turnos</option>
                <option value={Shift.DIURNO}>{Shift.DIURNO}</option>
                <option value={Shift.NOTURNO}>{Shift.NOTURNO}</option>
            </select>
          </div>
      </div>

      {/* --- EMPTY STATE --- */}
      {filteredData.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
             <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Filter className="w-8 h-8 text-gray-400" />
             </div>
             <h3 className="text-lg font-bold text-gray-700">Sem dados para este período</h3>
             <p className="text-gray-500 text-sm max-w-md mx-auto mt-2">
                 Não foram encontrados Relatórios Diários (RD) para os filtros selecionados. 
                 Tente mudar a data ou o supervisor.
             </p>
          </div>
      ) : (
      <>
        {/* --- DETAILED SERVICE KPIS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            
            {/* Capinação */}
            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm hover:shadow-md transition-shadow ring-2 ring-green-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-600 text-white text-[9px] px-2 py-0.5 rounded-bl">Meta: 1.950m</div>
                <div className="flex items-center gap-2 mb-2 text-green-700">
                    <Shovel className="w-4 h-4" />
                    <p className="text-[10px] uppercase font-bold">Capinação</p>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{totalCapina.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m</span></h3>
                <p className="text-[10px] text-gray-400 mt-1">Média: {avgCapina.toLocaleString('pt-BR')}m / dia</p>
            </div>

            {/* Varrição */}
            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2 text-orange-700">
                    <Brush className="w-4 h-4" />
                    <p className="text-[10px] uppercase font-bold">Varrição</p>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{totalVarricao.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m</span></h3>
                <p className="text-[10px] text-gray-400 mt-1">Média: {avgVarricao.toLocaleString('pt-BR')}m / dia</p>
            </div>

            {/* Pintura Vias */}
            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2 text-blue-700">
                    <Paintbrush className="w-4 h-4" />
                    <p className="text-[10px] uppercase font-bold">Pintura Vias</p>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{totalPinturaVias.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m</span></h3>
                <p className="text-[10px] text-gray-400 mt-1">Média: {avgPintura.toLocaleString('pt-BR')}m / dia</p>
            </div>

            {/* Pintura Postes */}
            <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2 text-purple-700">
                    <Ruler className="w-4 h-4" />
                    <p className="text-[10px] uppercase font-bold">Postes</p>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{totalPinturaPostes.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">und</span></h3>
                <p className="text-[10px] text-gray-400 mt-1">Média: {avgPostes.toLocaleString('pt-BR')} / dia</p>
            </div>

            {/* Roçagem - Highlighted for new goal */}
            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow ring-2 ring-emerald-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-bl">Meta: 1.000m²</div>
                <div className="flex items-center gap-2 mb-2 text-emerald-700">
                    <TrendingUp className="w-4 h-4" />
                    <p className="text-[10px] uppercase font-bold">Roçagem</p>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">{totalRocagem.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m²</span></h3>
                <p className="text-[10px] text-gray-400 mt-1">Média: {avgRocagem.toLocaleString('pt-BR')}m² / dia</p>
            </div>

        </div>

        {/* --- PERFORMANCE DA EQUIPE VINCULADA --- */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4">
                <Target className="w-5 h-5" /> Performance da Equipe e Supervisor (Linear)
            </h3>
            
            {teamPerformance ? (
                teamPerformance.hasTeam ? (
                    <div className="bg-white rounded-lg p-6 border border-blue-100 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Summary */}
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                    <span className="text-sm text-gray-500">Supervisor / Equipe</span>
                                    <span className="font-bold text-gray-800">{teamPerformance.supervisorName} <span className="text-blue-600 bg-blue-100 px-2 rounded ml-1">{teamPerformance.teamName}</span></span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Dias Trabalhados (Com RD)</span>
                                    <span className="font-bold">{teamPerformance.daysWorked}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 flex items-center gap-1" title="1.95km (1950m) é a soma total dos dois lados da via (975m cada lado)">Meta Acumulada <AlertCircle className="w-3 h-3 text-gray-400" /></span>
                                    <div className="text-right">
                                        <span className="font-bold text-gray-700">{teamPerformance.expectedSoFar.toLocaleString()} m</span>
                                        <p className="text-[9px] text-gray-400">({teamPerformance.daysWorked}d x 1.950m)</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Realizado (Linear Total)</span>
                                    <span className="font-bold text-blue-600 text-lg">{teamPerformance.actual.toLocaleString()} m</span>
                                </div>
                            </div>

                            {/* Gauge / Balance */}
                            <div className="flex-1 border-l border-gray-100 pl-0 md:pl-6 flex flex-col justify-center">
                                {teamPerformance.daysWorked === 0 ? (
                                    <div className="text-center text-gray-400 text-sm">
                                        Nenhum dia trabalhado neste período.
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs font-bold text-gray-400 uppercase text-center mb-2">Balanço de Produção</p>
                                        <div className={`text-center py-4 rounded-lg border-2 ${teamPerformance.isPositive ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                                            <p className={`text-3xl font-bold ${teamPerformance.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                {teamPerformance.isPositive ? '+' : ''}{teamPerformance.balance.toLocaleString()} m
                                            </p>
                                            <p className={`text-xs font-medium mt-1 ${teamPerformance.isPositive ? 'text-green-700' : 'text-red-700'}`}>
                                                {teamPerformance.isPositive ? 'Dentro/Acima da Meta' : 'Abaixo da Meta Esperada'}
                                            </p>
                                        </div>
                                        <div className="mt-4">
                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                <span>Ciclo Completo ({teamPerformance.teamDays} dias)</span>
                                                <span>{teamPerformance.cycleProgress.toFixed(1)}% Concluído</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(teamPerformance.cycleProgress, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p>O Supervisor <strong>{teamPerformance.name}</strong> não possui Equipe vinculada.</p>
                        <p className="text-xs mt-1">Vá em "Gestão &gt; Usuários" para vincular uma equipe (Ex: S10, S01).</p>
                    </div>
                )
            ) : (
                <div className="text-center py-8 text-blue-800 bg-blue-50/50 rounded-lg border border-blue-200">
                    <Search className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                    <p className="font-medium">Selecione um Supervisor no filtro acima</p>
                    <p className="text-xs mt-1">Para visualizar a performance detalhada contra a meta da equipe.</p>
                </div>
            )}
        </div>

        {/* --- CHARTS SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Chart: Meta 1.95km Progress */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 1. Linear Chart */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Target className="w-5 h-5 text-red-500" /> Meta Linear Diária (1.95 km)
                        </h3>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-ciclus-500 rounded-sm"></div> Realizado</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-sm"></div> Meta</span>
                        </div>
                    </div>

                    <div className="h-48 flex items-end justify-between gap-1 pt-4 relative border-b border-gray-100">
                        {/* Reference Line 1.95k */}
                        <div className="absolute top-[15%] left-0 right-0 border-t border-dashed border-red-300 z-0 flex items-end justify-end pointer-events-none">
                            <span className="text-[10px] text-red-500 bg-white px-1 -mt-5">1.950m</span>
                        </div>

                        {dailyStats.map((dayStat, idx) => {
                            const hasData = dayStat.activeTeamsLinear > 0;
                            const maxHeight = 3000; // Cap
                            const heightPercent = hasData ? Math.min((dayStat.avgLinearPerTeam / maxHeight) * 100, 100) : 0;
                            const isAboveMeta = dayStat.avgLinearPerTeam >= META_DAILY_LINEAR;

                            return (
                                <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative h-full z-10">
                                    {hasData ? (
                                        <>
                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] p-2 rounded pointer-events-none whitespace-nowrap z-20">
                                                <p className="font-bold">Dia {dayStat.day} (Linear)</p>
                                                <p>Média: {dayStat.avgLinearPerTeam.toFixed(0)}m</p>
                                                <p>Equipes: {dayStat.activeTeamsLinear}</p>
                                            </div>
                                            <div 
                                                className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${isAboveMeta ? 'bg-ciclus-500 hover:bg-ciclus-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                                                style={{ height: `${heightPercent}%` }}
                                            ></div>
                                        </>
                                    ) : (
                                        <div className="w-px h-2 bg-gray-100"></div>
                                    )}
                                    <span className="text-[8px] text-gray-300 mt-1">{dayStat.day}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Rocagem Chart (New) */}
                <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div className="flex justify-between items-center mb-6 pl-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" /> Meta Roçagem Diária (1.000 m²)
                        </h3>
                        <div className="flex items-center gap-2 text-xs">
                             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Realizado</span>
                             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-300 rounded-sm"></div> Meta</span>
                        </div>
                    </div>

                    <div className="h-32 flex items-end justify-between gap-1 pt-4 relative border-b border-gray-100">
                        {/* Reference Line 1000m2 */}
                        <div className="absolute top-[20%] left-0 right-0 border-t border-dashed border-gray-300 z-0 flex items-end justify-end pointer-events-none">
                            <span className="text-[10px] text-gray-400 bg-white px-1 -mt-5">1.000m²</span>
                        </div>

                        {dailyStats.map((dayStat, idx) => {
                            const hasData = dayStat.activeTeamsRocagem > 0;
                            const maxHeight = 2000; // Cap
                            const heightPercent = hasData ? Math.min((dayStat.avgRocagemPerTeam / maxHeight) * 100, 100) : 0;
                            const isAboveMeta = dayStat.avgRocagemPerTeam >= META_DAILY_ROCAGEM;

                            return (
                                <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative h-full z-10">
                                    {hasData ? (
                                        <>
                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] p-2 rounded pointer-events-none whitespace-nowrap z-20">
                                                <p className="font-bold">Dia {dayStat.day} (Roçagem)</p>
                                                <p>Média: {dayStat.avgRocagemPerTeam.toFixed(0)}m²</p>
                                                <p>Equipes: {dayStat.activeTeamsRocagem}</p>
                                            </div>
                                            <div 
                                                className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${isAboveMeta ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-200 hover:bg-emerald-300'}`}
                                                style={{ height: `${heightPercent}%` }}
                                            ></div>
                                        </>
                                    ) : (
                                        <div className="w-px h-2 bg-gray-100"></div>
                                    )}
                                    <span className="text-[8px] text-gray-300 mt-1">{dayStat.day}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* Right Column: AI & Rankings */}
            <div className="flex flex-col gap-6">
                
                {/* AI Insight Box */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-bold text-indigo-900 text-sm">IA Insights</h4>
                    </div>
                    {analysis ? (
                        <div className="prose prose-xs text-gray-700 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {analysis.split('\n').map((line, i) => (
                                <p key={i} className={`mb-1 ${line.startsWith('**') ? 'font-bold text-gray-900' : ''}`}>{line.replace(/\*\*/g, '')}</p>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">{isLoadingAI ? 'Carregando análise...' : 'A análise será atualizada automaticamente.'}</p>
                    )}
                </div>

                {/* Supervisor Leaderboard */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex-1">
                    <h4 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                        <Award className="w-4 h-4 text-yellow-500" /> Ranking (Período)
                    </h4>
                    <div className="space-y-3">
                        {supervisorRanking.length === 0 ? (
                            <p className="text-xs text-gray-400">Sem dados.</p>
                        ) : (
                            supervisorRanking.slice(0, 5).map((sup, idx) => (
                                <div key={sup.id} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                            idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                            idx === 1 ? 'bg-gray-100 text-gray-600' : 
                                            idx === 2 ? 'bg-orange-50 text-orange-700' : 'text-gray-400'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <p className="text-xs font-bold text-gray-700 truncate max-w-[100px]">{sup.name}</p>
                                            <p className="text-[10px] text-gray-400">
                                                {sup.team ? `Equipe ${sup.team}` : `${sup.count} RDs`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-ciclus-600">{sup.total.toLocaleString('pt-BR')}m</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>

        </div>

        {/* Bottom Chart: Total Production Timeline */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Produção Linear Total por Dia (Soma de Todas as Equipes)</h3>
            <div className="h-40 flex items-end gap-1 border-b border-gray-100">
                {dailyStats.map((d, i) => {
                    const max = Math.max(...dailyStats.map(x => x.totalLinear)) || 1;
                    const h = d.totalLinear > 0 ? (d.totalLinear / max) * 100 : 0;
                    return (
                        <div key={i} className="flex-1 flex flex-col justify-end group h-full">
                            {d.totalLinear > 0 && (
                                <div 
                                    className="bg-gray-800 rounded-t-sm hover:bg-gray-600 transition-colors relative"
                                    style={{ height: `${h}%` }}
                                >
                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[10px] p-1 rounded whitespace-nowrap z-10">
                                        {d.totalLinear.toLocaleString()}m
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Dia 01</span>
                <span>Dia {dailyStats.length}</span>
            </div>
        </div>
      </>
      )}
    </div>
  );
};
