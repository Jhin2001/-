
import React, { useState, useEffect, useRef } from 'react';
import DisplayScreen from './components/DisplayScreen';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import DeviceManager from './components/DeviceManager';
import SystemSettings from './components/SystemSettings';
import PatientQuery from './components/PatientQuery';
import ConfigPanel from './components/ConfigPanel';
import Dashboard from './components/Dashboard';
import AuditLogViewer from './components/AuditLogViewer';
import RuleSettings from './components/RuleSettings';
import { QueueConfig, DeviceBinding, Preset, GlobalSystemSettings, Patient, ZoneConfig } from './types';
import { DEFAULT_CONFIG, DEFAULT_GLOBAL_SETTINGS, DEFAULT_DEVICES } from './constants';
import api from './services/api';
import { Layout, Monitor, Search, BarChart3, FileText, GitBranch, Settings } from 'lucide-react';
import { ToastProvider } from './components/ToastProvider';

// Helper to check if the current configuration is purely static
const isConfigStatic = (layout: QueueConfig['layout']): boolean => {
  const zones: ZoneConfig[] = [layout.topLeft, layout.topRight, layout.bottomLeft, layout.bottomRight];
  const dynamicTypes = ['waiting-list', 'current-call', 'window-info', 'passed-list'];
  const hasDynamic = zones.some(z => z.type !== 'hidden' && dynamicTypes.includes(z.type));
  return !hasDynamic;
};

// Define Route Modes
type AppMode = 'landing' | 'admin' | 'tv';

