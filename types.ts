
export enum ServiceCategory {
  CAPINACAO_GRUPO = 'Capinação e Raspagem (Grupo)',
  ROCAGEM = 'Roçagem',
  MUTIRAO = 'Mutirão (Geral)',
  VARRICAO = 'Varrição'
}

export enum Base {
  NORTE = 'Norte - Providência',
  SUL = 'Sul - Vileta'
}

export enum Shift {
  DIURNO = 'Diurno',
  NOTURNO = 'Noturno'
}

export interface TeamConfig {
  name: string;
  days: number;
}

export const TEAMS: TeamConfig[] = [
  { name: 'S10', days: 42 },
  { name: 'S01', days: 28 },
  { name: 'S08', days: 35 },
  { name: 'S04', days: 28 },
  { name: 'S07', days: 35 },
  { name: 'S16', days: 35 },
  { name: 'S17', days: 42 },
  { name: 'S11', days: 42 },
  { name: 'S19', days: 42 },
  { name: 'S15', days: 28 },
  { name: 'S03', days: 28 },
  { name: 'S05', days: 28 },
  { name: 'S14', days: 42 },
  { name: 'S02', days: 28 },
  { name: 'S06', days: 28 },
  { name: 'S09', days: 35 },
  { name: 'S12', days: 42 },
  { name: 'S18', days: 35 },
];

export interface ProductionMetrics {
  capinaM: number;        
  pinturaViasM: number;   
  pinturaPostesUnd: number; 
  rocagemM2: number;      
  varricaoM: number;      
}

export enum RDStatus {
  PENDING = 'Pendente',
  APPROVED = 'Aprovado',
  REJECTED = 'Recusado'
}

export enum UserRole {
  ENCARREGADO = 'Encarregado',
  SUPERVISOR = 'Supervisor',
  CCO = 'CCO (Admin)'
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
  addressFromGPS?: string; 
}

export interface TrackSegment {
  id: string;
  type: 'CAPINAÇÃO' | 'ROCAGEM';
  startedAt: string;
  endedAt: string;
  startLocation: GeoLocation;
  endLocation: GeoLocation;
  street: string; // Endereço capturado no fim do trecho
  neighborhood: string; // Bairro capturado no fim do trecho
  distance: number; 
  width?: number; 
  calculatedValue: number; 
  pathPoints: {lat: number, lng: number}[];
}

export interface GeoPath {
  startedAt: string; 
  endedAt?: string; 
  startLocation: GeoLocation;
  endLocation?: GeoLocation;
  totalDistanceMeters: number;
  durationSeconds: number;
  points: {lat: number, lng: number}[]; 
}

export interface Employee {
  id: string;
  name: string;
  registration: string; 
  role: string; 
  supervisorId?: string; 
}

export interface AttendanceRecord {
  employeeId: string;
  name: string;
  registration: string;
  role: string;
  present: boolean;
}

export interface RDData {
  id: string;
  date: string; 
  foremanId: string;
  foremanName: string;
  foremanRegistration?: string; 
  supervisorId?: string; 
  status: RDStatus;
  base?: Base;
  shift?: Shift;
  team?: string; 
  serviceCategory: ServiceCategory;
  street: string;
  neighborhood: string;
  perimeter: string;
  metrics: ProductionMetrics;
  location?: GeoLocation; 
  segments: TrackSegment[];
  gpsTrack?: GeoPath; 
  teamAttendance: AttendanceRecord[];
  workPhotoUrl?: string; // Mantido por compatibilidade
  photoBeforeUrl?: string; // Novo: Foto de Antes
  photoAfterUrl?: string; // Novo: Foto de Depois
  signatureImageUrl?: string; 
  observations?: string; 
  createdAt: number;
  supervisorNote?: string;
}

export interface User {
  id: string;
  name: string;
  registration: string; 
  password?: string; 
  role: UserRole;
  team?: string; 
}
