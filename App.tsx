import React, { useState, useEffect, useRef } from 'react';
import DisplayScreen from './components/DisplayScreen';
import ConfigPanel from './components/ConfigPanel';
import LoginPage from './components/LoginPage';
import DeviceManager from './components/DeviceManager';
import SystemSettings from './components/SystemSettings';
import PatientQuery from './components/PatientQuery';
import { DEFAULT_CONFIG, DEFAULT_GLOBAL_SETTINGS, DEFAULT_DEVICES } from './constants';
import { QueueConfig, GlobalSystemSettings, DeviceBinding, Preset, Patient } from './types';
import { MonitorPlay, Layout, Settings, LogOut, Monitor, Menu, Mic, RotateCcw, ArrowRight, Search, CloudOff, CloudLightning, WifiOff } from 'lucide-react';
import api from './services/api';

type View = 'dashboard' | 'devices' | 'settings' | 'designer' | 'query';

const App: React.FC = () => {
  // --- Auth State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);
  
  // --- Data State ---
  const [globalSettings, setGlobalSettings] = useState<GlobalSystemSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [devices, setDevices] = useState<DeviceBinding[]>(DEFAULT_DEVICES);
  const [config, setConfig] = useState<QueueConfig>(DEFAULT_CONFIG); // Active config
  const [presets, setPresets] = useState<Preset[]>([]); 
  
  // Data Polling State
  const [dataVersion, setDataVersion] = useState<string>('init');
  const [isPolling, setIsPolling] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline' | 'init'>('init');
  const [lastPollTime, setLastPollTime] = useState(Date.now());

  // --- UI State ---
  const [currentView, setCurrentView] = useState<View>('devices');

  // Load Persisted Data on Mount
  useEffect(() => {
    // 1. Auth Status
    const auth = localStorage.getItem('pqms_auth');
    if (auth === 'true') setIsLoggedIn(true);

    // 2. Global Settings
    const savedSettings = localStorage.getItem('pqms_settings');
    if (savedSettings) setGlobalSettings(JSON.parse(savedSettings));

    // 3. Devices
    let loadedDevices = DEFAULT_DEVICES;
    const savedDevices = localStorage.getItem('pqms_devices');
    if (savedDevices) {
      loadedDevices = JSON.parse(savedDevices);
      setDevices(loadedDevices);
    }

    // 4. Load Presets & Check TV Mode
    const savedPresets = localStorage.getItem('pharmacy-queue-presets');
    let loadedPresets: Preset[] = [];
    
    if (savedPresets) {
      loadedPresets = JSON.parse(savedPresets);
      setPresets(loadedPresets);
    } else {
      const defaultPreset: Preset = { id: 'default', name: '默认样式', timestamp: Date.now(), config: DEFAULT_CONFIG };
      loadedPresets = [defaultPreset];
      setPresets([defaultPreset]);
      localStorage.setItem('pharmacy-queue-presets', JSON.stringify([defaultPreset]));
    }

    // --- TV Mode Logic ---
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'tv') {
       setIsTvMode(true);
       setIsLoggedIn(true); // Bypass login for TV
       
       const devId = params.get('deviceId');
       if (devId) {
          // Find Device Config
          const device = loadedDevices.find(d => d.id === devId || d.name === devId);
          if (device && device.linkedPresetId) {
             const preset = loadedPresets.find(p => p.id === device.linkedPresetId);
             if (preset) {
                // Merge device specific overrides (like Window No) into the preset config
                const mergedConfig = {
                  ...preset.config,
                  windowNumber: device.assignedWindowNumber || preset.config.windowNumber,
                  windowName: device.assignedWindowName || preset.config.windowName,
                  system: {
                     ...preset.config.system,
                     deviceId: device.id,
                     deviceIp: device.ipAddress || '',
                     deviceMac: device.macAddress || '',
                     isRegistered: true
                  }
                };
                setConfig(mergedConfig);
             }
          }
       }
    }

  }, []);

  // --- Real Data Polling Hook ---
  useEffect(() => {
    // Poll if in TV mode OR if Logged In (Admin Mode) to maintain connection status for CRUD operations
    // This ensures API features are available immediately in Device Manager/Settings
    const shouldPoll = isTvMode || isLoggedIn;
    
    if (!shouldPoll) {
       setIsPolling(false);
       setConnectionStatus('init'); // Reset status if stopping polling
       return;
    }

    const intervalSeconds = Math.max(config.dataSource?.pollingInterval || 5, 1);
    setIsPolling(true);

    const pollData = async () => {
      try {
        const windowFilter = config.speech?.broadcastMode === 'local' ? config.windowNumber : undefined;
        
        // Call Backend API
        const snapshot = await api.queue.getSnapshot(windowFilter);
        
        setConnectionStatus('connected');
        
        // Version Check: Only update state if data version changed
        if (snapshot.version !== dataVersion) {
            setConfig(prev => ({
               ...prev,
               currentPatient: snapshot.currentPatient || { id: '', name: '', number: '' },
               waitingList: snapshot.waitingList || [],
               passedList: snapshot.passedList || [],
            }));
            setDataVersion(snapshot.version);
            setLastPollTime(Date.now());
        }
      } catch (err) {
         setConnectionStatus('offline');
      }
    };

    // Execute immediately to check connection right away
    pollData();

    const timer = setInterval(pollData, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [isTvMode, isLoggedIn, config.dataSource?.pollingInterval, config.dataSource?.pollingStrategy, config.windowNumber, config.speech?.broadcastMode, dataVersion]);


  // --- Sync System Settings from API when Connected ---
  useEffect(() => {
      if (connectionStatus === 'connected') {
          api.admin.getSystemSettings()
             .then(remoteSettings => {
                 // Merge remote settings but keep local apiBaseUrl (as it defines the connection)
                 setGlobalSettings(prev => ({
                     ...remoteSettings,
                     apiBaseUrl: prev.apiBaseUrl 
                 }));
             })
             .catch(e => {
                const msg = e.message || '';
                // If endpoint doesn't exist (404) or network error (Failed to fetch), use local settings
                if (msg.includes('404') || msg.includes('Failed to fetch')) {
                    console.warn("Could not sync system settings from API (Using local defaults):", msg);
                } else {
                    console.error("Failed to fetch system settings from API", e);
                }
             });
      }
  }, [connectionStatus]);

  // Persist Updates (Hybrid: LocalStorage for Connection, API for Data)
  const handleUpdateSettings = async (newSettings: GlobalSystemSettings) => {
    setGlobalSettings(newSettings);
    
    // Always save locally to persist API URL
    localStorage.setItem('pqms_settings', JSON.stringify(newSettings));
    
    // If connected, also save to DB
    if (connectionStatus === 'connected') {
        try {
            await api.admin.saveSystemSettings(newSettings);
        } catch(e: any) {
            console.error("Failed to save settings to API", e);
            if (!e.message?.includes('404')) {
                alert("保存至数据库失败，仅保存到本地缓存");
            }
        }
    }
  };

  const handleUpdateDevices = (newDevices: DeviceBinding[]) => {
    setDevices(newDevices);
    // If offline, save locally
    if (connectionStatus !== 'connected') {
       localStorage.setItem('pqms_devices', JSON.stringify(newDevices));
    }
  };

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsLoggedIn(true);
      localStorage.setItem('pqms_auth', 'true');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('pqms_auth');
  };

  // --- Simulation Actions (Local Override or API) ---
  const simulateCallNext = async () => {
     if (connectionStatus === 'connected') {
        try {
            await api.queue.callNext(config.windowNumber || '1');
        } catch(e) { console.error('API Error', e); alert('操作失败'); }
        return;
     }

     if (config.waitingList.length === 0) return;
     const next = config.waitingList[0];
     const newWaiting = config.waitingList.slice(1);
     
     const updatedNext = { 
       ...next, 
       callTimestamp: Date.now(),
       windowName: config.windowName,
       windowNumber: config.windowNumber
     };

     setConfig({
       ...config,
       currentPatient: updatedNext,
       waitingList: newWaiting,
     });
  };

  const simulatePassCurrent = async () => {
     if (connectionStatus === 'connected' && config.currentPatient.id) {
        try {
            await api.queue.pass(config.currentPatient.id);
        } catch(e) { console.error('API Error', e); alert('操作失败'); }
        return;
     }

     if (!config.currentPatient.id) return;
     const passedOne = config.currentPatient;
     const newPassed = [passedOne, ...config.passedList].slice(0, 20);
     const next = config.waitingList.length > 0 ? config.waitingList[0] : { id: '', name: '---', number: '---' } as Patient;
     const newWaiting = config.waitingList.length > 0 ? config.waitingList.slice(1) : [];

     setConfig({
        ...config,
        currentPatient: next,
        waitingList: newWaiting,
        passedList: newPassed
     });
  };

  const simulateRecall = async () => {
    if (connectionStatus === 'connected' && config.currentPatient.id) {
        try {
            await api.queue.recall(config.currentPatient.id);
        } catch(e) { console.error('API Error', e); alert('操作失败'); }
        return;
    }

    if (!config.currentPatient.id) return;
    setConfig({
      ...config,
      currentPatient: { 
        ...config.currentPatient, 
        callTimestamp: Date.now(),
        windowName: config.windowName,
        windowNumber: config.windowNumber
      }
    });
  };

  // --- Render TV Mode ---
  if (isTvMode) {
     return (
       <div className="h-screen w-screen overflow-hidden bg-black">
          <DisplayScreen config={config} />
       </div>
     );
  }

  // --- Render Admin Mode ---
  if (!isLoggedIn) {
    return <LoginPage settings={globalSettings} onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden font-sans">
      
      {/* --- Sidebar Navigation --- */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0 transition-all duration-300">
         <div className="p-6 border-b border-gray-800">
            <h1 className="text-xl font-bold tracking-tight">排队叫号管理</h1>
            <p className="text-xs text-gray-400 mt-1">Admin Console v2.0</p>
         </div>
         
         <nav className="flex-1 p-4 space-y-2">
            <button 
              onClick={() => setCurrentView('devices')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === 'devices' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
               <Monitor size={20} />
               终端窗口管理
            </button>
            <button 
              onClick={() => setCurrentView('designer')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === 'designer' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
               <Layout size={20} />
               界面预案设计
            </button>
            <button 
              onClick={() => setCurrentView('query')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === 'query' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
               <Search size={20} />
               数据查询
            </button>
            <button 
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
               <Settings size={20} />
               系统全局设置
            </button>
         </nav>

         <div className="p-4 border-t border-gray-800">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
            >
              <LogOut size={18} /> 退出登录
            </button>
         </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Device Manager View */}
        {currentView === 'devices' && (
          <div className="flex-1 overflow-y-auto bg-gray-100">
            <DeviceManager 
              devices={devices} 
              presets={presets} 
              onUpdateDevices={handleUpdateDevices} 
              isConnected={connectionStatus === 'connected'}
            />
          </div>
        )}

        {/* Global Settings View */}
        {currentView === 'settings' && (
          <div className="flex-1 overflow-y-auto bg-gray-100">
            <SystemSettings 
              settings={globalSettings} 
              onUpdate={handleUpdateSettings}
              isConnected={connectionStatus === 'connected'}
            />
          </div>
        )}

         {/* Patient Query View */}
         {currentView === 'query' && (
          <div className="flex-1 overflow-y-auto bg-gray-100">
            <PatientQuery 
              config={config} 
              onUpdateConfig={setConfig} 
              isConnected={connectionStatus === 'connected'}
            />
          </div>
        )}

        {/* Designer View (Original Split Screen) */}
        {currentView === 'designer' && (
          <div className="flex-1 flex h-full">
            {/* Left: Preview */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-200">
              <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
                  <div className="flex items-center gap-2 text-gray-700 font-medium">
                    <MonitorPlay size={18} className="text-blue-600" />
                    <span>预案预览</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {isPolling ? (
                       connectionStatus === 'connected' ? (
                          <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                              <CloudLightning size={12} /> 实时 API 连接中 ({config.dataSource?.pollingInterval || 5}s)
                          </span>
                       ) : connectionStatus === 'offline' ? (
                          <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 animate-pulse">
                              <WifiOff size={12} /> 后端未连接 (请检查 API 地址)
                          </span>
                       ) : (
                          <span className="flex items-center gap-1 text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              <CloudLightning size={12} /> 正在连接...
                          </span>
                       )
                    ) : (
                       <span className="flex items-center gap-1 text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          <CloudOff size={12} /> 仅本地模拟
                       </span>
                    )}
                  </div>
              </div>
              
              {/* Preview Container */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-auto">
                 {/* Aspect Ratio Box */}
                 <div 
                    id="display-container"
                    className="bg-black shadow-2xl relative transition-all duration-300 ease-in-out"
                    style={
                      config.layout.orientation === 'portrait'
                      ? { 
                          aspectRatio: '9/16', 
                          height: '100%', 
                          width: 'auto', 
                          maxHeight: '900px', 
                          backgroundColor: 'white' 
                        }
                      : { 
                          aspectRatio: '16/9', 
                          width: '100%', 
                          maxWidth: '1280px', 
                          backgroundColor: 'white' 
                        }
                    }
                  >
                     <DisplayScreen config={config} />
                  </div>

                 {/* Simulation Bar */}
                 <div className="mt-4 bg-white rounded-lg shadow-sm border p-3 flex items-center gap-4 w-full max-w-4xl">
                     <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        {connectionStatus === 'connected' ? <CloudLightning size={12} className="text-green-500"/> : <CloudOff size={12}/>}
                        {connectionStatus === 'connected' ? 'API 叫号操作:' : '叫号模拟测试 (本地):'}
                     </span>
                     <button 
                       onClick={simulateCallNext}
                       className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                     >
                        <ArrowRight size={16} /> 顺呼下一位
                     </button>
                     <button 
                       onClick={simulatePassCurrent}
                       className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                     >
                        <ArrowRight size={16} className="rotate-45" /> 过号 (Pass)
                     </button>
                     <button 
                       onClick={simulateRecall}
                       className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                     >
                        <RotateCcw size={16} /> 重呼
                     </button>
                     <div className="h-4 border-l border-gray-300 mx-2"></div>
                     <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Mic size={16} className={config.speech?.enabled ? "text-purple-500 animate-pulse" : "text-gray-400"}/>
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                           当前: {config.currentPatient.name} ({config.currentPatient.number})
                        </span>
                     </div>
                 </div>
              </div>
            </div>

            {/* Right: Config Panel */}
            <div className="w-80 lg:w-96 flex-shrink-0 shadow-xl border-l bg-white z-10">
              <ConfigPanel 
                config={config} 
                updateConfig={(newConfig) => {
                  setConfig(newConfig);
                  // Also refresh preset list if save happens inside
                  const saved = localStorage.getItem('pharmacy-queue-presets');
                  if (saved) setPresets(JSON.parse(saved));
                }} 
                isConnected={connectionStatus === 'connected'}
              />
            </div>
          </div>
        )}

      </main>

    </div>
  );
};

export default App;