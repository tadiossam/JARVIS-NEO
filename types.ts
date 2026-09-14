
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
  FUNCTION = 'function'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  image?: string;
  fileData?: string; 
  fileType?: string; 
  fileName?: string;
  groundingMetadata?: any; 
  citations?: { id: string; source: string; text: string }[];
  modelUsed?: string;
  isFallback?: boolean;
}

export interface User {
  name: string;
  email: string;
  avatar: string;
  authProvider?: 'google' | 'passcode';
  idToken?: string;
  accessToken?: string;
  authenticatedAt?: string;
  googleSub?: string;
  verifiedEmail?: boolean;
}

export interface SystemStat {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export enum AppMode {
  IDLE = 'IDLE',
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  SETTINGS = 'SETTINGS',
  CHESS = 'CHESS',
  FILES = 'FILES',
  NOTEBOOK = 'NOTEBOOK'
}

export type ProjectorType = 'BROWSER' | 'ANALYSIS' | 'CODE' | 'IMAGE' | 'CAMERA_FEED' | 'YOUTUBE' | 'MEASURE' | 'WHITEBOARD' | 'REPORT';

export interface ProjectorData {
  id: string; 
  type: ProjectorType;
  content: string; 
  title?: string;
  zIndex?: number;
  position?: { x: number, y: number };
}

export interface KnowledgeSource {
  id: string;
  name: string;
  description: string;
  endpoint: string; 
  authKey?: string; 
  method: 'GET' | 'POST';
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  type: 'code' | 'text' | 'json' | 'log' | 'source';
  language?: string; 
  timestamp: string;
  tags: string[];
}

export interface FileSystemActions {
  createFile: (name: string, content: string, type: ProjectFile['type'], tags?: string[]) => Promise<string>;
  readFile: (name: string) => Promise<ProjectFile | null>;
  listFiles: (tag?: string) => Promise<ProjectFile[]>;
  deleteFile: (id: string) => void;
  updateFile: (id: string, content: string) => void;
}

export interface IntegrationConfig {
  knowledgeBaseIp: string;
  openAiApiKey: string;
  mellatechUrl: string;
  dynamicsUrl: string;
  dynamicsToken: string;
  gmailUser: string;
  develonId: string;
  develonToken: string;
  sis2goKey: string;
  sis2goUrl: string;
  hueBridgeIp: string;
  hueUsername: string;
  switchBotToken: string;
  switchBotSecret: string;
  smartThingsToken: string; 
  augustApiKey: string;
  lgThinQToken: string;
  unifiControllerUrl: string;
  unifiUser: string;
  unifiPass: string;
}

export interface Alert {
  id: string;
  source: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  icon?: any;
}

export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string; 
  read: boolean;
  folder: 'inbox' | 'sent' | 'drafts';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; 
  end: string; 
  attendees: string[];
  description?: string;
}

export interface WorkspaceActions {
  sendEmail: (to: string, subject: string, body: string) => Promise<{ status: string; id: string }>;
  checkEmails: (query?: string) => Promise<Email[]>;
  scheduleEvent: (title: string, time: string, attendees?: string) => Promise<{ status: string; event: CalendarEvent }>;
  checkCalendar: (date?: string) => Promise<CalendarEvent[]>;
}

export type DeviceType = 'LIGHT' | 'THERMOSTAT' | 'CAMERA' | 'LOCK' | 'TV' | 'WASHER' | 'FRIDGE' | 'BOT' | 'SWITCH' | 'NETWORK';

export interface SmartDevice {
  id: string;
  name: string;
  type: DeviceType;
  brand: 'NEST' | 'REOLINK' | 'HUE' | 'AUGUST' | 'SAMSUNG' | 'LG' | 'SWITCHBOT' | 'GENERIC' | 'UBIQUITI' | 'CISCO' | 'SYNOLOGY' | 'BROWSER_API' | 'CUSTOM_API';
  status: 'on' | 'off' | 'idle' | 'recording' | 'locked' | 'unlocked' | 'online' | 'offline' | 'running' | 'playing';
  value?: string | number;
  color?: string;
  location?: string;
  ip?: string;
  mac?: string;
  latency?: number;
  upload?: string;
  download?: string;
  frequency?: string; 
  channel?: number;
  controlUrl?: string; 
  method?: 'GET' | 'POST' | 'PUT';
  authHeader?: string; 
  payloadTemplate?: string; 
}

export interface SmartHomeActions {
  setDeviceState: (id: string, state: string, value?: any) => Promise<string>;
  getDevices: () => SmartDevice[];
  getCameraStream: (id: string) => string;
  addDevice: (device: SmartDevice) => void;
  removeDevice: (id: string) => void;
}

export interface SavedGame {
  id: string;
  name: string;
  date: string;
  fen: string;
  pgn: string;
}
