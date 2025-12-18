
import React, { useState, useMemo } from 'react';
import { RDData, RDStatus, UserRole, User } from '../types';
import { generateDailyReportSummary } from '../services/geminiService';
import { FileSpreadsheet, Sparkles, MapPin, XCircle, CheckCircle2, Filter, AlertTriangle, Eye, Calendar, FileText, Clock, Map, Calculator, Search, Trash2, Image as ImageIcon, MapPinned, User as UserIcon, Pencil, Route } from 'lucide-react';

interface DashboardProps {
  rds: RDData[];
  currentUser: User;
  onUpdateStatus: (id: string, status: RDStatus, note?: string) => void;
  onEditRD: (rd: RDData) => void;
  onDeleteRD: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ rds, currentUser, onUpdateStatus, onEditRD, onDeleteRD }) => {
  // --- Filters State ---
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilterType, setDateFilterType] = useState<'month' | 'day'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
  
  // --- UI State ---
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // --- Action State ---
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Filtering Logic ---
  const filteredRDs = useMemo(() => {
    return rds.filter(rd => {
      // 1. Permission / Visibility Filter
      if (currentUser.role !== UserRole.CCO) {
        const isMyCreation = rd.foremanId === currentUser.id;
        const isAssignedToMe = rd.supervisorId === currentUser.id;

        if (currentUser.role === UserRole.SUPERVISOR) {
            // Supervisor sees: Their own RDs OR RDs assigned to them by Foremen
            if (!isMyCreation && !isAssignedToMe) return false;
        } else if (currentUser.role === UserRole.ENCARREGADO) {
            // Encarregado sees: Only their own RDs
            if (!isMyCreation) return false;
        }
      }

      // 2. Status Filter
      if (filterStatus !== 'ALL' && rd.status !== filterStatus) return false;

      // 3. Date Filter
      const rdDate = rd.date.split('T')[0];
      if (dateFilterType === 'month') {
        if (!rdDate.startsWith(selectedMonth)) return false;
      } else if (dateFilterType === 'day') {
        if (selectedDate && rdDate !== selectedDate) return false;
      }

      // 4. Search Filter
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        const matches = 
          rd.foremanName.toLowerCase().includes(lowerTerm) ||
          (rd.foremanRegistration || '').includes(lowerTerm) ||
          (rd.street || '').toLowerCase().includes(lowerTerm) ||
          (rd.neighborhood || '').toLowerCase().includes(lowerTerm);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rds, filterStatus, dateFilterType, selectedMonth, selectedDate, searchTerm, currentUser]);

  // --- Totals Calculation ---
  const periodTotals = useMemo(() => {
    return filteredRDs.reduce((acc, rd) => ({
      capina: acc.capina + (rd.metrics.capinaM || 0),
      varricao: acc.varricao + (rd.metrics.varricaoM || 0),
      rocagem: acc.rocagem + (rd.metrics.rocagemM2 || 0),
      pintura: acc.pintura + (rd.metrics.pinturaViasM || 0),
      postes: acc.postes + (rd.metrics.pinturaPostesUnd || 0),
      rdsCount: acc.rdsCount + 1
    }), { capina: 0, varricao: 0, rocagem: 0, pintura: 0, postes: 0, rdsCount: 0 });
  }, [filteredRDs]);

  // --- Handlers ---
  const handleRejectClick = (e: React.MouseEvent, rdId: string) => {
    e.stopPropagation();
    setRejectingId(rdId);
    setApprovingId(null);
    setDeletingId(null);
    setRejectionReason('');
  };

  const handleApproveClick = (e: React.MouseEvent, rdId: string) => {
    e.stopPropagation();
    setApprovingId(rdId);
    setRejectingId(null);
    setDeletingId(null);
  };
  
  const handleDeleteClick = (e: React.MouseEvent, rdId: string) => {
      e.stopPropagation();
      setDeletingId(rdId);
      setApprovingId(null);
      setRejectingId(null);
  };

  const handleEditConfirm = (e: React.MouseEvent, rd: RDData) => {
    e.stopPropagation();
    if (confirm("Deseja editar este registro?")) {
        onEditRD(rd);
    }
  };

  const handleSubmitRejection = (rdId: string) => {
    if (!rejectionReason.trim()) {
      alert("Por favor, informe o motivo da recusa.");
      return;
    }
    onUpdateStatus(rdId, RDStatus.REJECTED, rejectionReason);
    setRejectingId(null);
    setRejectionReason('');
  };

  const handleConfirmApproval = (rdId: string) => {
    onUpdateStatus(rdId, RDStatus.APPROVED);
    setApprovingId(null);
  };

  const handleConfirmDelete = (rdId: string) => {
      onDeleteRD(rdId);
      setDeletingId(null);
  };

  const handleCancelAction = () => {
    setRejectingId(null);
    setApprovingId(null);
    setDeletingId(null);
    setRejectionReason('');
  };

  const formatSecondsToTime = (seconds?: number) => {
      if (!seconds) return "";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const handleExportCSV = () => {
    if (filteredRDs.length === 0) {
      alert("Nenhum dado para exportar com os filtros atuais.");
      return;
    }

    const headers = [
      "ID", "Data", "Hora", "Encarregado", "Mat. Encarregado", "Base", "Turno", "Status", "Categoria", 
      "Rua", "Bairro", "Perímetro / Referência",
      "Início Serviço", "Fim Serviço", "Tempo Decorrido", "Distância GPS (m)",
      "Capina(m)", "Varrição(m)", "Pintura(m)", "Roçagem(m2)", "Postes(und)", 
      "Homens (Qtd)", "Capina/H", "Varrição/H", "Pintura/H", "Roçagem/H", "Postes/H",
      "Total Linear (m)", "Meta Linear (m)", "Saldo Linear", "Total Roçagem (m2)", "Meta Roçagem (m2)", "Saldo Roçagem", "Observações", "Lat", "Lng"
    ];

    let sumCapina = 0; let sumVarricao = 0; let sumPintura = 0; let sumRocagem = 0; let sumPostes = 0;
    let sumHomens = 0; 
    let sumTotalLinear = 0; let sumSaldoLinear = 0;
    let sumTotalRocagem = 0; let sumSaldoRocagem = 0;

    const dataRows = filteredRDs.map(rd => {
        const dateObj = new Date(rd.date);
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        const timeStr = dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        
        const presentCount = rd.teamAttendance.filter(a => a.present).length;
        
        const mCapina = rd.metrics.capinaM || 0;
        const mVarricao = rd.metrics.varricaoM || 0;
        const mPintura = rd.metrics.pinturaViasM || 0;
        const mRocagem = rd.metrics.rocagemM2 || 0;
        const mPostes = rd.metrics.pinturaPostesUnd || 0;

        sumCapina += mCapina; sumVarricao += mVarricao; sumPintura += mPintura;
        sumRocagem += mRocagem; sumPostes += mPostes; sumHomens += presentCount;

        const capinaPerMan = presentCount > 0 ? (mCapina / presentCount).toFixed(2) : "0";
        const varricaoPerMan = presentCount > 0 ? (mVarricao / presentCount).toFixed(2) : "0";
        const pinturaPerMan = presentCount > 0 ? (mPintura / presentCount).toFixed(2) : "0";
        const rocagemPerMan = presentCount > 0 ? (mRocagem / presentCount).toFixed(2) : "0";
        const postesPerMan = presentCount > 0 ? (mPostes / presentCount).toFixed(2) : "0";

        // Logic split: Linear vs Area
        const totalLinear = mCapina + mVarricao + mPintura;
        const balanceLinear = totalLinear - 1950;
        
        const totalRocagemLocal = mRocagem;
        const balanceRocagem = totalRocagemLocal - 1000;

        sumTotalLinear += totalLinear;
        sumSaldoLinear += balanceLinear;
        sumTotalRocagem += totalRocagemLocal;
        sumSaldoRocagem += balanceRocagem;

        // Tracking Data
        let trackStart = '-';
        let trackEnd = '-';
        let duration = '';
        let distance = '0';

        if (rd.segments && rd.segments.length > 0) {
            trackStart = new Date(rd.segments[0].startedAt).toLocaleTimeString('pt-BR');
            trackEnd = new Date(rd.segments[rd.segments.length - 1].endedAt).toLocaleTimeString('pt-BR');
            const totalDist = rd.segments.reduce((acc, s) => acc + s.distance, 0);
            distance = totalDist.toFixed(1);
        } else if (rd.gpsTrack) {
            trackStart = new Date(rd.gpsTrack.startedAt).toLocaleTimeString('pt-BR');
            trackEnd = rd.gpsTrack.endedAt ? new Date(rd.gpsTrack.endedAt).toLocaleTimeString('pt-BR') : '-';
            duration = formatSecondsToTime(rd.gpsTrack.durationSeconds);
            distance = rd.gpsTrack.totalDistanceMeters.toFixed(1);
        }

        return [
          rd.id, dateStr, timeStr, rd.foremanName, rd.foremanRegistration || '', rd.base || '', rd.shift || '', rd.status, rd.serviceCategory,
          rd.street, rd.neighborhood, (rd.perimeter || '').replace(/;/g, ',').replace(/\n/g, ' '),
          trackStart, trackEnd, duration, distance.replace('.', ','),
          mCapina.toString().replace('.', ','), mVarricao.toString().replace('.', ','), mPintura.toString().replace('.', ','), mRocagem.toString().replace('.', ','), mPostes.toString().replace('.', ','),
          presentCount, capinaPerMan.replace('.', ','), varricaoPerMan.replace('.', ','), pinturaPerMan.replace('.', ','), rocagemPerMan.replace('.', ','), postesPerMan.replace('.', ','),
          totalLinear.toString().replace('.', ','), '1950', balanceLinear.toFixed(2).replace('.', ','), totalRocagemLocal.toString().replace('.', ','), '1000', balanceRocagem.toFixed(2).replace('.', ','), (rd.observations || '').replace(/;/g, ',').replace(/\n/g, ' '),
          rd.location?.lat || '', rd.location?.lng || ''
        ].join(";");
    });

    const footerRow = [
      "TOTAIS DO PERÍODO", "", "", "", "", "", "", "", "", "", "", "", 
      "", "", "", "", // Empty tracking cols
      sumCapina.toFixed(2).replace('.', ','), sumVarricao.toFixed(2).replace('.', ','), sumPintura.toFixed(2).replace('.', ','), sumRocagem.toFixed(2).replace('.', ','), sumPostes.toFixed(0).replace('.', ','),
      sumHomens.toString(), "-", "-", "-", "-", "-",
      sumTotalLinear.toFixed(2).replace('.', ','), "-", sumSaldoLinear.toFixed(2).replace('.', ','), sumTotalRocagem.toFixed(2).replace('.', ','), "-", sumSaldoRocagem.toFixed(2).replace('.', ','), "", "", ""
    ].join(";");

    const csvContent = [headers.join(";"), ...dataRows, footerRow].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ciclus_RD_Export_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateAIReport = async () => {
    setIsGeneratingReport(true);
    setAiReport(null);
    const report = await generateDailyReportSummary(filteredRDs);
    setAiReport(report);
    setIsGeneratingReport(false);
  };

  return (
    <div className="space-y-6">
      
      {/* --- Filter Bar --- */}
      <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar por Encarregado, Rua, Bairro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-ciclus-500 outline-none" />
            </div>
            <div className="flex gap-2">
                <div className="flex border border-gray-200 rounded-md overflow-hidden">
                    <button onClick={() => setDateFilterType('month')} className={`px-3 py-2 text-xs font-medium ${dateFilterType === 'month' ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-500'}`}>Mês</button>
                    <button onClick={() => setDateFilterType('day')} className={`px-3 py-2 text-xs font-medium ${dateFilterType === 'day' ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-500'}`}>Dia</button>
                </div>
                {dateFilterType === 'month' ? (
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 outline-none focus:border-ciclus-500" />
                ) : (
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 outline-none focus:border-ciclus-500" />
                )}
            </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-t border-gray-100 pt-3">
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {['ALL', RDStatus.PENDING, RDStatus.APPROVED, RDStatus.REJECTED].map(st => (
                <button key={st} onClick={() => setFilterStatus(st)} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === st ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {st === 'ALL' ? 'Todos' : st}
                </button>
                ))}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                {currentUser.role === UserRole.CCO && (
                    <button onClick={handleGenerateAIReport} disabled={isGeneratingReport} className="flex-1 md:flex-none items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium flex">
                    <Sparkles className={`w-4 h-4 ${isGeneratingReport ? 'animate-spin' : ''}`} /> {isGeneratingReport ? 'Processando' : 'Análise IA'}
                    </button>
                )}
                {currentUser.role !== UserRole.ENCARREGADO && (
                    <button onClick={handleExportCSV} className="flex-1 md:flex-none items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium flex">
                    <FileSpreadsheet className="w-4 h-4" /> Excel (Relatório)
                    </button>
                )}
            </div>
        </div>
      </div>

      {currentUser.role !== UserRole.ENCARREGADO && (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-4 text-white shadow-lg animate-in fade-in slide-in-from-top-2">
           <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Calculator className="w-4 h-4" /> Total do Período/Filtro Selecionado</h3>
           <div className="grid grid-cols-2 md:grid-cols-5 gap-4 divide-x divide-gray-700">
               <div className="pl-2"><p className="text-2xl font-bold">{periodTotals.capina.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m</span></p><p className="text-[10px] text-gray-400 uppercase">Capinação</p></div>
               <div className="pl-4"><p className="text-2xl font-bold">{periodTotals.varricao.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m</span></p><p className="text-[10px] text-gray-400 uppercase">Varrição</p></div>
               <div className="pl-4"><p className="text-2xl font-bold">{periodTotals.rocagem.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m²</span></p><p className="text-[10px] text-gray-400 uppercase">Roçagem</p></div>
               <div className="pl-4"><p className="text-2xl font-bold">{periodTotals.pintura.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">m</span></p><p className="text-[10px] text-gray-400 uppercase">Pintura</p></div>
               <div className="pl-4"><p className="text-2xl font-bold">{periodTotals.rdsCount}</p><p className="text-[10px] text-gray-400 uppercase">RDs Listados</p></div>
           </div>
        </div>
      )}

      {aiReport && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5 text-purple-600" /><h3 className="font-bold text-purple-800">Insights da IA Gemini</h3></div>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">{aiReport}</div>
          <button onClick={() => setAiReport(null)} className="text-xs text-purple-500 underline mt-4">Fechar</button>
        </div>
      )}

      <div className="space-y-4">
        {filteredRDs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300"><p className="text-gray-400">Nenhum RD encontrado com os filtros selecionados.</p></div>
        ) : (
          filteredRDs.map(rd => {
            const isPending = rd.status === RDStatus.PENDING;
            const isSupervisor = currentUser.role === UserRole.SUPERVISOR;
            const isCCO = currentUser.role === UserRole.CCO;
            const isAssignedToMe = rd.supervisorId === currentUser.id;
            const isMyCreation = rd.foremanId === currentUser.id;
            const canManage = isCCO || (isSupervisor && isAssignedToMe);
            const canEdit = isCCO || (isSupervisor && (isAssignedToMe || isMyCreation));

            return (
            <div key={rd.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start cursor-pointer" onClick={() => setExpandedId(expandedId === rd.id ? null : rd.id)}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${rd.status === RDStatus.APPROVED ? 'bg-green-100 text-green-800' : rd.status === RDStatus.REJECTED ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{rd.status}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(rd.date).toLocaleDateString('pt-BR')} <span className="text-[10px] bg-gray-50 px-1 rounded flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {new Date(rd.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span></span>
                    {isSupervisor && isAssignedToMe && !isMyCreation && (
                         <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-0.5"><UserIcon className="w-2 h-2" /> Atribuído a você</span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm md:text-base">{rd.serviceCategory}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {rd.street}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Encarregado: {rd.foremanName} {rd.foremanRegistration ? `(${rd.foremanRegistration})` : ''}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <Eye className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === rd.id ? 'rotate-180' : ''}`} />
                  {rd.base && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{rd.base}</span>}
                </div>
              </div>

              <div className="px-4 py-2 bg-gray-50 flex gap-4 text-xs text-gray-600 border-b border-gray-100 overflow-x-auto">
                {rd.metrics.capinaM > 0 && <span><strong>Cap:</strong> {rd.metrics.capinaM}m</span>}
                {rd.metrics.varricaoM > 0 && <span><strong>Var:</strong> {rd.metrics.varricaoM}m</span>}
                {rd.metrics.pinturaViasM > 0 && <span><strong>Pint:</strong> {rd.metrics.pinturaViasM}m</span>}
                {rd.metrics.rocagemM2 > 0 && <span><strong>Roç:</strong> {rd.metrics.rocagemM2}m²</span>}
                {rd.metrics.pinturaPostesUnd > 0 && <span><strong>Postes:</strong> {rd.metrics.pinturaPostesUnd}</span>}
              </div>

              {expandedId === rd.id && (
                <div className="bg-white p-4 animate-in slide-in-from-top-2">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex gap-4 mb-2">
                           {rd.base && <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"><Map className="w-3 h-3 text-gray-400" /> Base: <strong>{rd.base}</strong></div>}
                           {rd.shift && <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"><Clock className="w-3 h-3 text-gray-400" /> Turno: <strong>{rd.shift}</strong></div>}
                        </div>
                        
                        {/* New Segment-based Tracking Visualization */}
                        {(rd.segments && rd.segments.length > 0) ? (
                            <div className="bg-blue-50 rounded p-3 border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-800 uppercase mb-2 flex items-center gap-1"><Route className="w-3 h-3" /> Trechos de GPS ({rd.segments.length})</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-gray-700 border-b border-blue-200 pb-1">
                                        <span>Total Percorrido:</span>
                                        <span>
                                            {rd.segments.reduce((acc,s) => acc + s.distance, 0).toFixed(0)}m
                                        </span>
                                    </div>
                                    <div className="max-h-24 overflow-y-auto pr-1 space-y-1">
                                        {rd.segments.map((seg, idx) => (
                                            <div key={idx} className="flex justify-between text-[10px] text-gray-600 bg-white/50 p-1 rounded">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{seg.type}</span>
                                                    <span className="text-[9px] text-gray-400">{new Date(seg.startedAt).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span>{seg.distance.toFixed(0)}m</span>
                                                    {seg.type === 'ROCAGEM' && <span className="block text-[9px] text-gray-400">{seg.calculatedValue.toFixed(0)}m²</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : rd.gpsTrack ? (
                            // Legacy Tracking View
                            <div className="bg-gray-50 rounded p-2 border border-gray-200 opacity-75">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><MapPinned className="w-3 h-3" /> Dados GPS (Antigo)</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-gray-500">Início</p>
                                        <p className="font-bold text-gray-700">{new Date(rd.gpsTrack.startedAt).toLocaleTimeString('pt-BR')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-500">Fim</p>
                                        <p className="font-bold text-gray-700">{rd.gpsTrack.endedAt ? new Date(rd.gpsTrack.endedAt).toLocaleTimeString('pt-BR') : '-'}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 mt-2 pt-1 text-xs font-bold text-gray-600">
                                    <span>Distância: {rd.gpsTrack.totalDistanceMeters.toFixed(1)} m</span>
                                    <span>Tempo: {formatSecondsToTime(rd.gpsTrack.durationSeconds)}</span>
                                </div>
                            </div>
                        ) : null}

                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase">Localização</p>
                          <p className="text-sm">{rd.street}, {rd.neighborhood} <br/> <span className="text-gray-500 italic">{rd.perimeter}</span></p>
                          {rd.location && (
                             <a href={`https://www.google.com/maps/search/?api=1&query=${rd.location.lat},${rd.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline mt-1 block">Ver no Google Maps ({rd.location.lat.toFixed(4)}, {rd.location.lng.toFixed(4)})</a>
                          )}
                        </div>
                        <div>
                           <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-bold text-gray-400 uppercase">Frequência ({rd.teamAttendance.filter(a=>a.present).length}/{rd.teamAttendance.length})</p>
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">Homens: {rd.teamAttendance.filter(a=>a.present).length}</span>
                           </div>
                           <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                             {rd.teamAttendance.map(p => (
                               <li key={p.employeeId} className={`flex items-center gap-2 ${!p.present ? 'text-red-500' : 'text-gray-600'}`}>
                                 <div className={`w-1.5 h-1.5 rounded-full ${p.present ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                 <span>{p.name} <span className="opacity-75 font-mono">({p.registration})</span> - {p.role}</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                        {rd.observations && <div className="bg-yellow-50 p-3 rounded border border-yellow-100"><p className="text-xs font-bold text-yellow-800 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Observações / Ocorrências</p><p className="text-sm text-gray-700 italic">{rd.observations}</p></div>}
                      </div>

                      <div className="space-y-4">
                        {rd.workPhotoUrl && <div><p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Foto do Serviço</p><img src={rd.workPhotoUrl} alt="Foto do Serviço" className="w-full h-auto max-h-48 object-contain border rounded bg-gray-100" /></div>}
                      </div>
                   </div>

                   {rd.supervisorNote && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded text-red-800 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" /><div><strong>Nota da Recusa:</strong> {rd.supervisorNote}</div></div>
                   )}

                   <div className="mt-6 pt-4 border-t border-gray-100">
                      {rejectingId === rd.id ? (
                         <div className="p-4 bg-red-50 rounded border border-red-100 animate-in fade-in">
                            <label className="block text-xs font-bold text-red-800 uppercase mb-2">Motivo da Recusa</label>
                            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full p-3 border border-red-200 rounded text-sm mb-3 focus:ring-red-500 focus:border-red-500 bg-white" placeholder="Descreva o motivo para o encarregado corrigir..." autoFocus rows={2} />
                            <div className="flex gap-2 justify-end"><button onClick={handleCancelAction} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-bold hover:bg-gray-50 transition-colors">Cancelar</button><button onClick={() => handleSubmitRejection(rd.id)} className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-1"><XCircle className="w-4 h-4" /> Confirmar Recusa</button></div>
                         </div>
                      ) : approvingId === rd.id ? (
                        <div className="p-4 bg-green-50 rounded border border-green-100 animate-in fade-in">
                            <p className="text-sm font-bold text-green-800 mb-3 text-center md:text-left">Confirmar aprovação deste relatório?</p>
                            <div className="flex gap-2 justify-end"><button onClick={handleCancelAction} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-bold hover:bg-gray-50 transition-colors">Cancelar</button><button onClick={() => handleConfirmApproval(rd.id)} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Sim, Aprovar</button></div>
                        </div>
                      ) : deletingId === rd.id ? (
                         <div className="p-4 bg-red-50 rounded border border-red-100 animate-in fade-in">
                             <p className="text-sm font-bold text-red-800 mb-2 text-center md:text-left">ATENÇÃO: Excluir esta RD permanentemente?</p>
                             <div className="flex gap-2 justify-end"><button onClick={handleCancelAction} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-bold hover:bg-gray-50 transition-colors">Cancelar</button><button onClick={() => handleConfirmDelete(rd.id)} className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-1"><Trash2 className="w-4 h-4" /> Confirmar</button></div>
                         </div>
                      ) : (
                        <div className="flex flex-col md:flex-row gap-2 justify-between">
                            <div className="flex gap-2 w-full">
                                {currentUser.id === rd.foremanId && rd.status === RDStatus.REJECTED && (<button onClick={() => onEditRD(rd)} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold hover:bg-blue-700 transition-colors">Corrigir e Reenviar</button>)}
                                {canManage && isPending && (<><button onClick={(e) => handleApproveClick(e, rd.id)} className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors font-medium text-sm"><CheckCircle2 className="w-4 h-4" /> Aprovar</button><button onClick={(e) => handleRejectClick(e, rd.id)} className="flex-1 flex items-center justify-center gap-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 transition-colors font-medium text-sm"><XCircle className="w-4 h-4" /> Recusar</button></>)}
                                {canEdit && !isPending && (
                                     <button onClick={(e) => handleEditConfirm(e, rd)} className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-700 border border-gray-300 py-2 rounded hover:bg-gray-200 transition-colors font-medium text-sm" title="Editar registro">
                                        <Pencil className="w-4 h-4" /> Editar
                                     </button>
                                )}
                            </div>
                            {currentUser.role === UserRole.CCO && (
                                <div className="flex flex-col md:flex-row gap-2 mt-2 md:mt-0 w-full md:w-auto"><button onClick={(e) => handleDeleteClick(e, rd.id)} className="bg-gray-100 text-red-600 px-3 py-2 rounded border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center gap-1 justify-center w-full" title="Excluir RD permanentemente"><Trash2 className="w-4 h-4" /><span className="md:hidden">Excluir RD</span></button></div>
                            )}
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};
