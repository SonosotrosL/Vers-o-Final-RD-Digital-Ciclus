
import React, { useState, useEffect, useRef } from 'react';
import { ServiceCategory, RDData, RDStatus, AttendanceRecord, GeoLocation, User, ProductionMetrics, Employee, Base, Shift, UserRole, TrackSegment } from '../types';
import { getEmployees, getUsers } from '../services/storageService';
import { MapPin, Users, Save, RefreshCw, AlertTriangle, FileText, Clock, Map, Lock, Play, Square, Ruler, Image as ImageIcon, Trash2, Calculator, Loader2, Calendar, UserCheck, Navigation2, Footprints, ChevronRight, Camera, Crosshair, MapPinned } from 'lucide-react';

interface RDFormProps {
  currentUser: User;
  onSave: (data: RDData) => Promise<void>; 
  onCancel: () => void;
  existingData?: RDData; 
}

const STEP_LENGTH_METERS = 0.75; 
const WIDTH_OPTIONS = [
    { value: '1', label: 'Beira de Calçada' },
    { value: '1.5', label: 'Canteiro Central' },
    { value: '2', label: 'Lateral de Pista' },
    { value: '3', label: 'Terreno Aberto' }
];

export const RDForm: React.FC<RDFormProps> = ({ currentUser, onSave, onCancel, existingData }) => {
  // --- Estados do Formulário ---
  const [rdDate, setRdDate] = useState<string>(existingData?.date ? existingData.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [rdTime, setRdTime] = useState<string>(existingData?.date ? new Date(existingData.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}));
  const [base, setBase] = useState<Base>(existingData?.base || Base.NORTE);
  const [shift, setShift] = useState<Shift>(existingData?.shift || Shift.DIURNO);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>(existingData?.serviceCategory || ServiceCategory.MUTIRAO);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>(existingData?.supervisorId || '');
  const [availableSupervisors, setAvailableSupervisors] = useState<User[]>([]);
  
  const [street, setStreet] = useState(existingData?.street || '');
  const [neighborhood, setNeighborhood] = useState(existingData?.neighborhood || '');
  const [perimeter, setPerimeter] = useState(existingData?.perimeter || '');
  const [nearbyStreets, setNearbyStreets] = useState<string[]>([]);
  const [nearbyNeighborhoods, setNearbyNeighborhoods] = useState<string[]>([]);
  const [selectedPerimeterStreets, setSelectedPerimeterStreets] = useState<string[]>([]);
  
  const [metrics, setMetrics] = useState<ProductionMetrics>(existingData?.metrics || { capinaM: 0, pinturaViasM: 0, pinturaPostesUnd: 0, rocagemM2: 0, varricaoM: 0 });
  const [observations, setObservations] = useState(existingData?.observations || '');
  const [segments, setSegments] = useState<TrackSegment[]>(existingData?.segments || []);
  
  // --- Estados do Odômetro e Rastreamento ---
  const [activeSegmentType, setActiveSegmentType] = useState<'CAPINAÇÃO' | 'ROCAGEM' | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackStartTime, setTrackStartTime] = useState<number | null>(null);
  const [currentStartLocation, setCurrentStartLocation] = useState<GeoLocation | undefined>(undefined);
  const [currentTrackPoints, setCurrentTrackPoints] = useState<{lat: number, lng: number}[]>([]);
  
  const [currentSteps, setCurrentSteps] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pendingSegment, setPendingSegment] = useState<Partial<TrackSegment> | null>(null);
  const [rocagemWidth, setRocagemWidth] = useState<string>('');
  
  // --- Estados de GPS e UI ---
  const [loadingGPS, setLoadingGPS] = useState<{ active: boolean, message: string }>({ active: false, message: '' });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  
  const [photoBefore, setPhotoBefore] = useState<string>(existingData?.photoBeforeUrl || '');
  const [photoAfter, setPhotoAfter] = useState<string>(existingData?.photoAfterUrl || '');
  const photoBeforeInputRef = useRef<HTMLInputElement>(null);
  const photoAfterInputRef = useRef<HTMLInputElement>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const lastStepTimeRef = useRef<number>(0);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(existingData?.teamAttendance || []);

  // --- Lógica de Inicialização ---
  useEffect(() => {
    const loadInitialData = async () => {
        const allUsers = await getUsers();
        const sups = allUsers.filter(u => u.role === UserRole.SUPERVISOR);
        setAvailableSupervisors(sups);
        
        if (currentUser.role === UserRole.SUPERVISOR) {
            setSelectedSupervisorId(currentUser.id);
        }

        if (!existingData) {
            const allEmployees = await getEmployees();
            let myTeam = allEmployees.filter(e => e.supervisorId === (selectedSupervisorId || currentUser.id));
            if (myTeam.length === 0) myTeam = allEmployees;
            setAttendance(myTeam.map(e => ({ employeeId: e.id, name: e.name, registration: e.registration, role: e.role, present: true })));
        }
    };
    loadInitialData();
  }, [currentUser, existingData, selectedSupervisorId]);

  useEffect(() => {
    const totalCapina = segments.filter(s => s.type === 'CAPINAÇÃO').reduce((sum, s) => sum + s.calculatedValue, 0);
    const totalRocagem = segments.filter(s => s.type === 'ROCAGEM').reduce((sum, s) => sum + s.calculatedValue, 0);
    setMetrics(prev => ({ ...prev, capinaM: parseFloat(totalCapina.toFixed(1)), rocagemM2: parseFloat(totalRocagem.toFixed(1)) }));
  }, [segments]);

  // --- Funções de GPS e Geolocalização ---

  const getUltraResilientPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 };
      
      // Tentativa 1: Alta Precisão
      navigator.geolocation.getCurrentPosition(resolve, (err1) => {
        console.warn("GPS Tentativa 1 (Alta Precisão) falhou", err1);
        
        // Tentativa 2: Precisão Padrão com mais tempo
        navigator.geolocation.getCurrentPosition(resolve, (err2) => {
           console.warn("GPS Tentativa 2 (Padrão) falhou", err2);
           
           // Tentativa 3: Baixa Precisão / Cache permitido
           navigator.geolocation.getCurrentPosition(resolve, (err3) => {
             console.error("Todas as tentativas de GPS falharam", err3);
             reject(err3);
           }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
           
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
        
      }, options);
    });
  };

  const calculateDistanceGPS = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchNearbyData = async (lat: number, lng: number) => {
    try {
        // Correção da query Overpass para evitar erros de sintaxe
        const query = `[out:json][timeout:15];(way["highway"]["name"](around:500,${lat},${lng});way["boundary"="administrative"]["admin_level"="10"](around:500,${lat},${lng}););out tags;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const streetNames = new Set<string>();
            const hoodNames = new Set<string>();
            data.elements.forEach((el: any) => { 
                if (el.tags && el.tags.name) {
                    if (el.tags.highway) streetNames.add(el.tags.name);
                    else hoodNames.add(el.tags.name);
                }
            });
            setNearbyStreets(Array.from(streetNames).sort());
            if (hoodNames.size > 0) setNearbyNeighborhoods(Array.from(hoodNames).sort());
        }
    } catch (e) { console.warn("Overpass failed", e); }
  };

  const fetchAddressReverse = async (lat: number, lng: number): Promise<{street: string, hood: string} | null> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const foundStreet = addr.road || addr.street || addr.pedestrian || addr.path || addr.living_street || '';
                const foundHood = addr.suburb || addr.neighbourhood || addr.city_district || addr.district || '';
                return { street: foundStreet, hood: foundHood };
            }
        }
    } catch (e) { console.warn("Nominatim failed", e); }
    return null;
  };

  const handleStartSegment = async (type: 'CAPINAÇÃO' | 'ROCAGEM') => {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          try { await (DeviceMotionEvent as any).requestPermission(); } catch(e){}
      }
      
      setLoadingGPS({ active: true, message: 'Capturando Local de Início...' });
      setActiveSegmentType(type);
      
      try {
        const pos = await getUltraResilientPosition();
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setGpsAccuracy(accuracy);
        
        // Dispara buscas paralelas (não bloqueia o início do trecho)
        fetchNearbyData(lat, lng);
        fetchAddressReverse(lat, lng).then(addr => {
          if (addr) {
            if (!street) setStreet(addr.street);
            if (!neighborhood) setNeighborhood(addr.hood);
          }
        });

        setCurrentStartLocation({ lat, lng, accuracy, timestamp: pos.timestamp, addressFromGPS: "Início" });
        setTrackStartTime(Date.now());
        setIsTracking(true);
        setCurrentTrackPoints([{lat, lng}]);
        setCurrentSteps(0);
        setCurrentDistance(0);
        setElapsedTime(0);
        
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        window.addEventListener('devicemotion', handleMotion);
        
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = navigator.geolocation.watchPosition((p) => {
            setGpsAccuracy(p.coords.accuracy);
            const nLat = p.coords.latitude; const nLng = p.coords.longitude;
            setCurrentTrackPoints(prev => {
                const last = prev[prev.length - 1];
                const d = calculateDistanceGPS(last.lat, last.lng, nLat, nLng);
                // Registra pontos se houver deslocamento significativo
                if (d > 10 || (d > 3 && isMoving)) return [...prev, {lat: nLat, lng: nLng}];
                return prev;
            });
        }, null, { enableHighAccuracy: true });

        setLoadingGPS({ active: false, message: '' });
      } catch (err) {
        setLoadingGPS({ active: false, message: '' });
        setActiveSegmentType(null);
        alert("Falha ao obter GPS. Certifique-se de que as permissões foram concedidas e que você está em um local aberto.");
      }
  };

  const handleStopSegment = async () => {
      setLoadingGPS({ active: true, message: 'Capturando Local de Término...' });
      window.removeEventListener('devicemotion', handleMotion);
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      
      try {
        const pos = await getUltraResilientPosition();
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setGpsAccuracy(accuracy);
        
        const addrAtEnd = await fetchAddressReverse(lat, lng);
        
        const tempSegment: Partial<TrackSegment> = {
            id: `seg-${Date.now()}`,
            type: activeSegmentType!,
            startedAt: new Date(trackStartTime!).toISOString(),
            endedAt: new Date().toISOString(),
            startLocation: currentStartLocation,
            endLocation: { lat, lng, accuracy, timestamp: pos.timestamp },
            street: addrAtEnd?.street || street || "Trecho Registrado",
            neighborhood: addrAtEnd?.hood || neighborhood || "Bairro Registrado",
            distance: currentDistance,
            pathPoints: currentTrackPoints
        };

        setIsTracking(false);
        setLoadingGPS({ active: false, message: '' });
        
        if (activeSegmentType === 'ROCAGEM') { 
            setPendingSegment(tempSegment); 
            setRocagemWidth(''); 
        } else {
            setSegments(prev => [...prev, { ...tempSegment, calculatedValue: tempSegment.distance! } as TrackSegment]);
            setActiveSegmentType(null);
            if (addrAtEnd) {
                setStreet(addrAtEnd.street);
                setNeighborhood(addrAtEnd.hood);
            }
        }
      } catch (err) {
        setLoadingGPS({ active: false, message: '' });
        setIsTracking(false);
        setActiveSegmentType(null);
        alert("Falha ao capturar ponto final do GPS. O trecho foi encerrado, mas pode haver imprecisão no local de término.");
      }
  };

  const handleForceUpdateLocation = async () => {
    setLoadingGPS({ active: true, message: 'Atualizando Localização...' });
    try {
      const pos = await getUltraResilientPosition();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      setGpsAccuracy(accuracy);
      
      // Busca dados de rua e bairro baseados na posição atual
      fetchNearbyData(lat, lng);
      const addr = await fetchAddressReverse(lat, lng);
      
      if (addr) {
          if (addr.street) setStreet(addr.street);
          if (addr.hood) setNeighborhood(addr.hood);
      }
      setLoadingGPS({ active: false, message: '' });
    } catch (err: any) {
      setLoadingGPS({ active: false, message: '' });
      const errorMsg = err?.message || JSON.stringify(err);
      console.error("Manual GPS update failed:", errorMsg);
      alert("Não foi possível obter a localização. Verifique o sinal do GPS e as permissões do navegador.");
    }
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity;
    if (!accel || accel.x === null || accel.y === null || accel.z === null) return;
    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
    const now = Date.now();
    // Sensibilidade do acelerômetro para passos reais (previne distância fantasma)
    if (magnitude > 13.0 && (now - lastStepTimeRef.current) > 400) {
        setCurrentSteps(prev => prev + 1);
        lastStepTimeRef.current = now;
        setIsMoving(true);
        setTimeout(() => { if (Date.now() - lastStepTimeRef.current > 2000) setIsMoving(false); }, 2500);
    }
  };

  useEffect(() => { setCurrentDistance(currentSteps * STEP_LENGTH_METERS); }, [currentSteps]);

  const handleCorrectionStreet = async (st: string) => {
      setStreet(st);
      try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(st + ', Belém, PA')}&limit=1&addressdetails=1`);
          if (res.ok) {
              const data = await res.json();
              if (data && data[0] && data[0].address) {
                  const nb = data[0].address.suburb || data[0].address.neighbourhood || data[0].address.city_district || "";
                  if (nb) setNeighborhood(nb);
              }
          }
      } catch(e){}
  };

  const handleAddPerimeterStreet = (st: string) => {
    let n = [...selectedPerimeterStreets];
    if (n.includes(st)) n = n.filter(s => s !== st); else n.push(st);
    if (n.length > 2) n = [st];
    if (n.length === 2) setPerimeter(`Entre ${n[0]} e ${n[1]}`);
    else if (n.length === 1) setPerimeter(`Esquina com ${n[0]}`);
    else setPerimeter('');
    setSelectedPerimeterStreets(n);
  };

  const confirmRocagemSegment = () => {
      const w = parseFloat(rocagemWidth.replace(',', '.'));
      if (!w || w <= 0) { alert("Largura inválida."); return; }
      setSegments(prev => [...prev, { ...pendingSegment, width: w, calculatedValue: (pendingSegment!.distance || 0) * w } as TrackSegment]);
      setPendingSegment(null);
      setActiveSegmentType(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'after') => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              if (target === 'before') setPhotoBefore(reader.result as string);
              else setPhotoAfter(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const removeSegment = (id: string) => { if(confirm("Remover trecho?")) setSegments(prev => prev.filter(s => s.id !== id)); };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervisorId) { alert("Selecione o Supervisor."); return; }
    if (!photoBefore && !photoAfter) { alert("Anexe fotos de evidência (Antes e Depois)."); return; }
    setIsSaving(true);
    await onSave({
      id: existingData?.id || ``, 
      date: new Date(`${rdDate}T${rdTime}:00`).toISOString(),
      foremanId: currentUser.id, foremanName: currentUser.name, foremanRegistration: currentUser.registration,
      supervisorId: selectedSupervisorId, status: RDStatus.PENDING,
      base, shift, serviceCategory, street, neighborhood, perimeter, metrics,
      location: segments.length > 0 ? segments[0].startLocation : undefined, 
      segments: segments, teamAttendance: attendance, 
      photoBeforeUrl: photoBefore, photoAfterUrl: photoAfter,
      workPhotoUrl: photoAfter || photoBefore, 
      observations, createdAt: Date.now()
    });
    setIsSaving(false);
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-10 relative">
      {loadingGPS.active && (
          <div className="absolute inset-0 bg-black/70 z-[100] flex flex-col items-center justify-center text-white p-6 text-center animate-in fade-in">
              <div className="bg-white/10 p-10 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl flex flex-col items-center gap-4">
                  <div className="relative">
                    <RefreshCw className="w-16 h-16 animate-spin text-ciclus-400 opacity-20" />
                    <Navigation2 className="w-8 h-8 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                  </div>
                  <p className="font-black uppercase tracking-widest text-lg">{loadingGPS.message}</p>
                  <p className="text-xs opacity-60">Isso pode levar alguns segundos dependendo da visibilidade do céu e do sinal da rede.</p>
              </div>
          </div>
      )}

      <div className="bg-ciclus-700 p-4 text-white flex justify-between items-center sticky top-0 z-40 shadow-md">
        <h2 className="text-lg font-bold">{existingData ? 'Corrigir RD' : 'Novo Relatório Diário'}</h2>
        <span className="text-xs bg-ciclus-800 px-2 py-1 rounded font-mono">{currentUser.name}</span>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        <section className="bg-yellow-50 p-4 rounded border border-yellow-200">
            <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Supervisor Responsável</label>
            <select required value={selectedSupervisorId} onChange={e => setSelectedSupervisorId(e.target.value)} className="w-full p-2 border border-yellow-300 rounded bg-white text-gray-700 font-bold">
                <option value="">Selecione o Supervisor...</option>
                {availableSupervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
        </section>

        <section><h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> 1. Dados Operacionais</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Data</label><input type="date" required value={rdDate} onChange={e => setRdDate(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-md font-bold text-gray-700 bg-gray-50" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Horário</label><input type="time" required value={rdTime} onChange={e => setRdTime(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-md font-bold text-gray-700 bg-gray-50" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Base</label><select value={base} onChange={e => setBase(e.target.value as Base)} className="w-full p-2 text-sm border border-gray-300 rounded-md font-bold">{Object.values(Base).map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Turno</label><select value={shift} onChange={e => setShift(e.target.value as Shift)} className="w-full p-2 text-sm border border-gray-300 rounded-md font-bold">{Object.values(Shift).map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
        </section>
        
        <section className="border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2"><MapPin className="w-4 h-4" /> 2. Controle de Trechos</h3>
            {gpsAccuracy && <div className="text-[10px] font-bold uppercase flex items-center gap-1">GPS: <span className={gpsAccuracy < 30 ? 'text-green-600' : 'text-red-600'}>{gpsAccuracy.toFixed(0)}m</span></div>}
          </div>
          
          <div className="space-y-4">
              {!isTracking && !pendingSegment && (
                <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => handleStartSegment('CAPINAÇÃO')} className="bg-ciclus-600 hover:bg-ciclus-700 text-white py-5 rounded-xl font-bold shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition-all">
                        <Play className="w-6 h-6 fill-current" />
                        <span className="text-xs sm:text-sm uppercase tracking-wider">Iniciar Capinação</span>
                    </button>
                    <button type="button" onClick={() => handleStartSegment('ROCAGEM')} className="bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-xl font-bold shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition-all">
                        <Play className="w-6 h-6 fill-current" />
                        <span className="text-xs sm:text-sm uppercase tracking-wider">Iniciar Roçagem</span>
                    </button>
                </div>
              )}
              {isTracking && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase bg-blue-200 text-blue-800 px-3 py-1 rounded-full">{activeSegmentType}</span>
                            {isMoving && <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold animate-pulse"><Navigation2 className="w-3 h-3 rotate-45" /> EM MOVIMENTO</div>}
                        </div>
                        <span className="font-mono text-2xl font-black text-gray-800">{Math.floor(elapsedTime/60).toString().padStart(2,'0')}:{(elapsedTime%60).toString().padStart(2,'0')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-blue-100 text-center shadow-sm">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Distância</p>
                            <p className="text-4xl font-black text-blue-700">{currentDistance.toFixed(1)}<span className="text-sm font-bold ml-1">m</span></p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-blue-100 text-center shadow-sm">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Passos Reais</p>
                            <p className="text-4xl font-black text-gray-700 flex items-center justify-center gap-1"><Footprints className="w-6 h-6 text-blue-400" /> {currentSteps}</p>
                        </div>
                    </div>
                    <button type="button" onClick={handleStopSegment} className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-xl font-bold shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg uppercase tracking-widest">
                        <Square className="w-6 h-6 fill-current" />
                        Parar e Gravar Trecho
                    </button>
                </div>
              )}
              {pendingSegment && activeSegmentType === 'ROCAGEM' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 animate-in fade-in scale-100">
                    <h4 className="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-2"><Ruler className="w-4 h-4" /> Informe a Largura do Corte</h4>
                    <p className="text-xs text-gray-600 mb-4">Trecho de <strong>{pendingSegment.distance?.toFixed(1)}m</strong>.</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {WIDTH_OPTIONS.map((opt) => (
                            <button key={opt.value} type="button" onClick={() => setRocagemWidth(opt.value)} className={`py-4 px-3 rounded-xl border text-left transition-all flex flex-col justify-center ${rocagemWidth === opt.value ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105' : 'bg-white text-gray-600 border-gray-300'}`}>
                                <span className="font-black text-xl">{opt.value}m</span>
                                <span className={`text-[10px] uppercase font-bold ${rocagemWidth === opt.value ? 'text-emerald-100' : 'text-gray-400'}`}>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 items-end pt-3 border-t border-emerald-100">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Customizado (m)</label>
                            <input type="number" step="0.1" autoFocus value={rocagemWidth} onChange={e => setRocagemWidth(e.target.value)} className="w-full p-3 border border-emerald-300 rounded-lg text-xl font-black" />
                        </div>
                        <button type="button" onClick={confirmRocagemSegment} className="bg-emerald-600 text-white px-8 py-4 rounded-lg font-bold shadow-lg active:scale-95">OK</button>
                    </div>
                </div>
              )}

              {segments.length > 0 && (
                <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                        <span>Resumo dos Trechos ({segments.length})</span>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                        {segments.map((seg) => (
                            <div key={seg.id} className="p-4 bg-white hover:bg-gray-50">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${seg.type === 'CAPINAÇÃO' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{seg.type}</span>
                                        <span className="text-[10px] font-bold text-gray-500">{new Date(seg.startedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className="text-sm font-black text-gray-800">{seg.calculatedValue.toFixed(1)}{seg.type === 'CAPINAÇÃO' ? 'm' : 'm²'}</p>
                                </div>
                                <p className="text-[11px] font-bold text-gray-700 flex items-center gap-1"><MapPinned className="w-3 h-3 text-red-500" /> {seg.street}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] text-gray-400">Distância: {seg.distance.toFixed(1)}m</span>
                                    <button type="button" onClick={() => removeSegment(seg.id)} className="text-red-400 font-bold text-[10px] uppercase">Remover</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="md:col-span-2 relative z-30">
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Logradouro / Rua Principal</label>
                    <button type="button" onClick={handleForceUpdateLocation} className="text-ciclus-600 text-[10px] font-bold flex items-center gap-1 hover:underline active:scale-95 transition-all"><RefreshCw className={`w-3 h-3 ${loadingGPS.active ? 'animate-spin' : ''}`} /> REFRESH GPS</button>
                </div>
                <div className="relative">
                    <input required type="text" value={street} onChange={e => setStreet(e.target.value)} className="mt-1 block w-full rounded-xl border-gray-300 border p-4 pl-11 font-black text-gray-800 focus:ring-2 focus:ring-ciclus-500 outline-none shadow-sm" placeholder="Rua do serviço..." />
                    <div className="absolute left-3.5 top-4.5 text-gray-400"><MapPin className="w-5 h-5" /></div>
                </div>
                {nearbyStreets.length > 0 && (
                    <div className="mt-3 bg-yellow-50 p-3 rounded-xl border border-yellow-100 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] text-yellow-700 mb-2 font-bold uppercase tracking-tight flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Corrigir Rua:</p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                            {nearbyStreets.map((st, i) => (
                                <button type="button" key={i} onClick={() => handleCorrectionStreet(st)} className="text-[10px] px-3 py-2 rounded-lg border shadow-sm bg-white text-gray-700 border-gray-200 hover:bg-yellow-100 active:bg-yellow-200 transition-all font-bold">{st}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="relative z-20">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">Bairro</label>
                <input required type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="block w-full rounded-xl border-gray-300 border p-3.5 bg-gray-50 font-bold text-gray-700 focus:ring-2 focus:ring-ciclus-500 outline-none" />
                {nearbyNeighborhoods.length > 0 && (
                    <div className="mt-2">
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                            {nearbyNeighborhoods.map((nb, i) => (
                                <button type="button" key={i} onClick={() => setNeighborhood(nb)} className="text-[10px] px-2.5 py-1.5 rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-ciclus-50 transition-all font-bold">{nb}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">Perímetro / Referência</label>
                <input type="text" value={perimeter} onChange={e => setPerimeter(e.target.value)} className="block w-full rounded-xl border-gray-300 border p-3.5 font-bold text-gray-700 focus:ring-2 focus:ring-ciclus-500 outline-none shadow-sm" placeholder="Ex: Entre rua X e Y" />
                {nearbyStreets.length > 0 && (
                    <div className="mt-2">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Sugestões para Perímetro:</p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                            {nearbyStreets.map((st, i) => (
                                <button type="button" key={i} onClick={() => handleAddPerimeterStreet(st)} className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all shadow-sm font-bold ${selectedPerimeterStreets.includes(st) ? 'bg-ciclus-600 text-white border-ciclus-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                                    {st}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6"><h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Calculator className="w-4 h-4" /> 3. Totais Acumulados</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner">
                <div className="relative"><label className="block text-xs font-bold text-gray-700 flex justify-between uppercase">Capinação (m)</label><div className="relative mt-1"><input type="number" value={metrics.capinaM} readOnly className="w-full p-3 border border-gray-300 rounded-lg bg-gray-200 font-mono text-xl font-black text-blue-700" /><Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-300" /></div></div>
                <div className="relative"><label className="block text-xs font-bold text-gray-700 flex justify-between uppercase">Roçagem (m²)</label><div className="relative mt-1"><input type="number" value={metrics.rocagemM2} readOnly className="w-full p-3 border border-gray-300 rounded-lg bg-gray-200 font-mono text-xl font-black text-emerald-700" /><Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-300" /></div></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Varrição (m)</label><input type="number" min="0" step="0.1" value={metrics.varricaoM || ''} onChange={e => setMetrics({...metrics, varricaoM: parseFloat(e.target.value) || 0})} className="w-full p-3 border rounded-lg mt-1 font-black text-lg text-gray-800" placeholder="0.0" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Pintura de Vias (m)</label><input type="number" min="0" step="0.1" value={metrics.pinturaViasM || ''} onChange={e => setMetrics({...metrics, pinturaViasM: parseFloat(e.target.value) || 0})} className="w-full p-3 border rounded-lg mt-1 font-black text-lg text-gray-800" placeholder="0.0" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Pintura de Postes (Unid)</label><input type="number" min="0" step="1" value={metrics.pinturaPostesUnd || ''} onChange={e => setMetrics({...metrics, pinturaPostesUnd: parseFloat(e.target.value) || 0})} className="w-full p-3 border rounded-lg mt-1 font-black text-lg text-gray-800" placeholder="0" /></div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6"><div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2"><Users className="w-4 h-4" /> 4. Equipe (Frequência)</h3></div><div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 shadow-sm">{attendance.map((record, idx) => (<div key={record.employeeId} className="flex items-center justify-between p-4 hover:bg-gray-50"><div><p className="font-bold text-gray-800 text-sm">{record.name}</p><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{record.role}</p></div><label className="flex items-center cursor-pointer relative"><input type="checkbox" checked={record.present} onChange={() => { const n = [...attendance]; n[idx].present = !n[idx].present; setAttendance(n); }} className="sr-only peer" /><div className="w-12 h-6.5 bg-gray-200 rounded-full peer peer-checked:bg-ciclus-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:after:translate-x-full shadow-inner"></div></label></div>))}</div></section>
        
        <section className="border-t border-gray-100 pt-6"><h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> 5. Observações do Dia</h3><textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Quebra de maquinários, falta de EPIs ou imprevistos climáticos..." className="w-full rounded-xl border-gray-300 border p-4 h-28 text-sm font-medium focus:ring-2 focus:ring-ciclus-500 outline-none shadow-sm" /></section>
        
        <section className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> 6. Evidência Fotográfica (Antes e Depois)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div onClick={() => photoBeforeInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${photoBefore ? 'border-ciclus-500 bg-ciclus-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                <input ref={photoBeforeInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 'before')} />
                {photoBefore ? (
                    <div className="relative w-full flex flex-col items-center">
                        <span className="absolute top-0 left-0 bg-gray-800 text-white text-[9px] px-2 py-0.5 rounded-br font-bold uppercase z-10">Antes</span>
                        <img src={photoBefore} alt="Antes" className="max-h-48 rounded-lg shadow-md object-contain" />
                        <p className="text-[10px] text-ciclus-700 font-black mt-2 uppercase tracking-tight">Alterar Foto Antes</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white p-3 rounded-full shadow-sm mb-2"><Camera className="w-6 h-6 text-gray-400" /></div>
                        <p className="text-xs text-gray-700 font-black uppercase">FOTO DE ANTES</p>
                    </>
                )}
            </div>

            <div onClick={() => photoAfterInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${photoAfter ? 'border-ciclus-500 bg-ciclus-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                <input ref={photoAfterInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 'after')} />
                {photoAfter ? (
                    <div className="relative w-full flex flex-col items-center">
                        <span className="absolute top-0 left-0 bg-ciclus-600 text-white text-[9px] px-2 py-0.5 rounded-br font-bold uppercase z-10">Depois</span>
                        <img src={photoAfter} alt="Depois" className="max-h-48 rounded-lg shadow-md object-contain" />
                        <p className="text-[10px] text-ciclus-700 font-black mt-2 uppercase tracking-tight">Alterar Foto Depois</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white p-3 rounded-full shadow-sm mb-2"><ImageIcon className="w-6 h-6 text-gray-400" /></div>
                        <p className="text-xs text-gray-700 font-black uppercase">FOTO DE DEPOIS</p>
                    </>
                )}
            </div>
          </div>
        </section>
        
        <div className="flex gap-4 pt-6 sticky bottom-0 bg-white p-5 border-t mt-8 -mx-6 -mb-6 z-50 shadow-[0_-10px_25px_rgba(0,0,0,0.1)] rounded-t-2xl">
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 py-4.5 rounded-xl font-black hover:bg-gray-200 transition-all uppercase text-xs tracking-widest active:scale-95">Cancelar</button>
            <button type="submit" disabled={isSaving} className="flex-[2] bg-ciclus-600 text-white py-4.5 rounded-xl font-black shadow-xl flex justify-center items-center gap-3 disabled:opacity-50 hover:bg-ciclus-700 active:scale-95 transition-all uppercase text-xs tracking-widest">
                {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} 
                {isSaving ? 'Gravando...' : 'Finalizar RD'}
            </button>
        </div>
      </form>
    </div>
  );
};
