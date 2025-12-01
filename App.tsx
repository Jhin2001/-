
import React, { useState, useEffect, useCallback, useRef } from 'react';
import DisplayScreen from './components/DisplayScreen';
import LoginPage from './components/LoginPage';
import DeviceManager from './components/DeviceManager';
import SystemSettings from './components/SystemSettings';
import PatientQuery from './components/PatientQuery';
import ConfigPanel from './components/ConfigPanel';
import { QueueConfig, DeviceBinding, Preset, GlobalSystemSettings, Patient, ZoneConfig } from './types';
import { DEFAULT_CONFIG, DEFAULT_GLOBAL_SETTINGS, DEFAULT_DEVICES } from './constants';
import api from './services/api';
import { Layout, Menu, Activity, Settings, Monitor, Search } from 'lucide-react';

// Helper to check if the current configuration is purely static
const isConfigStatic = (layout: QueueConfig['layout']): boolean => {
  const zones: ZoneConfig[] = [layout.topLeft, layout.topRight, layout.bottomLeft, layout.bottomRight];
  const dynamicTypes = ['waiting-list', 'current-call', 'window-info', 'passed-list'];
  
  // If any visible zone is a dynamic type, it's not static
  const hasDynamic = zones.some(z => z.type !== 'hidden' && dynamicTypes.includes(z.type));
  return !hasDynamic;
};

