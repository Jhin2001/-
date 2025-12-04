
import React, { useState, useEffect, useRef } from 'react';
import DisplayScreen from './components/DisplayScreen';
import LoginPage from './components/LoginPage';
import DeviceManager from './components/DeviceManager';
import SystemSettings from './components/SystemSettings';
import PatientQuery from './components/PatientQuery';
import ConfigPanel from './components/ConfigPanel';
import Dashboard from './components/Dashboard';
import AuditLogViewer from './components/AuditLogViewer';
import RuleSettings from './components/RuleSettings';
import ErrorBoundary from './components/ErrorBoundary';
import { QueueConfig, DeviceBinding, Preset, GlobalSystemSettings, Patient, ZoneConfig } from './types';
import { DEFAULT_CONFIG, DEFAULT_GLOBAL_SETTINGS, DEFAULT_DEVICES } from './constants';
import api from './services/api';
import { Layout, Monitor, Search, BarChart3, FileText, GitBranch, Settings, LogOut } from 'lucide-react';
import { ToastProvider } from './components/ToastProvider';

const isConfigStatic = (layout: QueueConfig['layout']): boolean => {
  if (!layout) return false;
  const zones: ZoneConfig[] = [layout.topLeft, layout.topRight, layout.bottomLeft, layout.bottomRight];
  const dynamicTypes = ['waiting-list', 'current-call', 'window-info', 'passed-list'];
  const hasDynamic = zones.some(z => z && z.type !== 'hidden' && dynamicTypes.includes(z.type));
  return !hasDynamic;
};