const App: React.FC = () => {
  // --- 1. Routing State Initialization ---
  const [appMode, setAppMode] = useState<AppMode>(() => {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'tv') return 'tv';
      if (m === 'admin') return 'admin';
      return 'landing'; // Default to landing page for security
  });

  // Derived state for existing logic compatibility
  const isTvMode = appMode === 'tv';

  const [config, setConfig] = useState<QueueConfig>(DEFAULT_CONFIG);
  
  const [globalSettings, setGlobalSettings] = useState<GlobalSystemSettings>(() => {
      // Check for reset flag in URL to clear localStorage cache
      const params = new URLSearchParams(window.location.search);
      if (params.get('resetConfig') === 'true') {
          console.log("Configuration reset triggered by URL parameter.");
          localStorage.removeItem('pqms_settings');
          window.history.replaceState({}, document.title, window.location.pathname);
          return DEFAULT_GLOBAL_SETTINGS;
      }

      const saved = localStorage.getItem('pqms_settings');
      if (saved) {
          try {
              return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) };
          } catch (e) {
              console.error("Failed to parse saved settings", e);
          }
      }
      return DEFAULT_GLOBAL_SETTINGS;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dataVersion, setDataVersion] = useState('');
  
  const [devices, setDevices] = useState<DeviceBinding[]>(DEFAULT_DEVICES);
  const [presets, setPresets] = useState<Preset[]>([]);

  // Navigation State - Default to Dashboard
  const [activeTab, setActiveTab] = useState<'dashboard'|'design'|'devices'|'settings'|'query'|'logs'|'rules'>('dashboard');

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
               if (typeof preset.config === 'string') {
                   try { newConfig = JSON.parse(preset.config as any); } catch(e) {}
               } else {
                   newConfig = preset.config;
               }
          }
          newConfig.system = {
              ...newConfig.system,
              deviceId: devId,
              deviceIp: device.ipAddress,
              deviceMac: device.macAddress,
              isRegistered: true
          };
          if (device.assignedWindowNumber) newConfig.windowNumber = device.assignedWindowNumber;
          if (device.assignedWindowName) newConfig.windowName = device.assignedWindowName;
          setConfig(newConfig);
      } else {
          setConfig(prev => ({
             ...prev,
             system: { ...prev.system, deviceId: devId, isRegistered: false }
          }));
      }
  };

  useEffect(() => {
    api.system.health().then(() => setIsConnected(true)).catch(() => setIsConnected(false));
    
    const savedDevices = localStorage.getItem('pharmacy-queue-devices');
    const loadedDevices: DeviceBinding[] = savedDevices ? JSON.parse(savedDevices) : DEFAULT_DEVICES;
    const savedPresets = localStorage.getItem('pharmacy-queue-presets');
    const loadedPresets: Preset[] = savedPresets ? JSON.parse(savedPresets) : [];

    const params = new URLSearchParams(window.location.search);
    
    // Logic dependent on mode
    if (appMode === 'tv') {
       // TV Mode Init
       setIsLoggedIn(true); // TV implicitly trusted for view-only
       const devId = params.get('deviceId');
       if (devId) {
          api.device.getConfig(devId)
            .then(remoteConfig => {
                setConfig({
                    ...remoteConfig,
                    system: {
                        ...remoteConfig.system,
                        deviceId: devId,
                        isRegistered: remoteConfig.system?.isRegistered ?? true 
                    }
                });
            })
            .catch(e => {
                initTvModeLocalFallback(devId, loadedDevices, loadedPresets);
            });
       } else {
          setConfig(prev => ({
             ...prev,
             system: { ...prev.system, deviceId: 'Unknown', isRegistered: false }
          }));
       }
    } else if (appMode === 'admin') {
        // Admin Mode Init
        setConfig(prev => ({
            ...prev,
            system: { ...prev.system, deviceId: 'AdminConsole', isRegistered: true }
        }));
    }
  }, [appMode]); // Re-run if mode changes

  useEffect(() => {
    // Only poll if we are in a mode that needs data
    const shouldPoll = isTvMode || (appMode === 'admin' && isLoggedIn);
    if (!shouldPoll) return;

    const intervalSeconds = Math.max(config.dataSource?.pollingInterval || 5, 1);
    const pollData = async () => {
      try {
        if (!isConnected) {
             try { await api.system.health(); setIsConnected(true); } catch(e) { setIsConnected(false); return; }
        }
        
        const isStatic = isConfigStatic(config.layout);
        const deviceId = config.system.deviceId;

        // If in TV mode and config is static, poll for config changes instead of data
        if (isStatic && isTvMode && deviceId && deviceId !== 'Unknown') {
            try {
                const remoteConfig = await api.device.getConfig(deviceId);
                // Simple deep compare check to avoid re-renders if same
                if (!isConfigStatic(remoteConfig.layout) || JSON.stringify(remoteConfig.layout) !== JSON.stringify(config.layout)) {
                     setConfig(prev => ({ ...remoteConfig, system: { ...prev.system, ...remoteConfig.system } }));
                }
            } catch (e) {}
        } else {
            // Normal Data Polling
            const windowFilter = config.speech?.broadcastMode === 'local' ? config.windowNumber : undefined;
            const snapshot = await api.queue.getSnapshot(windowFilter);
            setIsConnected(true); 

            if (snapshot.version !== dataVersion) {
                setConfig(prev => ({
                   ...prev,
                   currentPatient: snapshot.currentPatient || { id: '', name: '', number: '' } as Patient,
                   waitingList: snapshot.waitingList || [],
                   passedList: snapshot.passedList || [],
                }));
                setDataVersion(snapshot.version);
            }
        }
      } catch (err) {
         if ((err as Error).message?.includes('Failed to fetch')) setIsConnected(false);
      }
    };

    pollData();
    const effectiveInterval = isConfigStatic(config.layout) ? 10 : intervalSeconds;
    const timer = setInterval(pollData, effectiveInterval * 1000);
    return () => clearInterval(timer);
  }, [appMode, isLoggedIn, isTvMode, config.dataSource?.pollingInterval, config.layout, config.windowNumber, config.speech?.broadcastMode, dataVersion, isConnected, config.system.deviceId]);

  useEffect(() => {
      if (isConnected) {
          api.admin.getSystemSettings().then(remoteSettings => {
                 setGlobalSettings(prev => ({ ...remoteSettings, apiBaseUrl: prev.apiBaseUrl }));
          }).catch(e => {});
      }
  }, [isConnected]);

  // --- Render Logic Based on Mode ---

  // 1. Landing Page (Default)
  if (appMode === 'landing') {
      return (
          <LandingPage 
            systemName={globalSettings.systemName}
            onEnterAdmin={() => {
                window.history.pushState({}, '', '?mode=admin');
                setAppMode('admin');
            }}
            onEnterTv={() => {
                window.history.pushState({}, '', '?mode=tv');
                setAppMode('tv');
            }}
          />
      );
  }

  // 2. TV Display Mode
  if (isTvMode) {
      return <DisplayScreen config={config} />;
  }
  
  // 3. Admin Mode - Login Gate
  if (!isLoggedIn) {
     return <LoginPage settings={globalSettings} onLogin={() => setIsLoggedIn(true)} />;
  }

  // 4. Admin Mode - Dashboard
  return (
    <ToastProvider>
      <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
          <div className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
              <div 
                className="p-4 border-b border-gray-800 flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => {
                    // Back to Landing Page option
                    if (window.confirm('返回首页 (Landing Page)?')) {
                        setIsLoggedIn(false);
                        window.history.pushState({}, '', '/');
                        setAppMode('landing');
                    }
                }}
              >
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold">Q</div>
                  <div className="font-bold text-lg">Queue Admin</div>
              </div>
              
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                  <button 
                      onClick={() => setActiveTab('dashboard')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                  >
                      <BarChart3 size={20} />
                      <span>数据概览 (Dashboard)</span>
                  </button>
                  
                  <div className="pt-4 pb-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">运营操作</div>
                  
                  <button 
                      onClick={() => setActiveTab('query')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'query' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                  >
                      <Search size={20} />
                      <span>队列操作</span>
                  </button>
                  <button 
                      onClick={() => setActiveTab('logs')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                  >
                      <FileText size={20} />
                      <span>日志审计</span>
                  </button>

                  <div className="pt-4 pb-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">系统配置</div>

                  <button 
                      onClick={() => setActiveTab('design')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'design' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                  >
                      <Layout size={20} />
                      <span>大屏预案设计</span>
                  </button>
                  <button 
                      onClick={() => setActiveTab('rules')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'rules' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                  >
                      <GitBranch size={20} />
                      <span>分诊规则配置</span>
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
                      <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-500"}`}></div>
                      {isConnected ? "API Connected" : "Local Mode"}
                  </div>
                  v1.1.0
              </div>
          </div>

          <div className="flex-1 overflow-auto relative">
              {activeTab === 'dashboard' && <Dashboard isConnected={isConnected} />}
              {activeTab === 'design' && <ConfigPanel config={config} onUpdateConfig={setConfig} isConnected={isConnected} />}
              {activeTab === 'devices' && <DeviceManager devices={devices} presets={presets} onUpdateDevices={setDevices} isConnected={isConnected} />}
              {activeTab === 'settings' && <SystemSettings settings={globalSettings} onUpdate={setGlobalSettings} isConnected={isConnected} />}
              {activeTab === 'query' && <PatientQuery config={config} onUpdateConfig={setConfig} isConnected={isConnected} />}
              {activeTab === 'logs' && <AuditLogViewer />}
              {activeTab === 'rules' && <RuleSettings />}
          </div>
      </div>
    </ToastProvider>
  );
};

export default App;