const App: React.FC = () => {
  const [config, setConfig] = useState<QueueConfig>(DEFAULT_CONFIG);
  const [globalSettings, setGlobalSettings] = useState<GlobalSystemSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [isTvMode, setIsTvMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dataVersion, setDataVersion] = useState('');
  
  // Data for local management
  const [devices, setDevices] = useState<DeviceBinding[]>(DEFAULT_DEVICES);
  const [presets, setPresets] = useState<Preset[]>([]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'design'|'devices'|'settings'|'query'>('design');

  // Keep track of previous config version to detect remote changes
  const prevConfigIdRef = useRef<string>('');

  // Helper for TV Mode Fallback
  const initTvModeLocalFallback = (
    devId: string, 
    loadedDevices: DeviceBinding[], 
    loadedPresets: Preset[]
  ) => {
      const device = loadedDevices.find(d => d.id === devId);
      if (device) {
          const preset = loadedPresets.find(p => p.id === device.linkedPresetId);
          let newConfig = { ...config };
          
          if (preset) {
               // Load preset config
               if (typeof preset.config === 'string') {
                   try { newConfig = JSON.parse(preset.config as any); } catch(e) {}
               } else {
                   newConfig = preset.config;
               }
          }
          
          // Apply Device Specifics
          newConfig.system = {
              ...newConfig.system,
              deviceId: devId,
              deviceIp: device.ipAddress,
              deviceMac: device.macAddress,
              isRegistered: true
          };
          
          // Apply Window Binding
          if (device.assignedWindowNumber) newConfig.windowNumber = device.assignedWindowNumber;
          if (device.assignedWindowName) newConfig.windowName = device.assignedWindowName;

          setConfig(newConfig);
      } else {
          // Unregistered
          setConfig(prev => ({
             ...prev,
             system: { ...prev.system, deviceId: devId, isRegistered: false }
          }));
      }
  };

  useEffect(() => {
    // Check API connection initial status
    api.system.health().then(() => setIsConnected(true)).catch(() => setIsConnected(false));
    
    // Load local data for fallback usage
    const savedDevices = localStorage.getItem('pharmacy-queue-devices');
    const loadedDevices: DeviceBinding[] = savedDevices ? JSON.parse(savedDevices) : DEFAULT_DEVICES;
    
    const savedPresets = localStorage.getItem('pharmacy-queue-presets');
    const loadedPresets: Preset[] = savedPresets ? JSON.parse(savedPresets) : [];

    // --- TV Mode Logic ---
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'tv') {
       setIsTvMode(true);
       setIsLoggedIn(true); // Bypass login for TV
       
       const devId = params.get('deviceId');
       
       if (devId) {
          // Priority 1: Try to fetch config from API (Real Backend)
          api.device.getConfig(devId)
            .then(remoteConfig => {
                console.log("[App] Loaded TV config from API:", remoteConfig);
                
                // FIX: Do NOT force isRegistered: true. Respect backend response.
                // The backend should return isRegistered: false if device is not bound.
                setConfig({
                    ...remoteConfig,
                    system: {
                        ...remoteConfig.system,
                        deviceId: devId,
                        // If backend config is partial, ensure we don't lose the ID
                        // Use remote isRegistered if present, otherwise default to true ONLY if we got a valid config
                        isRegistered: remoteConfig.system?.isRegistered ?? true 
                    }
                });
            })
            .catch(e => {
                console.warn("[App] Failed to load TV config from API, falling back to local simulation", e);
                // Priority 2: Fallback to Local Storage Logic
                initTvModeLocalFallback(devId, loadedDevices, loadedPresets);
            });
       } else {
          // No Device ID provided -> Show Unregistered
          setConfig(prev => ({
             ...prev,
             system: {
                ...prev.system,
                deviceId: 'Unknown',
                isRegistered: false
             }
          }));
       }
    } else {
        // FIX: If in Admin/Designer mode (not TV), force registration to TRUE.
        // This ensures the "Unregistered" screen doesn't block the designer view.
        setConfig(prev => ({
            ...prev,
            system: {
                ...prev.system,
                deviceId: 'AdminConsole',
                isRegistered: true 
            }
        }));
    }

  }, []);

  // --- Real Data Polling Hook ---
  useEffect(() => {
    const shouldPoll = isTvMode || isLoggedIn;
    
    if (!shouldPoll) {
       // Reset if not polling
       return;
    }

    const intervalSeconds = Math.max(config.dataSource?.pollingInterval || 5, 1);

    const pollData = async () => {
      try {
        // 1. Connection Check (Optional optimization: skip if recently checked)
        if (!isConnected) {
             try {
                await api.system.health();
                setIsConnected(true);
             } catch(e) {
                setIsConnected(false);
                return; // Stop processing if offline
             }
        }

        // --- SMART POLLING STRATEGY ---
        const isStatic = isConfigStatic(config.layout);
        const deviceId = config.system.deviceId;

        if (isStatic && isTvMode && deviceId && deviceId !== 'Unknown') {
            // STRATEGY A: Static Content -> Poll Config Only (Lightweight)
            // We check if the server has a new configuration for us.
            try {
                const remoteConfig = await api.device.getConfig(deviceId);
                
                // Simple check: Has the config version changed? or simply deeper comparison
                // Here we assume remoteConfig always returns full object.
                // In a real app, you might compare a version hash.
                
                // For this demo, we can just check if the layout type changed from static to dynamic
                // or compare a timestamp if available.
                // Let's brute-force update if we suspect change, or rely on a version ID.
                
                // If the new config is NOT static, we update local state.
                // This triggers a re-render, and the next poll loop will enter Strategy B.
                if (!isConfigStatic(remoteConfig.layout)) {
                     console.log("[SmartPoll] Detected layout change to Dynamic. Switching mode.");
                     setConfig(prev => ({
                         ...remoteConfig,
                         system: { ...prev.system, ...remoteConfig.system } // Preserve local system ID
                     }));
                } else {
                    // It is still static, but maybe the text content changed?
                    // We can do a stringify compare or check a version field
                    if (JSON.stringify(remoteConfig.layout) !== JSON.stringify(config.layout)) {
                        console.log("[SmartPoll] Static content updated.");
                        setConfig(prev => ({
                            ...remoteConfig,
                            system: { ...prev.system, ...remoteConfig.system }
                        }));
                    }
                }
            } catch (e) {
                console.warn("[SmartPoll] Failed to check config update", e);
            }

        } else {
            // STRATEGY B: Dynamic Content -> Poll Queue Data (Heavy)
            // 2. Fetch Business Data
            const windowFilter = config.speech?.broadcastMode === 'local' ? config.windowNumber : undefined;
            const snapshot = await api.queue.getSnapshot(windowFilter);
            
            setIsConnected(true); 

            // Data Version Check
            if (snapshot.version !== dataVersion) {
                setConfig(prev => ({
                   ...prev,
                   currentPatient: snapshot.currentPatient || { id: '', name: '', number: '' } as Patient,
                   waitingList: snapshot.waitingList || [],
                   passedList: snapshot.passedList || [],
                }));
                setDataVersion(snapshot.version);
            }

            // Optional: If getSnapshot returned a special "configChanged" flag, we could also fetch config here.
        }

      } catch (err) {
         console.warn("Polling failed", err);
         if ((err as Error).message?.includes('Failed to fetch')) {
             setIsConnected(false);
         }
      }
    };

    // Execute immediately
    pollData();

    // Schedule
    // If static, we can poll slower to save resources (e.g. 10s), otherwise use config interval
    const effectiveInterval = isConfigStatic(config.layout) ? 10 : intervalSeconds;
    const timer = setInterval(pollData, effectiveInterval * 1000);
    
    return () => clearInterval(timer);
  }, [isTvMode, isLoggedIn, config.dataSource?.pollingInterval, config.layout, config.windowNumber, config.speech?.broadcastMode, dataVersion, isConnected, config.system.deviceId]);

  // --- Sync System Settings from API when Connected ---
  useEffect(() => {
      if (isConnected) {
          api.admin.getSystemSettings()
             .then(remoteSettings => {
                 setGlobalSettings(prev => ({
                     ...remoteSettings,
                     apiBaseUrl: prev.apiBaseUrl 
                 }));
             })
             .catch(e => {
                const msg = e.message || '';
                if (msg.includes('404') || msg.includes('Failed to fetch')) {
                    console.warn("Could not sync system settings from API (Using local defaults):", msg);
                } else {
                    console.error("Failed to fetch system settings from API", e);
                }
             });
      }
  }, [isConnected]);

  if (isTvMode) {
      return <DisplayScreen config={config} />;
  }

  if (!isLoggedIn) {
      return <LoginPage settings={globalSettings} onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold">Q</div>
                <div className="font-bold text-lg">Queue Admin</div>
            </div>
            
            <nav className="flex-1 p-2 space-y-1">
                <button 
                    onClick={() => setActiveTab('design')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'design' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                    <Layout size={20} />
                    <span>排队预案设计</span>
                </button>
                <button 
                    onClick={() => setActiveTab('query')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'query' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                    <Search size={20} />
                    <span>队列查询与操作</span>
                </button>
                <button 
                    onClick={() => setActiveTab('devices')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'devices' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                    <Monitor size={20} />
                    <span>终端设备管理</span>
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                    <Settings size={20} />
                    <span>系统全局设置</span>
                </button>
            </nav>

            <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
                <div className="flex items-center gap-2 mb-2">
                    <Activity size={12} className={isConnected ? "text-green-500" : "text-gray-500"} />
                    {isConnected ? "API Connected" : "Local Mode"}
                </div>
                v1.0.0
            </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 overflow-auto relative">
            {activeTab === 'design' && (
                <ConfigPanel 
                    config={config} 
                    onUpdateConfig={setConfig} 
                    isConnected={isConnected} 
                />
            )}
            {activeTab === 'devices' && (
                <DeviceManager 
                    devices={devices} 
                    presets={presets} 
                    onUpdateDevices={setDevices} 
                    isConnected={isConnected} 
                />
            )}
            {activeTab === 'settings' && (
                <SystemSettings 
                    settings={globalSettings} 
                    onUpdate={setGlobalSettings} 
                    isConnected={isConnected} 
                />
            )}
            {activeTab === 'query' && (
                <PatientQuery 
                    config={config} 
                    onUpdateConfig={setConfig} 
                    isConnected={isConnected} 
                />
            )}
        </div>
    </div>
  );
};

export default App;
