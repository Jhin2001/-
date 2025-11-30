
export interface Patient {
  id: string;
  name: string;
  number: string;
  windowName?: string; // Specific window name for centralized calling
  windowNumber?: string; // Specific window number for local binding
  callTimestamp?: number; // To identify unique call events (e.g. recall)
  checkInTime?: number; // When the patient was registered/checked in
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  textOnPrimary: string;
  background: string;
}

// Available types of content for any zone
export type ContentType = 'window-info' | 'current-call' | 'waiting-list' | 'passed-list' | 'static-text' | 'hidden';

export type QueueNumberStyle = 'circle' | 'rounded' | 'square' | 'none';

export type PassedDisplayMode = 'zone' | 'footer' | 'wait-list-end';

export interface ZoneConfig {
  type: ContentType;
  title?: string; // Override default title
  titleColor?: string;
  titleFontSize?: number;
  
  // List Specific Config
  gridColumns?: number; // 1, 2, 3, 4
  gridRows?: number; // Limits the number of items shown (Cols * Rows)
  contentFontSize?: number; // For patient names in list
  includeCurrent?: boolean; // New: If true, shows current calling patient at top of waiting list
  highlightCurrent?: boolean; // New: If true, applies special styling to the included current patient
  
  // Static Text Specific
  staticTextContent?: string; // For rich text/static notices
  staticTextSize?: number;
  staticBgColor?: string;
  staticTextColor?: string;

  // Window Info Specific
  showWindowNumber?: boolean; // Toggle visibility of the number circle
  windowNumberFontSize?: number;
  windowNameFontSize?: number;
  windowSubTitleHtml?: string; // Rich text for "Please wait..."
  
  // Current Call Specific
  showCurrentTitle?: boolean; // Toggle visibility of "Now Calling"
  currentTitleText?: string; // Custom text for "Now Calling"
  currentTitleFontSize?: number; // "Now Calling" size
  currentNameFontSize?: number;
  currentNumberFontSize?: number;
}

export interface HeaderConfig {
  show: boolean;
  height: number;
  // Logo
  logoType: 'default' | 'image' | 'hidden';
  logoUrl?: string;
  // Main Title
  hospitalName: string;
  hospitalNameSize: number;
  hospitalNameColor?: string; // Optional override
  // Sub/Center Title
  centerTitle: string;
  centerTitleSize: number;
  showCenterTitle: boolean;
  // Right Section
  rightContentType: 'time' | 'text' | 'hidden';
  rightTextContent: string;
  timeFormat: 'HH:mm:ss' | 'HH:mm' | 'YYYY-MM-DD HH:mm:ss';
}

export interface LayoutConfig {
  orientation: 'landscape' | 'portrait'; // New: Screen Orientation
  // Global padding/spacing
  gap: number;
  containerPadding: number;
  
  // Ratios (0-100)
  splitRatio: number; // Width of Left Column % (Landscape) or Height of Top Section % (Portrait)
  leftSplitRatio: number; // Height of Top-Left %
  rightSplitRatio: number; // Height of Top-Right %

  // Zone Definitions
  topLeft: ZoneConfig;
  bottomLeft: ZoneConfig;
  topRight: ZoneConfig;
  bottomRight: ZoneConfig;

  // Footer
  footerShow: boolean;
  footerText: string; // Supports HTML
  footerHeight: number;
  footerScroll: boolean; // Marquee effect
  footerSpeed: number; // Seconds for full scroll
}

export type DatabaseType = 'mysql' | 'sqlserver' | 'oracle' | 'postgresql';

export interface DataSourceConfig {
  mode: 'push' | 'pull'; // Push via API or Pull from DB View
  
  // Polling Strategy
  pollingStrategy: 'realtime' | 'smart'; // New: 'smart' disables DB polling if content is static
  
  // Pull Mode Config
  dbType: DatabaseType;
  dbConnectionString: string;
  tableName: string; // View or Table name
  
  // Field Mapping (DB Column Name -> System Field)
  fieldMap: {
    id: string;      // Unique Key
    name: string;    // Patient Name
    number: string;  // Queue Number (A001)
    status: string;  // Status Column
    windowId: string;// Filter by Window ID
    order: string;   // Sort by time
  };

  // Value Mapping (DB Value -> System State)
  statusMap: {
    waitingValue: string; // e.g. "0" or "WAIT"
    calledValue: string;  // e.g. "1" or "CALL"
    passedValue: string;  // e.g. "2" or "PASS"
  };

  pollingInterval: number; // Seconds
}

export interface SystemConfig {
  apiBaseUrl: string;
  deviceMac: string; // For binding
  deviceIp: string;
  deviceId: string; // Unique ID
  isRegistered: boolean; // Simulation: Is this device bound to a window on server?
}

export interface SpeechConfig {
  enabled: boolean;
  broadcastMode: 'all' | 'local'; // 'all' = Centralized (Broadcast everything), 'local' = Only broadcast if window matches
  template: string; // "请 {number}号 {name} 到 {window} 取药"
  volume: number; // 0-1
  rate: number; // 0.1-10
  pitch: number; // 0-2
}

export interface QueueConfig {
  // Versioning for Hot Reload
  configVersion: string;

  // Legacy specific config (Global Fallbacks)
  windowNumber: string;
  windowName: string;
  windowNumberSize: number; // Deprecated in favor of ZoneConfig, kept for compat
  windowNameSize: number; // Deprecated in favor of ZoneConfig, kept for compat
  
  // General Visuals
  showQueueNumber: boolean;
  queueNumberStyle: QueueNumberStyle; // Shape of the number badge
  
  // Passed Patient Display Logic
  passedDisplayMode: PassedDisplayMode;
  grayOutPassed: boolean; // Only applies if passedDisplayMode is 'wait-list-end'

  // Data
  currentPatient: Patient;
  waitingList: Patient[];
  passedList: Patient[];

  // Styles
  theme: ThemeColors;
  cardRounded: number;
  
  // New Structures
  header: HeaderConfig;
  layout: LayoutConfig;
  
  // System & Data
  system: SystemConfig;
  dataSource: DataSourceConfig;
  speech: SpeechConfig;
}

export interface Preset {
  id: string;
  name: string;
  timestamp: number;
  config: QueueConfig;
}

// --- Distributed System Types ---

export interface DeviceBinding {
  id: string;
  name: string; // Friendly name (e.g. Hallway TV 1)
  ipAddress: string;
  macAddress: string;
  
  // Configuration
  assignedWindowNumber: string;
  assignedWindowName: string; // The specific name for this window (e.g. 麻精专窗)
  linkedPresetId: string; // Which layout style to use
  
  status: 'online' | 'offline' | 'unregistered';
  lastSeen: number;
}

export interface GlobalSystemSettings {
  // Login Screen Config
  loginTitle: string;
  loginSubtitle: string;
  loginBackgroundImage: string; // URL
  adminPassword: string; // Default 123456
  
  // System Global
  apiPort: number;
  systemName: string;
}

export const PRESET_THEMES = {
  purple: {
    primary: '#7c3aed',
    secondary: '#db2777',
    textOnPrimary: '#ffffff',
    background: '#f3f4f6'
  },
  blue: {
    primary: '#2563eb',
    secondary: '#f59e0b',
    textOnPrimary: '#ffffff',
    background: '#eff6ff'
  },
  green: {
    primary: '#059669',
    secondary: '#ea580c',
    textOnPrimary: '#ffffff',
    background: '#ecfdf5'
  },
  dark: {
    primary: '#1f2937',
    secondary: '#dc2626',
    textOnPrimary: '#ffffff',
    background: '#111827'
  }
};
