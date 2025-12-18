
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

// Definition of Teams and their cycle duration (Roteiro em dias)
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
  capinaM: number;        // Metros lineares (Auto sum of segments)
  pinturaViasM: number;   // Metros lineares (Manual)
  pinturaPostesUnd: number; // Unidades (Manual)
  rocagemM2: number;      // Metros quadrados (Auto sum of segments * width)
  varricaoM: number;      // Metros lineares (Manual)
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

// New Interface for a Single Segment Track
export interface TrackSegment {
  id: string;
  type: 'CAPINA' | 'ROCAGEM';
  startedAt: string;
  endedAt: string;
  startLocation: GeoLocation;
  endLocation: GeoLocation;
  distance: number; // meters
  width?: number; // Only for Roçagem (meters)
  calculatedValue: number; // m for Capina, m2 for Roçagem
  pathPoints: {lat: number, lng: number}[];
}

// Keep GeoPath for legacy compatibility if needed, but primary logic moves to segments
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
  registration: string; // Matrícula
  role: string; // Cargo (Gari, Ajudante, etc) - Now a string to allow custom roles
  supervisorId?: string; // Link to supervisor/foreman for auto-population
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
  date: string; // ISO date string
  foremanId: string;
  foremanName: string;
  foremanRegistration?: string; // Store snapshot of registration
  supervisorId?: string; // ID of the supervisor responsible
  status: RDStatus;
  
  // Work Details
  base?: Base;
  shift?: Shift;
  team?: string; // Optional legacy field
  serviceCategory: ServiceCategory;
  street: string;
  neighborhood: string;
  perimeter: string;
  
  // New Metrics Structure
  metrics: ProductionMetrics;
  
  // Location & Tracking
  location?: GeoLocation; // Point A (Start) of the FIRST segment (Legacy compat)
  
  // New: Multiple Segments support
  segments: TrackSegment[];
  
  gpsTrack?: GeoPath; // Deprecated, kept for backward compatibility with old records
  
  // Resources
  teamAttendance: AttendanceRecord[];
  
  // Proofs
  workPhotoUrl?: string; // New field: Foto do serviço
  signatureImageUrl?: string; // Base64 image
  observations?: string; // New field for notes/occurrences
  
  // Meta
  createdAt: number;
  supervisorNote?: string;
}

export interface User {
  id: string;
  name: string;
  registration: string; // Used for Login
  password?: string; // Simple password for demo
  role: UserRole;
  team?: string; // Linked team (S10, S01, etc.) for performance tracking
}