type AppMode = 'admin' | 'tv';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(() => {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'tv') return 'tv';
      return 'admin';
  });

  const isTvMode = appMode === 'tv';
  const [config, setConfig] = useState<QueueConfig>(DEFAULT_CONFIG);
  const [globalSettings, setGlobalSettings] = useState<GlobalSystemSettings>(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('resetConfig') === 'true') {
          try { localStorage.removeItem('pqms_settings'); } catch(e) {}
          window.history.replaceState({}, document.title, window.location.pathname);
          return DEFAULT_GLOBAL_SETTINGS;
      }
      try {
        const saved = localStorage.getItem('pqms_settings');
        if (saved) return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {}
      return DEFAULT_GLOBAL_SETTINGS;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dataVersion, setDataVersion] = useState('');
  
  const [devices, setDevices] = useState<DeviceBinding[]>(DEFAULT_DEVICES);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard'|'design'|'devices'|'settings'|'query'|'logs'|'rules'>('dashboard');

  // Throttle for config version checking inside the main loop
  const lastConfigCheckRef = useRef<number>(0);

  useEffect(() => {
    const sendHandshake = () => {
        try {
            const payload = { action: 'PQMS_LOADED' };
            window.parent.postMessage({ data: payload }, '*');
            // @ts-ignore
            if (window.uni && window.uni.postMessage) {
                // @ts-ignore
                window.uni.postMessage({ data: payload });
            }
        } catch(e) {}
    };
    sendHandshake();
    let count = 0;
    const timer = setInterval(() => {
        sendHandshake();
        count++;
        if (count > 10) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      const deviceId = config.system?.deviceId;
      if (!isTvMode || !deviceId || deviceId === 'Unknown') return;
      
      const sendHeartbeat = () => {
          api.device.heartbeat(deviceId, 'online', {
              version: config.configVersion,
              url: window.location.href,
              userAgent: navigator.userAgent
          })
          .catch(e => {
              if (e.code === 404 || e.code === 400) {
                  setConfig(prev => {
                      if (prev.system?.isRegistered === false) return prev;
                      return { ...prev, system: { ...prev.system, isRegistered: false } };
                  });
              }
          });
      };
      sendHeartbeat();
      const timer = setInterval(sendHeartbeat, 30000);
      return () => clearInterval(timer);
  }, [isTvMode, config.system?.deviceId, config.configVersion, config.system?.isRegistered]);

  const initTvModeLocalFallback = (devId: string, loadedDevices: DeviceBinding[], loadedPresets: Preset[]) => {
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
          setConfig(prev => ({ ...prev, system: { ...prev.system, deviceId: devId, isRegistered: false } }));
      }
  };

  useEffect(() => {
    api.system.health().then(() => setIsConnected(true)).catch(() => setIsConnected(false));
    
    let loadedDevices: DeviceBinding[] = DEFAULT_DEVICES;
    let loadedPresets: Preset[] = [];

    try {
        const savedDevices = localStorage.getItem('pharmacy-queue-devices');
        if (savedDevices) loadedDevices = JSON.parse(savedDevices);
        const savedPresetsStr = localStorage.getItem('pharmacy-queue-presets');
        if (savedPresetsStr) loadedPresets = JSON.parse(savedPresetsStr);
    } catch (e) {}

    setDevices(loadedDevices);
    setPresets(loadedPresets);

    const params = new URLSearchParams(window.location.search);
    
    if (appMode === 'tv') {
       setIsLoggedIn(true);
       const devId = params.get('deviceId');
       if (devId) {
          api.device.getConfig(devId)
            .then(remoteConfig => {
                setConfig(prev => ({
                    ...prev, ...remoteConfig,
                    system: { ...prev.system, ...(remoteConfig.system || {}), deviceId: devId, isRegistered: remoteConfig.system?.isRegistered ?? true }
                }));
            })
            .catch(e => {
                if (e.code === 400 || e.code === 404) {
                    setConfig(prev => ({ ...prev, system: { ...prev.system, deviceId: devId, isRegistered: false } }));
                } else {
                    initTvModeLocalFallback(devId, loadedDevices, loadedPresets);
                }
            });
       } else {
          setConfig(prev => ({ ...prev, system: { ...prev.system, deviceId: 'Unknown', isRegistered: false } }));
       }
    } else {
        setConfig(prev => ({ ...prev, system: { ...prev.system, deviceId: 'AdminConsole', isRegistered: true } }));
    }
  }, [appMode]);

  useEffect(() => {
    const shouldPoll = isTvMode || (appMode === 'admin' && isLoggedIn);
    if (!shouldPoll) return;

    const intervalSeconds = Math.max(config.dataSource?.pollingInterval || 5, 1);
    const pollData = async () => {
      try {
        if (!isConnected) {
             try { await api.system.health(); setIsConnected(true); } catch(e) { setIsConnected(false); return; }
        }
        
        const isStatic = config.layout ? isConfigStatic(config.layout) : false;
        const deviceId = config.system?.deviceId;
        const isUnregistered = !config.system?.isRegistered;

        // Condition A: Low-Frequency Polling (Config Only)
        if ((isStatic || isUnregistered) && isTvMode && deviceId && deviceId !== 'Unknown') {
            try {
                const remoteConfig = await api.device.getConfig(deviceId);
                const regChanged = remoteConfig.system?.isRegistered !== config.system?.isRegistered;
                const remoteLayoutStr = JSON.stringify(remoteConfig.layout || {});
                const localLayoutStr = JSON.stringify(config.layout || {});

                if (regChanged || !isConfigStatic(remoteConfig.layout) || remoteLayoutStr !== localLayoutStr) {
                     setConfig(prev => ({ ...prev, ...remoteConfig, system: { ...prev.system, ...(remoteConfig.system || {}) } }));
                }
            } catch (e) {}
        } 
        // Condition B: High-Frequency Polling (Data Snapshot + Throttled Config Check)
        else {
            const windowFilter = config.speech?.broadcastMode === 'local' ? config.windowNumber : undefined;
            const snapshot = await api.queue.getSnapshot(windowFilter, config.system?.deviceId);
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

            // HOT RELOAD CHECK:
            // Even when polling queue data, we must occasionally check if the layout config has changed.
            // We check every 10 seconds.
            const now = Date.now();
            // CHANGE: Added isTvMode check. Admin console should NOT hot reload config/layout.
            if (isTvMode && deviceId && deviceId !== 'Unknown' && now - lastConfigCheckRef.current > 10000) {
                try {
                    const remoteConfig = await api.device.getConfig(deviceId);
                    // Compare version or registration status
                    if (remoteConfig.configVersion !== config.configVersion || remoteConfig.system?.isRegistered !== config.system?.isRegistered) {
                        console.log("Hot Reload: Config version changed, updating layout...");
                        setConfig(prev => ({
                            ...prev, 
                            ...remoteConfig, 
                            system: { ...prev.system, ...(remoteConfig.system || {}) },
                            // Keep current data to avoid flicker until next snapshot
                            currentPatient: prev.currentPatient,
                            waitingList: prev.waitingList,
                            passedList: prev.passedList
                        }));
                    }
                    lastConfigCheckRef.current = now;
                } catch(e) {}
            }
        }
      } catch (err) {
         if ((err as Error).message?.includes('Failed to fetch')) setIsConnected(false);
      }
    };

    pollData();
    const isStaticSafe = config.layout ? isConfigStatic(config.layout) : false;
    const effectiveInterval = isStaticSafe ? 10 : intervalSeconds;
    const timer = setInterval(pollData, effectiveInterval * 1000);
    return () => clearInterval(timer);
  }, [appMode, isLoggedIn, isTvMode, config.dataSource?.pollingInterval, config.layout, config.windowNumber, config.speech?.broadcastMode, dataVersion, isConnected, config.system?.deviceId, config.system?.isRegistered, config.configVersion]);

  useEffect(() => {
      if (isConnected) {
          api.admin.getSystemSettings().then(remoteSettings => {
                 setGlobalSettings(prev => ({ ...remoteSettings, apiBaseUrl: prev.apiBaseUrl }));
          }).catch(e => {});
      }
  }, [isConnected]);

  const renderContent = () => {
      if (isTvMode) return <DisplayScreen config={config} />;
      if (!isLoggedIn) return <LoginPage settings={globalSettings} onLogin={() => setIsLoggedIn(true)} />;

      return (
        <ToastProvider>
          <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
              <div className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
                  <div className="p-4 border-b border-gray-800 flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors"
                    onClick={() => { if (window.confirm('确定要退出登录吗?')) setIsLoggedIn(false); }}>
                      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold">Q</div>
                      <div className="font-bold text-lg">Queue Admin</div>
                      <LogOut size={16} className="ml-auto text-gray-500 hover:text-white" />
                  </div>
                  <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                      <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <BarChart3 size={20} /><span>数据概览 (Dashboard)</span>
                      </button>
                      <div className="pt-4 pb-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">运营操作</div>
                      <button onClick={() => setActiveTab('query')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'query' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <Search size={20} /><span>队列操作</span>
                      </button>
                      <button onClick={() => setActiveTab('logs')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <FileText size={20} /><span>日志审计</span>
                      </button>
                      <div className="pt-4 pb-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">系统配置</div>
                      <button onClick={() => setActiveTab('design')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'design' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <Layout size={20} /><span>大屏预案设计</span>
                      </button>
                      <button onClick={() => setActiveTab('rules')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'rules' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <GitBranch size={20} /><span>分诊规则配置</span>
                      </button>
                      <button onClick={() => setActiveTab('devices')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'devices' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <Monitor size={20} /><span>终端设备管理</span>
                      </button>
                      <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                          <Settings size={20} /><span>系统全局设置</span>
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

  return <ErrorBoundary>{renderContent()}</ErrorBoundary>;
};

export default App;
