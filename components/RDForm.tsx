
import React, { useState, useEffect, useRef } from 'react';
import { ServiceCategory, RDData, RDStatus, AttendanceRecord, GeoLocation, User, ProductionMetrics, Employee, Base, Shift, UserRole, TrackSegment } from '../types';
import { getEmployees, getUsers } from '../services/storageService';
import { MapPin, Users, Save, RefreshCw, CheckCircle, Camera, AlertTriangle, FileText, Clock, Map, Search, ChevronDown, Navigation, ArrowRightLeft, CornerDownRight, UserCheck, Calendar, RotateCcw, Lock, Play, Square, Timer, Ruler, Image as ImageIcon, MapPinned, Plus, Trash2, Calculator, Loader2 } from 'lucide-react';

interface RDFormProps {
  currentUser: User;
  onSave: (data: RDData) => Promise<void>; // Make async
  onCancel: () => void;
  existingData?: RDData; // For editing/resubmitting
}

// Helper to get local date string YYYY-MM-DD correctly
const getLocalDateString = (dateObj?: Date) => {
  const d = dateObj || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper for local time HH:mm
const getLocalTimeString = (dateObj?: Date) => {
    const d = dateObj || new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
};

// Haversine Formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Explicit ordered list for widths
const WIDTH_OPTIONS = [
    { value: '1', label: 'Beira de Calçada' },
    { value: '1.5', label: 'Canteiro Central' },
    { value: '2', label: 'Lateral de Pista' },
    { value: '3', label: 'Terreno Aberto' }
];

export const RDForm: React.FC<RDFormProps> = ({ currentUser, onSave, onCancel, existingData }) => {
  // --- State ---
  const [rdDate, setRdDate] = useState<string>(
    existingData?.date ? existingData.date.split('T')[0] : getLocalDateString()
  );
  const [rdTime, setRdTime] = useState<string>(
    existingData?.date 
        ? new Date(existingData.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) 
        : getLocalTimeString()
  );

  const [base, setBase] = useState<Base>(existingData?.base || Base.NORTE);
  const [shift, setShift] = useState<Shift>(existingData?.shift || Shift.DIURNO);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>(
    existingData?.serviceCategory || ServiceCategory.MUTIRAO
  );
  
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>(existingData?.supervisorId || '');
  const [availableSupervisors, setAvailableSupervisors] = useState<User[]>([]);

  const [street, setStreet] = useState(existingData?.street || '');
  const [neighborhood, setNeighborhood] = useState(existingData?.neighborhood || '');
  const [perimeter, setPerimeter] = useState(existingData?.perimeter || '');
  
  const [nearbyStreets, setNearbyStreets] = useState<string[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [selectedPerimeterStreets, setSelectedPerimeterStreets] = useState<string[]>([]);

  const [metrics, setMetrics] = useState<ProductionMetrics>(existingData?.metrics || {
    capinaM: 0,
    pinturaViasM: 0,
    pinturaPostesUnd: 0,
    rocagemM2: 0,
    varricaoM: 0
  });

  const [observations, setObservations] = useState(existingData?.observations || '');

  // --- LOCATION & TRACKING STATE (NEW SEGMENT LOGIC) ---
  const [segments, setSegments] = useState<TrackSegment[]>(existingData?.segments || []);
  
  // Active Tracking Session State
  const [activeSegmentType, setActiveSegmentType] = useState<'CAPINA' | 'ROCAGEM' | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackStartTime, setTrackStartTime] = useState<number | null>(null);
  const [currentStartLocation, setCurrentStartLocation] = useState<GeoLocation | undefined>(undefined);
  const [currentTrackPoints, setCurrentTrackPoints] = useState<{lat: number, lng: number}[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Pending Finalization (For Rocagem Width Input)
  const [pendingSegment, setPendingSegment] = useState<Partial<TrackSegment> | null>(null);
  const [rocagemWidth, setRocagemWidth] = useState<string>(''); // String for input handling

  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(existingData?.teamAttendance || []);
  const [workPhoto, setWorkPhoto] = useState<string>(existingData?.workPhotoUrl || '');
  
  const workPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadInitialData = async () => {
        if (currentUser.role === UserRole.SUPERVISOR) {
            setSelectedSupervisorId(currentUser.id);
        } else {
            const allUsers = await getUsers();
            const sups = allUsers.filter(u => u.role === UserRole.SUPERVISOR);
            setAvailableSupervisors(sups);
        }

        if (existingData) return;

        const allEmployees = await getEmployees();
        let myTeam = allEmployees.filter(e => e.supervisorId === currentUser.id);
        if (myTeam.length === 0) myTeam = allEmployees;

        const initialAttendance: AttendanceRecord[] = myTeam.map(e => ({
            employeeId: e.id,
            name: e.name,
            registration: e.registration,
            role: e.role,
            present: true
        }));
        setAttendance(initialAttendance);
    };
    loadInitialData();
  }, [currentUser, existingData]);

  // Auto-Calculate Metrics from Segments
  useEffect(() => {
    const totalCapina = segments
        .filter(s => s.type === 'CAPINA')
        .reduce((sum, s) => sum + s.calculatedValue, 0);
    
    const totalRocagem = segments
        .filter(s => s.type === 'ROCAGEM')
        .reduce((sum, s) => sum + s.calculatedValue, 0);

    setMetrics(prev => ({
        ...prev,
        capinaM: parseFloat(totalCapina.toFixed(1)),
        rocagemM2: parseFloat(totalRocagem.toFixed(1))
    }));

    // Auto-fill address from the first segment if empty
    if (segments.length > 0 && !street) {
        const first = segments[0];
        if (first.startLocation.addressFromGPS) {
             const parts = first.startLocation.addressFromGPS.split(',');
             if (parts.length > 0) setStreet(parts[0]);
        }
        fetchNearbyStreets(segments[0].startLocation.lat, segments[0].startLocation.lng, '');
    }

  }, [segments]);

  useEffect(() => {
      return () => {
          if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
  }, []);

  // --- Handlers ---

  const fetchNearbyStreets = async (lat: number, lng: number, currentStreetName: string) => {
    if (!lat || !lng) return;
    setIsLoadingNearby(true);
    setNearbyStreets([]);
    try {
        const query = `
            [out:json][timeout:25];
            (
              way["highway"]["name"](around:500,${lat},${lng});
            );
            out tags;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const names = new Set<string>();
            data.elements.forEach((el: any) => {
                if (el.tags && el.tags.name) {
                     const t = el.tags.highway;
                     if (t !== 'motorway' && t !== 'trunk') {
                         names.add(el.tags.name);
                     }
                }
            });
            const currentNorm = currentStreetName ? currentStreetName.toLowerCase().trim() : '';
            const sorted = Array.from(names)
                .filter(n => {
                    const nameLower = n.toLowerCase();
                    return !currentNorm || !nameLower.includes(currentNorm);
                })
                .sort();
            setNearbyStreets(sorted.slice(0, 30));
        }
    } catch (e) {
        console.warn("Overpass API error", e);
    } finally {
        setIsLoadingNearby(false);
    }
  };

  const fetchAddressReverse = async (lat: number, lng: number): Promise<{street: string, hood: string, full: string} | null> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const foundStreet = addr.road || addr.street || addr.pedestrian || addr.path || addr.living_street || addr.residential || addr.highway || '';
                const foundHood = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.district || addr.hamlet || addr.village || addr.town || addr.city || '';
                if (foundStreet || foundHood) return { street: foundStreet, hood: foundHood, full: data.display_name };
            }
        }
    } catch (e) { console.warn("Nominatim failed", e); }
    return null;
  };

  // --- Start Segment (Point A) ---
  const handleStartSegment = (type: 'CAPINA' | 'ROCAGEM') => {
      if (!('geolocation' in navigator)) { alert('GPS não suportado.'); return; }

      setIsLoadingLoc(true);
      setActiveSegmentType(type);

      // 1. Capture Point A
      navigator.geolocation.getCurrentPosition(async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          setGpsAccuracy(accuracy);

          // Address Point A logic
          let addressDisplay = "GPS Capturado";
          try {
              const result = await fetchAddressReverse(lat, lng);
              if (result) {
                  addressDisplay = result.full || "Localização identificada";
                  // If global address is empty, set it
                  if (!street) {
                      setStreet(result.street);
                      setNeighborhood(result.hood);
                      fetchNearbyStreets(lat, lng, result.street);
                  }
              }
          } catch (e) { console.error(e); }

          // Start Logic
          const startLoc = { lat, lng, accuracy, timestamp: position.timestamp, addressFromGPS: addressDisplay };
          setCurrentStartLocation(startLoc);
          setTrackStartTime(Date.now());
          setIsTracking(true);
          setCurrentTrackPoints([{lat, lng}]);
          setCurrentDistance(0);
          setElapsedTime(0);
          setIsLoadingLoc(false);

          // Timer
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = setInterval(() => {
              setElapsedTime(prev => prev + 1);
          }, 1000);

          // Watch Position (Odometer)
          if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                  const newLat = pos.coords.latitude;
                  const newLng = pos.coords.longitude;
                  setCurrentTrackPoints(prev => {
                      const lastPoint = prev[prev.length - 1];
                      const dist = calculateDistance(lastPoint.lat, lastPoint.lng, newLat, newLng);
                      if (dist > 5) { // Filter noise
                          setCurrentDistance(d => d + dist);
                          return [...prev, {lat: newLat, lng: newLng}];
                      }
                      return prev;
                  });
              },
              (err) => console.warn("Watch Error", err),
              { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
          );

      }, (err) => {
          alert("Erro ao capturar GPS inicial: " + err.message);
          setIsLoadingLoc(false);
          setActiveSegmentType(null);
      }, { enableHighAccuracy: true, timeout: 20000 });
  };

  // --- Stop Segment (Point B) ---
  const handleStopSegment = () => {
      setIsLoadingLoc(true);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
      }
      
      // Capture Point B
      navigator.geolocation.getCurrentPosition(async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          
          let addressDisplay = "GPS Capturado";
          try {
              const result = await fetchAddressReverse(lat, lng);
              if (result) addressDisplay = result.full;
          } catch(e) {}

          const endLoc = { lat, lng, accuracy, timestamp: position.timestamp, addressFromGPS: addressDisplay };
          
          const tempSegment: Partial<TrackSegment> = {
              id: `seg-${Date.now()}`,
              type: activeSegmentType!,
              startedAt: new Date(trackStartTime!).toISOString(),
              endedAt: new Date().toISOString(),
              startLocation: currentStartLocation,
              endLocation: endLoc,
              distance: currentDistance,
              pathPoints: currentTrackPoints
          };

          setIsTracking(false);
          setIsLoadingLoc(false);
          
          // Determine next step based on type
          if (activeSegmentType === 'ROCAGEM') {
              setPendingSegment(tempSegment); // Needs Width Input
              setRocagemWidth('');
          } else {
              // Capina - Save Immediately
              const finalSeg = { ...tempSegment, calculatedValue: tempSegment.distance! } as TrackSegment;
              setSegments(prev => [...prev, finalSeg]);
              setActiveSegmentType(null);
              setPendingSegment(null);
          }

      }, (err) => {
          alert("Erro ao capturar GPS final: " + err.message);
          setIsTracking(false);
          setIsLoadingLoc(false);
          setActiveSegmentType(null);
      }, { enableHighAccuracy: true, timeout: 15000 });
  };

  const confirmRocagemSegment = () => {
      const w = parseFloat(rocagemWidth.replace(',', '.'));
      if (!w || w <= 0) {
          alert("Informe a largura do corte válida.");
          return;
      }
      
      const area = (pendingSegment!.distance || 0) * w;
      
      const finalSeg = { 
          ...pendingSegment, 
          width: w,
          calculatedValue: area 
      } as TrackSegment;

      setSegments(prev => [...prev, finalSeg]);
      setPendingSegment(null);
      setActiveSegmentType(null);
  };

  const removeSegment = (id: string) => {
      if(confirm("Remover este trecho?")) {
          setSegments(prev => prev.filter(s => s.id !== id));
      }
  };

  const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const handleAddPerimeterStreet = (streetName: string) => {
    let newSelection = [...selectedPerimeterStreets];
    if (newSelection.includes(streetName)) {
        newSelection = newSelection.filter(s => s !== streetName);
    } else {
        newSelection.push(streetName);
    }
    if (newSelection.length > 2) {
        newSelection = [streetName];
        setPerimeter(`Esquina com ${streetName}`);
    } else if (newSelection.length === 2) {
        setPerimeter(`Entre ${newSelection[0]} e ${newSelection[1]}`);
    } else if (newSelection.length === 1) {
        setPerimeter(`Esquina com ${newSelection[0]}`);
    } else {
        setPerimeter('');
    }
    setSelectedPerimeterStreets(newSelection);
  };

  const handleCorrectionClick = (streetName: string) => {
      setStreet(streetName);
      if (currentStartLocation) fetchNearbyStreets(currentStartLocation.lat, currentStartLocation.lng, streetName);
  };

  const handleManualRefreshPerimeter = () => {
      if (segments.length > 0) fetchNearbyStreets(segments[0].startLocation.lat, segments[0].startLocation.lng, street);
  };

  const handleWorkPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setWorkPhoto(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const togglePresence = (index: number) => {
    const newAttendance = [...attendance];
    newAttendance[index].present = !newAttendance[index].present;
    setAttendance(newAttendance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervisorId) {
        alert("Erro: Supervisor Responsável não identificado.");
        return;
    }
    if (segments.length === 0 && !existingData) {
       if (!confirm("Nenhum trecho de GPS capturado. Deseja continuar apenas com dados manuais?")) return;
    }
    
    const totalProduction = metrics.capinaM + metrics.pinturaViasM + metrics.pinturaPostesUnd + metrics.rocagemM2 + (metrics.varricaoM || 0);
    if (totalProduction <= 0 && observations.trim() === '') {
      alert("Insira a quantidade produzida ou uma observação.");
      return;
    }

    setIsSaving(true);
    const combinedDateStr = `${rdDate}T${rdTime}:00`;
    const finalDate = new Date(combinedDateStr);
    
    const rdToSave: RDData = {
      id: existingData?.id || ``, // Backend will assign ID for new ones
      date: finalDate.toISOString(),
      foremanId: currentUser.id,
      foremanName: currentUser.name,
      foremanRegistration: currentUser.registration,
      supervisorId: selectedSupervisorId,
      status: RDStatus.PENDING,
      base,
      shift,
      serviceCategory,
      street,
      neighborhood,
      perimeter,
      metrics,
      location: segments.length > 0 ? segments[0].startLocation : undefined, 
      segments: segments,
      teamAttendance: attendance,
      workPhotoUrl: workPhoto,
      observations,
      createdAt: Date.now()
    };
    await onSave(rdToSave);
    setIsSaving(false);
  };

  const renderMetricInputs = () => {
    return (
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <p>Os campos de <strong>Capinação</strong> e <strong>Roçagem</strong> são preenchidos automaticamente pelo GPS.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            {/* Capinação - READ ONLY */}
            <div className="relative">
                <label className="block text-xs font-bold text-gray-700 flex justify-between">
                    Capinação e Raspagem (m)
                    <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">AUTO GPS</span>
                </label>
                <div className="relative mt-1">
                    <input type="number" value={metrics.capinaM} readOnly className="w-full p-2 border border-gray-300 rounded bg-gray-100 font-mono text-lg font-bold text-gray-600 cursor-not-allowed" />
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Soma dos trechos de Capinação</p>
            </div>
            
            {/* Roçagem - READ ONLY */}
            <div className="relative">
                <label className="block text-xs font-bold text-gray-700 flex justify-between">
                    Roçagem (m²)
                    <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">AUTO GPS</span>
                </label>
                <div className="relative mt-1">
                    <input type="number" value={metrics.rocagemM2} readOnly className="w-full p-2 border border-gray-300 rounded bg-gray-100 font-mono text-lg font-bold text-gray-600 cursor-not-allowed" />
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Soma (Distância x Largura)</p>
            </div>
            
            {/* Manual Fields */}
            <div>
                <label className="block text-xs font-medium text-gray-600">Varrição (m)</label>
                <input type="number" min="0" step="0.1" value={metrics.varricaoM || ''} onChange={e => setMetrics({...metrics, varricaoM: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded mt-1 font-mono text-lg focus:ring-2 focus:ring-ciclus-500 outline-none" placeholder="0.0" />
            </div>
            
            <div>
                <label className="block text-xs font-medium text-gray-600">Pintura de Vias (m)</label>
                <input type="number" min="0" step="0.1" value={metrics.pinturaViasM || ''} onChange={e => setMetrics({...metrics, pinturaViasM: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded mt-1 font-mono text-lg focus:ring-2 focus:ring-ciclus-500 outline-none" placeholder="0.0" />
            </div>
            
            <div>
                <label className="block text-xs font-medium text-gray-600">Pintura de Postes (Unid)</label>
                <input type="number" min="0" step="1" value={metrics.pinturaPostesUnd || ''} onChange={e => setMetrics({...metrics, pinturaPostesUnd: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded mt-1 font-mono text-lg focus:ring-2 focus:ring-ciclus-500 outline-none" placeholder="0" />
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-10">
      <div className="bg-ciclus-700 p-4 text-white flex justify-between items-center sticky top-0 z-10">
        <h2 className="text-lg font-bold">{existingData ? 'Corrigir RD' : 'Novo Relatório Diário'}</h2>
        <span className="text-xs bg-ciclus-800 px-2 py-1 rounded font-mono">{currentUser.name} (Mat: {currentUser.registration})</span>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        
        {currentUser.role !== UserRole.SUPERVISOR && (
            <section className="bg-yellow-50 p-4 rounded border border-yellow-200">
                <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Supervisor Responsável</label>
                <select required value={selectedSupervisorId} onChange={e => setSelectedSupervisorId(e.target.value)} className="w-full p-2 border border-yellow-300 rounded bg-white text-gray-700">
                    <option value="">Selecione o Supervisor...</option>
                    {availableSupervisors.map(s => <option key={s.id} value={s.id}>{s.name} (Mat: {s.registration})</option>)}
                </select>
            </section>
        )}

        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> 1. Dados Operacionais</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div><label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Data</label><input type="date" required value={rdDate} onChange={e => setRdDate(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-md font-bold text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-ciclus-500 outline-none" /></div>
             <div><label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Horário</label><input type="time" required value={rdTime} onChange={e => setRdTime(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-md font-bold text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-ciclus-500 outline-none" /></div>
             <div><label className="block text-xs font-medium text-gray-600 mb-1">Base Operacional</label><select value={base} onChange={e => setBase(e.target.value as Base)} className="w-full p-2 text-sm border border-gray-300 rounded-md">{Object.values(Base).map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
             <div><label className="block text-xs font-medium text-gray-600 mb-1">Turno</label><select value={shift} onChange={e => setShift(e.target.value as Shift)} className="w-full p-2 text-sm border border-gray-300 rounded-md">{Object.values(Shift).map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2"><MapPin className="w-4 h-4" /> 2. Rastreamento de Trechos (GPS)</h3>
            {gpsAccuracy && <span className={`text-[10px] ${gpsAccuracy > 50 ? 'text-red-500 font-bold' : 'text-green-600'}`}>Precisão: {gpsAccuracy.toFixed(0)}m {gpsAccuracy > 50 && "(Fraco)"}</span>}
          </div>

          {/* --- NEW TRACKING INTERFACE --- */}
          <div className="space-y-4">
              
              {/* STATUS: IDLE -> Show Buttons */}
              {!isTracking && !pendingSegment && (
                  <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => handleStartSegment('CAPINA')} disabled={isLoadingLoc} className="bg-ciclus-600 hover:bg-ciclus-700 text-white py-4 rounded-lg font-bold shadow-lg flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                           {isLoadingLoc ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                           <span className="text-xs sm:text-sm">INICIAR CAPINAÇÃO</span>
                      </button>
                      <button type="button" onClick={() => handleStartSegment('ROCAGEM')} disabled={isLoadingLoc} className="bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-lg font-bold shadow-lg flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                           {isLoadingLoc ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                           <span className="text-xs sm:text-sm">INICIAR ROÇAGEM</span>
                      </button>
                  </div>
              )}

              {/* STATUS: TRACKING -> Show Metrics and Stop Button */}
              {isTracking && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in fade-in">
                       <div className="flex justify-between items-center mb-4">
                           <span className="text-xs font-bold uppercase bg-blue-200 text-blue-800 px-2 py-1 rounded animate-pulse">
                               Em Andamento: {activeSegmentType}
                           </span>
                           <span className="font-mono text-xl font-bold text-gray-700">{formatTime(elapsedTime)}</span>
                       </div>
                       
                       <div className="text-center mb-6">
                           <p className="text-gray-500 text-xs uppercase mb-1">Distância Percorrida</p>
                           <p className="text-4xl font-bold text-blue-700">{currentDistance.toFixed(0)} <span className="text-lg text-gray-400">metros</span></p>
                       </div>

                       <button type="button" onClick={handleStopSegment} disabled={isLoadingLoc} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2">
                           {isLoadingLoc ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
                           FINALIZAR TRECHO
                       </button>
                  </div>
              )}

              {/* STATUS: PENDING WIDTH (Rocagem) -> Input Width */}
              {pendingSegment && activeSegmentType === 'ROCAGEM' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 animate-in fade-in">
                      <h4 className="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-2"><Ruler className="w-4 h-4" /> Cálculo de Área (Roçagem)</h4>
                      <p className="text-xs text-gray-600 mb-4">O trecho teve <strong>{pendingSegment.distance?.toFixed(0)} metros</strong>. Informe a largura média do corte para calcular a área.</p>
                      
                      <div className="mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Selecione a largura aproximada:</label>
                        <div className="grid grid-cols-2 gap-2">
                           {WIDTH_OPTIONS.map((opt) => (
                               <button 
                                 key={opt.value} 
                                 type="button" 
                                 onClick={() => setRocagemWidth(opt.value)}
                                 className={`py-3 px-3 rounded border text-left transition-colors flex flex-col justify-center ${rocagemWidth === opt.value ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                               >
                                 <span className="font-bold text-lg">{opt.value}m</span>
                                 <span className={`text-[10px] uppercase font-medium ${rocagemWidth === opt.value ? 'text-emerald-100' : 'text-gray-400'}`}>{opt.label}</span>
                               </button>
                           ))}
                        </div>
                      </div>

                      <div className="flex gap-2 items-end pt-2 border-t border-emerald-100">
                          <div className="flex-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Ou digite (m)</label>
                              <input 
                                type="number" step="0.1" autoFocus
                                value={rocagemWidth} onChange={e => setRocagemWidth(e.target.value)}
                                className="w-full p-2 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold"
                                placeholder="Ex: 2.5"
                              />
                          </div>
                          <button type="button" onClick={confirmRocagemSegment} className="bg-emerald-600 text-white px-4 py-3 rounded font-bold hover:bg-emerald-700">
                              Confirmar e Salvar
                          </button>
                      </div>
                  </div>
              )}

              {/* SEGMENTS LIST */}
              {segments.length > 0 && (
                  <div className="mt-4 border rounded-lg overflow-hidden bg-white">
                      <div className="bg-gray-100 px-3 py-2 border-b flex justify-between items-center">
                          <h4 className="text-xs font-bold text-gray-500 uppercase">Trechos Realizados ({segments.length})</h4>
                          <span className="text-[10px] text-gray-400">Total calculado automaticamente</span>
                      </div>
                      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                          {segments.map((seg) => (
                              <div key={seg.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${seg.type === 'CAPINA' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{seg.type}</span>
                                          <span className="text-xs font-mono text-gray-500">{new Date(seg.startedAt).toLocaleTimeString()} - {new Date(seg.endedAt).toLocaleTimeString()}</span>
                                      </div>
                                      <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[200px]">{seg.startLocation.addressFromGPS}</p>
                                  </div>
                                  <div className="text-right flex items-center gap-3">
                                      <div>
                                          <p className="text-xs font-bold text-gray-700">
                                              {seg.type === 'CAPINA' ? `${seg.calculatedValue.toFixed(0)}m` : `${seg.calculatedValue.toFixed(0)}m²`}
                                          </p>
                                          {seg.type === 'ROCAGEM' && <p className="text-[9px] text-gray-400">{seg.distance.toFixed(0)}m x {seg.width}m</p>}
                                      </div>
                                      <button type="button" onClick={() => removeSegment(seg.id)} className="text-red-400 hover:text-red-600 p-1">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative mt-6">
            <div className="relative md:col-span-2 z-30">
              <label className="block text-xs font-medium text-gray-500 uppercase">Rua / Logradouro (Ponto A)</label>
              <div className="relative">
                <input required type="text" value={street} readOnly placeholder="Capture o GPS para preencher..." className="mt-1 block w-full rounded-md border-gray-200 shadow-sm border p-3 pl-10 bg-gray-100 text-gray-600 cursor-not-allowed font-bold" />
                <div className="absolute left-3 top-3.5 text-gray-400"><Lock className="w-5 h-5" /></div>
              </div>
              
              {nearbyStreets.length > 0 && (
                  <div className="mt-2 animate-in fade-in bg-yellow-50 p-2 rounded border border-yellow-100">
                    <p className="text-[10px] text-yellow-700 mb-1 flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> O GPS errou a rua? Sugestões próximas:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {nearbyStreets.map((st, i) => (
                            <button type="button" key={i} onClick={() => handleCorrectionClick(st)} className="text-[10px] px-2 py-1 rounded border transition-colors shadow-sm bg-white text-gray-600 border-gray-200 hover:bg-yellow-100 hover:text-yellow-800 hover:border-yellow-300">
                                {st}
                            </button>
                        ))}
                    </div>
                  </div>
              )}
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase">Bairro</label>
              <input required type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 bg-gray-50" />
            </div>
            
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase flex justify-between items-center">
                  Perímetro / Referência
                  <button type="button" onClick={handleManualRefreshPerimeter} className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                      <RotateCcw className={`w-3 h-3 ${isLoadingNearby ? 'animate-spin' : ''}`} /> Recarregar
                  </button>
              </label>
              <input type="text" value={perimeter} onChange={e => setPerimeter(e.target.value)} placeholder="Ex: Entre Rua A e Rua B" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
              
              {(nearbyStreets.length > 0) && (
                  <div className="mt-2 animate-in fade-in bg-gray-50 p-2 rounded border border-gray-100">
                      <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-bold"><CornerDownRight className="w-3 h-3" /> Ruas próximas:</p>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                           {nearbyStreets.map((st, i) => (
                               <button type="button" key={i} onClick={() => handleAddPerimeterStreet(st)} className={`text-[10px] px-2 py-1 rounded border transition-colors shadow-sm ${selectedPerimeterStreets.includes(st) ? 'bg-ciclus-600 text-white border-ciclus-600 font-bold' : 'bg-white text-gray-600 border-gray-200 hover:bg-white hover:border-ciclus-300'}`}>
                                 {st}
                               </button>
                           ))}
                      </div>
                  </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">3. Quantitativos de Produção</h3>
          {renderMetricInputs()}
        </section>

        <section className="border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2"><Users className="w-4 h-4" /> 4. Frequência da Equipe</h3>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{attendance.filter(a => a.present).length} / {attendance.length} Presentes</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
             {attendance.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">Nenhum colaborador vinculado a este encarregado no banco de dados.</div> : 
               attendance.map((record, idx) => (
                 <div key={record.employeeId} className="flex items-center justify-between p-3 hover:bg-gray-50">
                    <div><p className="font-medium text-gray-800 text-sm">{record.name} <span className="text-gray-400 font-normal ml-1">(Mat: {record.registration})</span></p><p className="text-[10px] text-gray-400 uppercase">{record.role}</p></div>
                    <label className="flex items-center cursor-pointer relative"><input type="checkbox" checked={record.present} onChange={() => togglePresence(idx)} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ciclus-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ciclus-600"></div></label>
                 </div>
               ))
             }
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> 5. Observações</h3>
          <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ocorrências do dia..." className="w-full rounded-md border-gray-300 shadow-sm border p-3 h-24 text-sm" />
        </section>

        <section className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> 6. Foto do Serviço / Evidência</h3>
            <div onClick={() => workPhotoInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${workPhoto ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                <input ref={workPhotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleWorkPhotoUpload} />
                {workPhoto ? (
                    <div className="relative w-full flex flex-col items-center">
                        <img src={workPhoto} alt="Evidência do Serviço" className="max-h-64 rounded shadow-md object-contain" />
                        <p className="text-xs text-blue-700 mt-2 font-medium bg-white px-2 py-1 rounded shadow-sm">Toque para alterar a foto</p>
                    </div>
                ) : (
                    <>
                        <Camera className="w-10 h-10 text-gray-400 mb-2" /><p className="text-sm text-gray-600 font-medium">Toque para tirar foto do serviço</p><p className="text-[10px] text-gray-400 mt-1">Antes, Depois ou Equipe trabalhando</p>
                    </>
                )}
            </div>
        </section>

        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white p-4 border-t mt-6 -mx-6 -mb-6 z-10">
          <button type="button" onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={isSaving} className="flex-1 bg-ciclus-600 text-white py-3 rounded-lg font-bold hover:bg-ciclus-700 shadow-lg flex justify-center items-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Enviando...' : existingData ? 'Reenviar RD' : 'Enviar RD'}
          </button>
        </div>
      </form>
    </div>
  );
};
