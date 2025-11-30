
import React, { useState, useEffect } from 'react';
import DisplayScreen from './components/DisplayScreen';
import ConfigPanel from './components/ConfigPanel';
import LoginPage from './components/LoginPage';
import DeviceManager from './components/DeviceManager';
import SystemSettings from './components/SystemSettings';
import { DEFAULT_CONFIG, DEFAULT_GLOBAL_SETTINGS, DEFAULT_DEVICES } from './constants';
import { QueueConfig, GlobalSystemSettings, DeviceBinding, Preset, Patient } from './types';
import { MonitorPlay, Layout, Settings, LogOut, Monitor, Menu, Mic, RotateCcw, ArrowRight } from 'lucide-react';

type View = 'dashboard' | 'devices' | 'settings' | 'designer';

const App: React.FC = () => {
  // --- Auth State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // --- Data State ---
  const [globalSettings, setGlobalSettings] = useState<GlobalSystemSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [devices, setDevices] = useState<DeviceBinding[]>(DEFAULT_DEVICES);
  const [config, setConfig] = useState<QueueConfig>(DEFAULT_CONFIG); // Active config for Designer
  const [presets, setPresets] = useState<Preset[]>([]); // To track available presets for binding

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
    const savedDevices = localStorage.getItem('pqms_devices');
    if (savedDevices) setDevices(JSON.parse(savedDevices));

    // 4. Load Presets (needed for Device Manager dropdowns)
    const savedPresets = localStorage.getItem('pharmacy-queue-presets');
    if (savedPresets) {
      setPresets(JSON.parse(savedPresets));
    } else {
      // Create a default preset if none exist
      const defaultPreset: Preset = { id: 'default', name: '默认样式', timestamp: Date.now(), config: DEFAULT_CONFIG };
      setPresets([defaultPreset]);
      localStorage.setItem('pharmacy-queue-presets', JSON.stringify([defaultPreset]));
    }
  }, []);

  // Persist Updates
  const handleUpdateSettings = (newSettings: GlobalSystemSettings) => {
    setGlobalSettings(newSettings);
    localStorage.setItem('pqms_settings', JSON.stringify(newSettings));
  };

  const handleUpdateDevices = (newDevices: DeviceBinding[]) => {
    setDevices(newDevices);
    localStorage.setItem('pqms_devices', JSON.stringify(newDevices));
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

  // --- Simulation Actions ---
  const simulateCallNext = () => {
     if (config.waitingList.length === 0) return;
     const next = config.waitingList[0];
     const newWaiting = config.waitingList.slice(1);
     
     // Update current patient with new timestamp to trigger call
     // IMPORTANT: For 'Local Broadcast' simulation, we assign the patient to the current window name
     const updatedNext = { 
       ...next, 
       callTimestamp: Date.now(),
       windowName: config.windowName 
     };

     setConfig({
       ...config,
       currentPatient: updatedNext,
       waitingList: newWaiting,
     });
  };

  const simulatePassCurrent = () => {
     if (!config.currentPatient.id) return;
     const passedOne = config.currentPatient;
     
     // Move current to passed list
     const newPassed = [passedOne, ...config.passedList].slice(0, 20);
     
     // Pull next from waiting
     const next = config.waitingList.length > 0 ? config.waitingList[0] : { id: '', name: '---', number: '---' };
     const newWaiting = config.waitingList.length > 0 ? config.waitingList.slice(1) : [];

     setConfig({
        ...config,
        currentPatient: next,
        waitingList: newWaiting,
        passedList: newPassed
     });
  };

  const simulateRecall = () => {
    if (!config.currentPatient.id) return;
    
    // Update timestamp to force re-trigger effect in DisplayScreen
    // Ensure windowName is set correctly for simulation
    setConfig({
      ...config,
      currentPatient: { 
        ...config.currentPatient, 
        callTimestamp: Date.now(),
        windowName: config.windowName 
      }
    });
    
    // Visual feedback handled by audio effect mostly, but let's log
    console.log(`Recalling: ${config.currentPatient.name}`);
  };

  // --- Render Logic ---

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
            />
          </div>
        )}

        {/* Global Settings View */}
        {currentView === 'settings' && (
          <div className="flex-1 overflow-y-auto bg-gray-100">
            <SystemSettings 
              settings={globalSettings} 
              onUpdate={handleUpdateSettings} 
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
                  <div className="text-xs text-gray-500">
                    此界面仅为预览，实际显示取决于终端绑定的预案
                  </div>
              </div>
              
              {/* Preview Container */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-auto">
                 <div 
                    id="display-container"
                    className="bg-black shadow-2xl relative"
                    style={{ 
                      aspectRatio: '16/9', 
                      width: '100%', 
                      maxWidth: '1280px',
                      backgroundColor: 'white' 
                    }}
                  >
                     <DisplayScreen config={config} />
                  </div>

                 {/* Simulation Bar */}
                 <div className="mt-4 bg-white rounded-lg shadow-sm border p-3 flex items-center gap-4 w-full max-w-4xl">
                     <span className="text-xs font-bold text-gray-500 uppercase">叫号模拟测试:</span>
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
              />
            </div>
          </div>
        )}

      </main>

    </div>
  );
};

export default App;
