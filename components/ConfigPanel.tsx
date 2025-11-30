
import React, { useState } from 'react';
import { QueueConfig, ContentType, PRESET_THEMES, DatabaseType } from '../types';
import { 
  Layout, 
  Palette, 
  Database, 
  Trash2, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  Monitor,
  AlignVerticalJustifyCenter,
  Type,
  Maximize2,
  X,
  Settings,
  Server,
  Network,
  Columns,
  CaseSensitive,
  Rows,
  ListEnd,
  Mic,
  PlugZap,
  Loader2,
  CheckCircle,
  AlertCircle,
  Volume2,
  Megaphone,
  PaintBucket,
  Smartphone,
  MonitorSmartphone,
  Zap,
  Clock,
  Scan,
  CloudLightning,
  Save,
  CloudOff
} from 'lucide-react';
import api from '../services/api';

interface ConfigPanelProps {
  config: QueueConfig;
  updateConfig: (newConfig: QueueConfig) => void;
  isConnected?: boolean;
}

// Helper to deep update config
const deepUpdate = (obj: any, path: string[], value: any): any => {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  if (!obj) return { [head]: deepUpdate({}, tail, value) }; // Handle undefined parents
  return {
    ...obj,
    [head]: tail.length === 0 ? value : deepUpdate(obj[head] || {}, tail, value)
  };
};

const CONTENT_OPTIONS: { label: string; value: ContentType }[] = [
  { label: '隐藏 (Hidden)', value: 'hidden' },
  { label: '窗口信息 (Window)', value: 'window-info' },
  { label: '当前叫号 (Current)', value: 'current-call' },
  { label: '等待列表 (Waiting)', value: 'waiting-list' },
  { label: '过号列表 (Passed)', value: 'passed-list' },
  { label: '富文本/公告 (Text)', value: 'static-text' },
];

interface ZoneEditorProps {
  label: string;
  zoneKey: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  config: QueueConfig;
  onUpdate: (zoneKey: string, field: string, value: any) => void;
}

const ZoneEditor: React.FC<ZoneEditorProps> = ({ label, zoneKey, config, onUpdate }) => {
  const zone = config.layout[zoneKey];
  const isHidden = zone.type === 'hidden';
  const isList = zone.type === 'waiting-list' || zone.type === 'passed-list';
  const isWindow = zone.type === 'window-info';
  const isCurrent = zone.type === 'current-call';

  return (
    <div className={`p-3 border rounded-lg transition-colors ${isHidden ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-blue-200 shadow-sm'}`}>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-bold text-gray-700 uppercase">{label}</label>
        {isHidden && <span className="text-[10px] bg-gray-200 px-1 rounded text-gray-500">已隐藏</span>}
      </div>
      
      <select 
        value={zone.type} 
        onChange={(e) => onUpdate(zoneKey, 'type', e.target.value)}
        className="w-full text-xs border-gray-300 rounded shadow-sm border p-1.5 mb-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        {CONTENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>

      {!isHidden && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
           
           {/* General Title for Lists */}
           {isList && (
             <div className="space-y-2">
               <input 
                type="text" 
                value={zone.title || ''} 
                placeholder="自定义标题"
                onChange={(e) => onUpdate(zoneKey, 'title', e.target.value)}
                className="w-full text-xs border p-1 rounded bg-gray-50 focus:bg-white"
               />
               
               {/* Title Styling */}
               <div className="flex gap-2">
                  <div className="flex items-center gap-1 flex-1 bg-gray-50 rounded p-1">
                     <input 
                       type="color" 
                       title="标题颜色"
                       value={zone.titleColor || '#ffffff'} 
                       onChange={(e) => onUpdate(zoneKey, 'titleColor', e.target.value)} 
                       className="h-5 w-6 border-none p-0 bg-transparent cursor-pointer"
                     />
                     <span className="text-[10px] text-gray-400">T</span>
                  </div>
                  <input 
                   type="number"
                   placeholder="大小"
                   title="标题字号"
                   value={zone.titleFontSize || 18}
                   onChange={(e) => onUpdate(zoneKey, 'titleFontSize', Number(e.target.value))}
                   className="w-14 text-xs border p-1 rounded text-center"
                  />
               </div>

               {/* Include Current Patient Toggle */}
               {zone.type === 'waiting-list' && (
                  <div className="mt-2 bg-yellow-50 p-2 rounded border border-yellow-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={zone.includeCurrent || false} 
                        onChange={(e) => onUpdate(zoneKey, 'includeCurrent', e.target.checked)}
                        className="accent-yellow-600 h-3.5 w-3.5"
                      />
                      <label className="text-[10px] text-yellow-800 font-medium">
                         合并显示"正在叫号" (Include Current)
                      </label>
                    </div>
                    {zone.includeCurrent && (
                      <div className="flex items-center gap-2 pl-5">
                        <input 
                          type="checkbox" 
                          checked={zone.highlightCurrent || false} 
                          onChange={(e) => onUpdate(zoneKey, 'highlightCurrent', e.target.checked)}
                          className="accent-orange-500 h-3.5 w-3.5"
                        />
                        <label className="text-[10px] text-orange-700">
                           是否特殊样式显示 (Highlight Style)
                        </label>
                      </div>
                    )}
                  </div>
               )}

               {/* List Layout Config */}
               <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed">
                  <div>
                     <label className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <Columns size={10}/> 列数 (Col)
                     </label>
                     <select 
                       value={zone.gridColumns || 1}
                       onChange={(e) => onUpdate(zoneKey, 'gridColumns', Number(e.target.value))}
                       className="w-full text-xs border p-1 rounded"
                     >
                       <option value={1}>1 列</option>
                       <option value={2}>2 列</option>
                       <option value={3}>3 列</option>
                       <option value={4}>4 列</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <Rows size={10}/> 行数 (Row)
                     </label>
                     <select 
                       value={zone.gridRows || 3}
                       onChange={(e) => onUpdate(zoneKey, 'gridRows', Number(e.target.value))}
                       className="w-full text-xs border p-1 rounded"
                     >
                       {[2,3,4,5,6,8,10].map(n => <option key={n} value={n}>{n} 行</option>)}
                     </select>
                  </div>
                  <div className="col-span-2">
                     <label className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                        <CaseSensitive size={10}/> 姓名大小
                     </label>
                     <input 
                       type="number"
                       min="12" max="60"
                       value={zone.contentFontSize || 24}
                       onChange={(e) => onUpdate(zoneKey, 'contentFontSize', Number(e.target.value))}
                       className="w-full text-xs border p-1 rounded"
                     />
                  </div>
               </div>
             </div>
           )}

           {/* Window Info Customization */}
           {isWindow && (
             <div className="space-y-3 pt-2 border-t border-dashed">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-600 font-bold">显示窗口号 (Show Number)</label>
                  <input 
                    type="checkbox" 
                    checked={zone.showWindowNumber !== false} 
                    onChange={(e) => onUpdate(zoneKey, 'showWindowNumber', e.target.checked)} 
                    className="accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">窗口号大小 (Number Size)</label>
                  <input 
                     type="range" min="40" max="150"
                     value={zone.windowNumberFontSize || 80}
                     onChange={(e) => onUpdate(zoneKey, 'windowNumberFontSize', Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">窗口名大小 (Name Size)</label>
                  <input 
                     type="range" min="16" max="60"
                     value={zone.windowNameFontSize || 32}
                     onChange={(e) => onUpdate(zoneKey, 'windowNameFontSize', Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">副标题 (Rich HTML)</label>
                  <textarea 
                    rows={2}
                    value={zone.windowSubTitleHtml || ''}
                    onChange={(e) => onUpdate(zoneKey, 'windowSubTitleHtml', e.target.value)}
                    className="w-full text-[10px] border p-1 rounded font-mono text-gray-600"
                    placeholder="<div class='text-lg'>请排队...</div>"
                  />
                </div>
             </div>
           )}

           {/* Current Call Customization */}
           {isCurrent && (
              <div className="space-y-3 pt-2 border-t border-dashed">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-600 font-bold">显示"正在叫号"标题</label>
                  <input 
                    type="checkbox" 
                    checked={zone.showCurrentTitle !== false} 
                    onChange={(e) => onUpdate(zoneKey, 'showCurrentTitle', e.target.checked)} 
                    className="accent-blue-600"
                  />
                </div>
                {zone.showCurrentTitle !== false && (
                  <input 
                    type="text" 
                    value={zone.currentTitleText || '正在取药'} 
                    onChange={(e) => onUpdate(zoneKey, 'currentTitleText', e.target.value)}
                    className="w-full text-xs border p-1 rounded"
                    placeholder="标题文本"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                   <div>
                      <label className="text-[10px] text-gray-500 mb-1">姓名大小</label>
                      <input 
                         type="number" 
                         value={zone.currentNameFontSize || 60}
                         onChange={(e) => onUpdate(zoneKey, 'currentNameFontSize', Number(e.target.value))}
                         className="w-full text-xs border p-1 rounded"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] text-gray-500 mb-1">号码大小</label>
                      <input 
                         type="number" 
                         value={zone.currentNumberFontSize || 36}
                         onChange={(e) => onUpdate(zoneKey, 'currentNumberFontSize', Number(e.target.value))}
                         className="w-full text-xs border p-1 rounded"
                      />
                   </div>
                </div>
              </div>
           )}

           {/* Static Text Customization */}
           {zone.type === 'static-text' && (
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 mb-1">HTML 内容</label>
                <textarea 
                  rows={4} 
                  value={zone.staticTextContent || ''} 
                  onChange={(e) => onUpdate(zoneKey, 'staticTextContent', e.target.value)}
                  className="w-full text-xs border p-1 rounded font-mono"
                  placeholder="<b>公告：</b>..."
                />
                <div className="flex gap-2">
                   <div className="flex items-center gap-1 flex-1 bg-gray-50 rounded p-1">
                      <PaintBucket size={10} className="text-gray-400" />
                      <input type="color" value={zone.staticBgColor || '#ffffff'} onChange={(e) => onUpdate(zoneKey, 'staticBgColor', e.target.value)} className="h-4 w-5 border-none bg-transparent"/>
                   </div>
                   <div className="flex items-center gap-1 flex-1 bg-gray-50 rounded p-1">
                      <Type size={10} className="text-gray-400" />
                      <input type="color" value={zone.staticTextColor || '#000000'} onChange={(e) => onUpdate(zoneKey, 'staticTextColor', e.target.value)} className="h-4 w-5 border-none bg-transparent"/>
                   </div>
                </div>
              </div>
           )}

        </div>
      )}
    </div>
  );
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, updateConfig, isConnected }) => {
  const [activeTab, setActiveTab] = useState<'layout' | 'style' | 'header' | 'data' | 'voice' | 'system'>('layout');
  
  // State for Preset Management
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<{id: string, name: string}[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  
  // State for Delete Confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // DB Test State
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');

  // Load Presets
  React.useEffect(() => {
     if (showLoadModal) {
         if (isConnected) {
             api.admin.getPresets()
               .then(list => {
                   // Map to ensure ID exists (handle PascalCase from C# if needed)
                   const safeList = list.map((p: any) => ({
                       id: p.id || p.Id,
                       name: p.name || p.Name
                   })).filter((p: any) => p.id); // Filter out invalid items
                   setPresets(safeList);
               })
               .catch(e => {
                  if (e.message && e.message.includes('Failed to fetch')) return;
                  console.error(e);
                  // Hint for user
                  alert('获取预案列表失败，请检查网络或后端日志');
               });
         } else {
             const saved = localStorage.getItem('pharmacy-queue-presets');
             if (saved) {
                const parsed = JSON.parse(saved);
                setPresets(parsed.map((p: any) => ({ id: p.id, name: p.name })));
             }
         }
     }
  }, [showLoadModal, isConnected]);

  // Shortcut for Save (Ctrl+S)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleOpenSaveModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSaveModal]); // Dep on modal state to avoid re-opening if open

  const handleUpdate = (path: string[], value: any) => {
    const newConfig = deepUpdate(config, path, value);
    // Increment config version to notify displays
    newConfig.configVersion = `v${Date.now()}`;
    updateConfig(newConfig);
  };

  const handleZoneUpdate = (zoneKey: string, field: string, value: any) => {
    handleUpdate(['layout', zoneKey, field], value);
  };

  const handleOpenSaveModal = () => {
     if (!showSaveModal) {
        setPresetName(`预案-${new Date().toLocaleDateString()}`);
        setShowSaveModal(true);
     }
  };

  const handleConfirmSave = async () => {
     const newPresetId = `preset-${Date.now()}`;
     
     if (isConnected) {
         try {
             await api.admin.savePreset(newPresetId, presetName, config);
             alert('已保存至服务器');
             setShowSaveModal(false);
         } catch(e) {
             alert('保存失败');
         }
         return;
     }

     // Local Storage Logic
     const newPreset = {
       id: newPresetId,
       name: presetName,
       timestamp: Date.now(),
       config: config
     };
     
     const saved = localStorage.getItem('pharmacy-queue-presets');
     const list = saved ? JSON.parse(saved) : [];
     const newList = [...list, newPreset];
     localStorage.setItem('pharmacy-queue-presets', JSON.stringify(newList));
     setShowSaveModal(false);
  };

  const handleLoadPreset = async (id: string) => {
    if (isConnected) {
        try {
            const preset = await api.admin.getPreset(id);
            if (preset && preset.config) {
                // Fix: Parse config if it is returned as a JSON string from the backend
                let configData = preset.config;
                if (typeof configData === 'string') {
                    try {
                        configData = JSON.parse(configData);
                    } catch (e) {
                        console.error("Failed to parse config JSON", e);
                        alert("预案数据损坏");
                        return;
                    }
                }

                // Ensure config has version to trigger update
                configData.configVersion = `v${Date.now()}`;
                updateConfig(configData);
                setShowLoadModal(false);
            }
        } catch(e) { console.error(e); alert('加载失败'); }
        return;
    }

    // Local Logic
    const saved = localStorage.getItem('pharmacy-queue-presets');
    if (saved) {
       const list = JSON.parse(saved);
       const target = list.find((p: any) => p.id === id);
       if (target) {
          target.config.configVersion = `v${Date.now()}`;
          updateConfig(target.config);
          setShowLoadModal(false);
       }
    }
  };

  const initiateDeletePreset = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     e.preventDefault();
     console.log(`[ConfigPanel] Init delete for ${id}`);
     setDeleteConfirmId(id);
  };

  const executeDeletePreset = async () => {
     if (!deleteConfirmId) return;
     const id = deleteConfirmId;
     
     console.log(`[ConfigPanel] Executing delete preset ${id}. Connected: ${isConnected}`);

     if (isConnected) {
         try {
             await api.admin.deletePreset(id);
             setPresets(prev => prev.filter(p => p.id !== id));
             // Deletion successful, UI updates automatically
         } catch(e: any) { 
             console.error("[ConfigPanel] Delete error:", e); 
             alert(`删除失败: ${e.message || 'API 请求错误'}`);
         }
     } else {
         const saved = localStorage.getItem('pharmacy-queue-presets');
         if (saved) {
            const list = JSON.parse(saved);
            const newList = list.filter((p: any) => p.id !== id);
            localStorage.setItem('pharmacy-queue-presets', JSON.stringify(newList));
            setPresets(newList);
         }
     }
     setDeleteConfirmId(null);
  };

  const handleTestDbConnection = () => {
    setDbTestStatus('testing');
    setTimeout(() => {
      // Mock test
      if (config.dataSource?.dbConnectionString) {
        setDbTestStatus('success');
      } else {
        setDbTestStatus('fail');
      }
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-800 font-sans">
      
      {/* Header */}
      <div className="px-5 py-4 bg-white border-b shadow-sm flex justify-between items-center shrink-0 z-10">
        <div>
           <h2 className="text-lg font-bold flex items-center gap-2">
             <Settings className="text-blue-600" size={20} />
             配置面板
             {isConnected ? (
                <div title="API Connected" className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             ) : (
                <div title="Local Mode" className="w-2 h-2 rounded-full bg-gray-400"></div>
             )}
           </h2>
           <p className="text-[10px] text-gray-400 mt-0.5 font-mono">Ver: {config.configVersion}</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowLoadModal(true)}
             className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
             title="加载预案"
           >
             <Scan size={18} />
           </button>
           <button 
             onClick={handleOpenSaveModal}
             className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
             title="保存预案 (Ctrl+S)"
           >
             <Save size={18} />
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'layout', icon: Layout, label: '布局' },
          { id: 'style', icon: Palette, label: '视觉' },
          { id: 'header', icon: Monitor, label: '页头' },
          { id: 'data', icon: Database, label: '数据' },
          { id: 'voice', icon: Mic, label: '语音' },
          // { id: 'system', icon: Settings, label: '系统' } // Moved to Global Settings
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-1 text-[10px] font-medium transition-colors border-b-2 ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={18} className="mb-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {/* === LAYOUT TAB === */}
        {activeTab === 'layout' && (
          <div className="space-y-6">
            
            {/* Screen Orientation */}
            <div className="bg-white p-3 rounded-xl border shadow-sm">
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                  <MonitorSmartphone size={14}/> 屏幕方向 (Orientation)
               </h3>
               <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleUpdate(['layout', 'orientation'], 'landscape')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                       config.layout.orientation === 'landscape' 
                       ? 'border-blue-500 bg-blue-50 text-blue-700' 
                       : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                     <Monitor size={20} className="rotate-0" />
                     <span className="text-xs font-bold">横屏 (16:9)</span>
                  </button>
                  <button 
                    onClick={() => handleUpdate(['layout', 'orientation'], 'portrait')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                       config.layout.orientation === 'portrait' 
                       ? 'border-blue-500 bg-blue-50 text-blue-700' 
                       : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                     <Smartphone size={20} />
                     <span className="text-xs font-bold">竖屏 (9:16)</span>
                  </button>
               </div>
            </div>

            {/* Split Ratios */}
            <div className="bg-white p-3 rounded-xl border shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
                 <Columns size={14}/> 区域分割 (Split)
              </h3>
              
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 flex justify-between">
                  <span>{config.layout.orientation === 'landscape' ? '左右分割比例' : '上下主分割比例'}</span>
                  <span className="text-blue-600">{config.layout.splitRatio}%</span>
                </label>
                <input 
                  type="range" min="20" max="80" 
                  value={config.layout.splitRatio} 
                  onChange={(e) => handleUpdate(['layout', 'splitRatio'], Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                <div>
                   <label className="text-[10px] text-gray-500 mb-1 flex justify-between">
                      <span>左侧/上部 上下比</span>
                      <span className="text-blue-600">{config.layout.leftSplitRatio ?? 50}%</span>
                   </label>
                   <input 
                    type="range" min="20" max="80" 
                    value={config.layout.leftSplitRatio ?? 50} 
                    onChange={(e) => handleUpdate(['layout', 'leftSplitRatio'], Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div>
                   <label className="text-[10px] text-gray-500 mb-1 flex justify-between">
                      <span>右侧/下部 上下比</span>
                      <span className="text-blue-600">{config.layout.rightSplitRatio ?? 50}%</span>
                   </label>
                   <input 
                    type="range" min="20" max="80" 
                    value={config.layout.rightSplitRatio ?? 50} 
                    onChange={(e) => handleUpdate(['layout', 'rightSplitRatio'], Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
              
              <div>
                 <label className="text-[10px] text-gray-500 mb-1 block">电视安全边距 (TV Overscan Padding)</label>
                 <div className="flex items-center gap-2">
                    <Maximize2 size={12} className="text-gray-400"/>
                    <input 
                      type="number" min="0" max="100"
                      value={config.layout.overscanPadding || 0}
                      onChange={(e) => handleUpdate(['layout', 'overscanPadding'], Number(e.target.value))}
                      className="w-full text-xs border p-1 rounded"
                    />
                    <span className="text-xs text-gray-400">px</span>
                 </div>
              </div>
            </div>
            
            {/* Zone Configs */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase px-1">区域内容 (Zones)</h3>
              <ZoneEditor label="左上 / 顶部区 1" zoneKey="topLeft" config={config} onUpdate={handleZoneUpdate} />
              <ZoneEditor label="左下 / 顶部区 2" zoneKey="bottomLeft" config={config} onUpdate={handleZoneUpdate} />
              <ZoneEditor label="右上 / 底部区 1" zoneKey="topRight" config={config} onUpdate={handleZoneUpdate} />
              <ZoneEditor label="右下 / 底部区 2" zoneKey="bottomRight" config={config} onUpdate={handleZoneUpdate} />
            </div>

            {/* Footer Config */}
            <div className="bg-white p-3 rounded-xl border shadow-sm space-y-3">
               <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                    <ListEnd size={14} /> 底部滚动字幕 (Footer)
                 </h3>
                 <input 
                    type="checkbox" 
                    checked={config.layout.footerShow} 
                    onChange={(e) => handleUpdate(['layout', 'footerShow'], e.target.checked)} 
                    className="accent-blue-600"
                  />
               </div>
               
               {config.layout.footerShow && (
                 <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <textarea 
                      rows={3}
                      value={config.layout.footerText}
                      onChange={(e) => handleUpdate(['layout', 'footerText'], e.target.value)}
                      className="w-full text-xs border p-2 rounded bg-gray-50 focus:bg-white font-mono"
                      placeholder="滚动字幕内容 (支持 HTML)"
                    />
                    <div className="flex gap-4">
                       <div className="flex items-center gap-2">
                          <label className="text-[10px] text-gray-500">滚动</label>
                          <input type="checkbox" checked={config.layout.footerScroll} onChange={(e) => handleUpdate(['layout', 'footerScroll'], e.target.checked)} />
                       </div>
                       <div className="flex items-center gap-2 flex-1">
                          <label className="text-[10px] text-gray-500 whitespace-nowrap">速度 (秒)</label>
                          <input type="number" value={config.layout.footerSpeed} onChange={(e) => handleUpdate(['layout', 'footerSpeed'], Number(e.target.value))} className="w-full text-xs border p-1 rounded" />
                       </div>
                       <div className="flex items-center gap-2 flex-1">
                          <label className="text-[10px] text-gray-500 whitespace-nowrap">高度</label>
                          <input type="number" value={config.layout.footerHeight} onChange={(e) => handleUpdate(['layout', 'footerHeight'], Number(e.target.value))} className="w-full text-xs border p-1 rounded" />
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* === STYLE TAB === */}
        {activeTab === 'style' && (
          <div className="space-y-6">
            
            {/* Theme Presets */}
            <div className="bg-white p-4 rounded-xl border shadow-sm">
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">主题配色 (Theme)</h3>
               <div className="grid grid-cols-4 gap-2">
                  {Object.entries(PRESET_THEMES).map(([key, theme]) => (
                    <button
                      key={key}
                      onClick={() => handleUpdate(['theme'], theme)}
                      className={`h-12 rounded-lg flex overflow-hidden border-2 transition-all ${
                         config.theme.primary === theme.primary ? 'border-gray-800 scale-105 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      title={key}
                    >
                       <div className="flex-1" style={{ background: theme.primary }}></div>
                       <div className="flex-1" style={{ background: theme.secondary }}></div>
                       <div className="flex-1" style={{ background: theme.background }}></div>
                    </button>
                  ))}
               </div>
               
               <div className="mt-4 pt-4 border-t border-dashed grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                     <label className="text-[10px] text-gray-500">主色 (Primary)</label>
                     <div className="flex gap-2">
                        <input type="color" value={config.theme.primary} onChange={(e) => handleUpdate(['theme', 'primary'], e.target.value)} className="h-8 w-full rounded cursor-pointer"/>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] text-gray-500">强调色 (Secondary)</label>
                     <div className="flex gap-2">
                        <input type="color" value={config.theme.secondary} onChange={(e) => handleUpdate(['theme', 'secondary'], e.target.value)} className="h-8 w-full rounded cursor-pointer"/>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] text-gray-500">背景色 (Background)</label>
                     <div className="flex gap-2">
                        <input type="color" value={config.theme.background} onChange={(e) => handleUpdate(['theme', 'background'], e.target.value)} className="h-8 w-full rounded cursor-pointer"/>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] text-gray-500">文字色 (On Primary)</label>
                     <div className="flex gap-2">
                        <input type="color" value={config.theme.textOnPrimary} onChange={(e) => handleUpdate(['theme', 'textOnPrimary'], e.target.value)} className="h-8 w-full rounded cursor-pointer"/>
                     </div>
                  </div>
               </div>
            </div>

            {/* Global Visuals */}
            <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">全局样式 (Global)</h3>
               
               <div>
                  <label className="text-xs text-gray-600 mb-1 block">卡片圆角 (Rounded)</label>
                  <input 
                     type="range" min="0" max="30" 
                     value={config.cardRounded} 
                     onChange={(e) => handleUpdate(['cardRounded'], Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
               </div>

               <div className="pt-2 border-t border-dashed">
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-xs text-gray-600 font-bold">显示排队号码</label>
                     <input type="checkbox" checked={config.showQueueNumber} onChange={(e) => handleUpdate(['showQueueNumber'], e.target.checked)} className="accent-blue-600" />
                  </div>
                  {config.showQueueNumber && (
                     <div className="grid grid-cols-4 gap-2">
                        {['circle', 'rounded', 'square', 'none'].map(style => (
                           <button 
                             key={style}
                             onClick={() => handleUpdate(['queueNumberStyle'], style)}
                             className={`text-[10px] py-1 border rounded transition-all ${config.queueNumberStyle === style ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'text-gray-500'}`}
                           >
                              {style}
                           </button>
                        ))}
                     </div>
                  )}
               </div>

               <div className="pt-2 border-t border-dashed space-y-2">
                  <label className="text-xs text-gray-600 font-bold block">过号显示模式</label>
                  <select 
                     value={config.passedDisplayMode} 
                     onChange={(e) => handleUpdate(['passedDisplayMode'], e.target.value)}
                     className="w-full text-xs border p-2 rounded"
                  >
                     <option value="zone">独立区域 (Zone)</option>
                     <option value="wait-list-end">合并在等待列表末尾</option>
                     <option value="footer">仅底部滚动显示</option>
                  </select>
                  
                  {config.passedDisplayMode === 'wait-list-end' && (
                     <div className="flex items-center gap-2">
                        <input type="checkbox" checked={config.grayOutPassed} onChange={(e) => handleUpdate(['grayOutPassed'], e.target.checked)} />
                        <label className="text-[10px] text-gray-500">灰色样式区分 (Gray Out)</label>
                     </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* === HEADER TAB === */}
        {activeTab === 'header' && (
           <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
                 <h3 className="text-xs font-bold text-gray-700">显示页头 (Header)</h3>
                 <input type="checkbox" checked={config.header.show} onChange={(e) => handleUpdate(['header', 'show'], e.target.checked)} className="accent-blue-600 scale-125" />
              </div>

              {config.header.show && (
                 <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
                    
                    {/* Main Title */}
                    <div>
                       <label className="text-[10px] text-gray-500 mb-1 block">医院/主标题名称</label>
                       <input 
                         type="text" 
                         value={config.header.hospitalName} 
                         onChange={(e) => handleUpdate(['header', 'hospitalName'], e.target.value)}
                         className="w-full text-sm border p-2 rounded font-bold"
                       />
                       <div className="mt-2 flex items-center gap-2">
                          <label className="text-[10px] text-gray-400">字号</label>
                          <input 
                            type="number" 
                            value={config.header.hospitalNameSize} 
                            onChange={(e) => handleUpdate(['header', 'hospitalNameSize'], Number(e.target.value))}
                            className="w-16 text-xs border p-1 rounded"
                          />
                       </div>
                    </div>

                    {/* Logo Config */}
                    <div className="pt-2 border-t border-dashed">
                       <label className="text-[10px] text-gray-500 mb-1 block">Logo 类型</label>
                       <select 
                         value={config.header.logoType} 
                         onChange={(e) => handleUpdate(['header', 'logoType'], e.target.value)}
                         className="w-full text-xs border p-2 rounded mb-2"
                       >
                          <option value="default">默认图标</option>
                          <option value="image">图片 URL</option>
                          <option value="hidden">隐藏</option>
                       </select>
                       {config.header.logoType === 'image' && (
                          <input 
                            type="text" 
                            placeholder="https://example.com/logo.png"
                            value={config.header.logoUrl || ''} 
                            onChange={(e) => handleUpdate(['header', 'logoUrl'], e.target.value)}
                            className="w-full text-xs border p-2 rounded bg-gray-50"
                          />
                       )}
                    </div>

                    {/* Center Title */}
                    <div className="pt-2 border-t border-dashed">
                       <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-gray-500">中间副标题</label>
                          <input type="checkbox" checked={config.header.showCenterTitle} onChange={(e) => handleUpdate(['header', 'showCenterTitle'], e.target.checked)} />
                       </div>
                       {config.header.showCenterTitle && (
                          <div className="flex gap-2">
                             <input 
                               type="text" 
                               value={config.header.centerTitle} 
                               onChange={(e) => handleUpdate(['header', 'centerTitle'], e.target.value)}
                               className="flex-1 text-xs border p-2 rounded"
                             />
                             <input 
                               type="number" 
                               value={config.header.centerTitleSize} 
                               onChange={(e) => handleUpdate(['header', 'centerTitleSize'], Number(e.target.value))}
                               className="w-16 text-xs border p-2 rounded"
                             />
                          </div>
                       )}
                    </div>
                    
                    {/* Right Content */}
                    <div className="pt-2 border-t border-dashed">
                       <label className="text-[10px] text-gray-500 mb-1 block">右侧内容</label>
                       <select 
                         value={config.header.rightContentType} 
                         onChange={(e) => handleUpdate(['header', 'rightContentType'], e.target.value)}
                         className="w-full text-xs border p-2 rounded mb-2"
                       >
                          <option value="time">当前日期时间</option>
                          <option value="text">自定义文本</option>
                          <option value="hidden">隐藏</option>
                       </select>
                       {config.header.rightContentType === 'text' && (
                          <input 
                            type="text" 
                            value={config.header.rightTextContent} 
                            onChange={(e) => handleUpdate(['header', 'rightTextContent'], e.target.value)}
                            className="w-full text-xs border p-2 rounded"
                          />
                       )}
                    </div>

                 </div>
              )}
           </div>
        )}

        {/* === DATA TAB === */}
        {activeTab === 'data' && (
           <div className="space-y-6">
              
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                 <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <Database size={14}/> 数据源模式 (Mode)
                 </h3>
                 <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                    <button 
                       onClick={() => handleUpdate(['dataSource', 'mode'], 'push')}
                       className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${config.dataSource?.mode === 'push' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                       API 推送 (Push)
                    </button>
                    <button 
                       onClick={() => handleUpdate(['dataSource', 'mode'], 'pull')}
                       className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${config.dataSource?.mode === 'pull' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}
                    >
                       数据库直连 (Pull)
                    </button>
                 </div>

                 {config.dataSource?.mode === 'pull' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                       <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">数据库类型</label>
                          <select 
                             value={config.dataSource?.dbType} 
                             onChange={(e) => handleUpdate(['dataSource', 'dbType'], e.target.value)}
                             className="w-full text-xs border p-2 rounded"
                          >
                             <option value="sqlserver">SQL Server</option>
                             <option value="mysql">MySQL</option>
                             <option value="oracle">Oracle</option>
                             <option value="postgresql">PostgreSQL</option>
                          </select>
                       </div>
                       <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">连接字符串 (Connection String)</label>
                          <textarea 
                             rows={3}
                             value={config.dataSource?.dbConnectionString} 
                             onChange={(e) => handleUpdate(['dataSource', 'dbConnectionString'], e.target.value)}
                             className="w-full text-xs border p-2 rounded font-mono bg-gray-50"
                             placeholder="Server=myServer;Database=myDataBase;User Id=myUsername;Password=myPassword;"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">视图/表名 (Table/View)</label>
                          <input 
                             type="text"
                             value={config.dataSource?.tableName} 
                             onChange={(e) => handleUpdate(['dataSource', 'tableName'], e.target.value)}
                             className="w-full text-xs border p-2 rounded font-mono"
                          />
                       </div>
                       
                       {/* Field Mapping */}
                       <div className="pt-2 border-t border-dashed">
                          <h4 className="text-[10px] font-bold text-gray-600 mb-2">字段映射 (Field Mapping)</h4>
                          <div className="grid grid-cols-2 gap-2">
                             {[
                                { k: 'id', n: '唯一标识 (ID)' },
                                { k: 'name', n: '患者姓名 (Name)' },
                                { k: 'number', n: '排队号码 (No.)' },
                                { k: 'status', n: '状态字段 (Status)' },
                                { k: 'windowId', n: '窗口号字段 (WinID)' },
                                { k: 'order', n: '排序字段 (Sort Order)' }
                             ].map(f => (
                                <div key={f.k}>
                                   <input 
                                     type="text" 
                                     value={(config.dataSource?.fieldMap as any)?.[f.k] || ''}
                                     onChange={(e) => handleUpdate(['dataSource', 'fieldMap', f.k], e.target.value)}
                                     placeholder={f.n}
                                     className="w-full text-[10px] border p-1.5 rounded font-mono"
                                     title={f.n}
                                   />
                                </div>
                             ))}
                          </div>
                       </div>

                       {/* Status Value Mapping */}
                       <div className="pt-2 border-t border-dashed">
                          <h4 className="text-[10px] font-bold text-gray-600 mb-2">状态值映射 (Value Mapping)</h4>
                          <div className="grid grid-cols-3 gap-2">
                              <div>
                                 <label className="text-[9px] text-gray-400">等待 (Wait)</label>
                                 <input type="text" value={config.dataSource?.statusMap?.waitingValue} onChange={(e) => handleUpdate(['dataSource', 'statusMap', 'waitingValue'], e.target.value)} className="w-full text-xs border p-1 rounded" />
                              </div>
                              <div>
                                 <label className="text-[9px] text-gray-400">叫号 (Call)</label>
                                 <input type="text" value={config.dataSource?.statusMap?.calledValue} onChange={(e) => handleUpdate(['dataSource', 'statusMap', 'calledValue'], e.target.value)} className="w-full text-xs border p-1 rounded" />
                              </div>
                              <div>
                                 <label className="text-[9px] text-gray-400">过号 (Pass)</label>
                                 <input type="text" value={config.dataSource?.statusMap?.passedValue} onChange={(e) => handleUpdate(['dataSource', 'statusMap', 'passedValue'], e.target.value)} className="w-full text-xs border p-1 rounded" />
                              </div>
                          </div>
                       </div>

                       <button 
                          onClick={handleTestDbConnection}
                          className="w-full mt-2 py-2 bg-purple-50 text-purple-700 text-xs font-bold rounded hover:bg-purple-100 flex justify-center items-center gap-2"
                       >
                          {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={14}/> : <PlugZap size={14}/>}
                          测试数据库连接
                       </button>
                       {dbTestStatus === 'success' && <div className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle size={10}/> 连接成功</div>}
                       {dbTestStatus === 'fail' && <div className="text-[10px] text-red-600 flex items-center gap-1"><AlertCircle size={10}/> 连接失败</div>}
                    </div>
                 )}
              </div>

              {/* Polling Config */}
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                 <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <Network size={14}/> 轮询设置 (Polling)
                 </h3>
                 <div className="flex items-center gap-4">
                    <div className="flex-1">
                       <label className="text-[10px] text-gray-500 mb-1 block">刷新间隔 (秒)</label>
                       <input 
                         type="number" min="1" max="60"
                         value={config.dataSource?.pollingInterval || 5} 
                         onChange={(e) => handleUpdate(['dataSource', 'pollingInterval'], Number(e.target.value))}
                         className="w-full text-sm border p-2 rounded"
                       />
                    </div>
                    
                    {/* Polling Strategy Config */}
                    <div className="flex-1">
                       <label className="text-[10px] text-gray-500 mb-1 block">轮询策略 (Strategy)</label>
                       <select 
                         value={config.dataSource?.pollingStrategy || 'realtime'} 
                         onChange={(e) => handleUpdate(['dataSource', 'pollingStrategy'], e.target.value)}
                         className="w-full text-sm border p-2 rounded"
                       >
                          <option value="realtime">实时 (Realtime)</option>
                          <option value="smart">智能省流 (Smart)</option>
                       </select>
                    </div>
                 </div>
                 
                 {/* Helper Text for Smart Strategy */}
                 {config.dataSource?.pollingStrategy === 'smart' && (
                    <div className="mt-2 text-[10px] text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                       <b>智能模式：</b> 当屏幕全部显示静态内容（如纯文本公告、隐藏）时，将自动暂停数据库轮询以节省服务器性能。
                    </div>
                 )}
              </div>

           </div>
        )}

        {/* === VOICE TAB === */}
        {activeTab === 'voice' && (
          <div className="space-y-6">
             <div className="bg-white p-4 rounded-xl border shadow-sm">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                       <Megaphone size={14}/> 语音播报 (TTS)
                    </h3>
                    <input 
                       type="checkbox" 
                       checked={config.speech?.enabled !== false} 
                       onChange={(e) => handleUpdate(['speech', 'enabled'], e.target.checked)} 
                       className="accent-green-500 scale-125"
                    />
                 </div>

                 {config.speech?.enabled !== false && (
                    <div className="space-y-4 animate-in fade-in">
                       {/* Mode Selection */}
                       <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">播报模式</label>
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                             <button 
                                onClick={() => handleUpdate(['speech', 'broadcastMode'], 'all')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded ${config.speech?.broadcastMode === 'all' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                             >
                                全局播报
                             </button>
                             <button 
                                onClick={() => handleUpdate(['speech', 'broadcastMode'], 'local')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded ${config.speech?.broadcastMode === 'local' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}
                             >
                                仅本机窗口
                             </button>
                          </div>
                          {config.speech?.broadcastMode === 'local' && (
                             <div className="mt-2 text-[10px] text-purple-600 bg-purple-50 p-2 rounded">
                                <span className="font-bold">本地窗口号: </span> 
                                <input 
                                  type="text" 
                                  value={config.windowNumber || ''} 
                                  onChange={(e) => handleUpdate(['windowNumber'], e.target.value)}
                                  className="border-b border-purple-300 bg-transparent w-16 text-center focus:outline-none"
                                />
                                <br/>仅当叫号数据的窗口号匹配此号码时才播放语音。
                             </div>
                          )}
                       </div>

                       {/* Template */}
                       <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">播报模板</label>
                          <textarea 
                             value={config.speech?.template || ''} 
                             onChange={(e) => handleUpdate(['speech', 'template'], e.target.value)}
                             className="w-full text-sm border p-2 rounded bg-gray-50 focus:bg-white"
                             rows={2}
                          />
                          <div className="mt-1 flex gap-2 text-[10px] text-gray-400">
                             <span className="bg-gray-100 px-1 rounded">{'{number}'} 号码</span>
                             <span className="bg-gray-100 px-1 rounded">{'{name}'} 姓名</span>
                             <span className="bg-gray-100 px-1 rounded">{'{window}'} 窗口</span>
                          </div>
                       </div>
                       
                       {/* Audio Params */}
                       <div className="grid grid-cols-3 gap-3 pt-2 border-t border-dashed">
                          <div>
                             <label className="text-[10px] text-gray-500 block mb-1">音量 ({config.speech?.volume || 1})</label>
                             <input type="range" min="0" max="1" step="0.1" value={config.speech?.volume || 1} onChange={(e) => handleUpdate(['speech', 'volume'], Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"/>
                          </div>
                          <div>
                             <label className="text-[10px] text-gray-500 block mb-1">语速 ({config.speech?.rate || 1})</label>
                             <input type="range" min="0.5" max="2" step="0.1" value={config.speech?.rate || 1} onChange={(e) => handleUpdate(['speech', 'rate'], Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"/>
                          </div>
                          <div>
                             <label className="text-[10px] text-gray-500 block mb-1">语调 ({config.speech?.pitch || 1})</label>
                             <input type="range" min="0" max="2" step="0.1" value={config.speech?.pitch || 1} onChange={(e) => handleUpdate(['speech', 'pitch'], Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"/>
                          </div>
                       </div>
                    </div>
                 )}
             </div>
          </div>
        )}

      </div>

      {/* --- SAVE PRESET MODAL --- */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in zoom-in-95">
              <h3 className="text-lg font-bold mb-4">保存当前预案</h3>
              <input 
                type="text" 
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="预案名称 (e.g. 标准横屏)"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                 <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                 <button onClick={handleConfirmSave} className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">确认保存</button>
              </div>
           </div>
        </div>
      )}

      {/* --- LOAD PRESET MODAL --- */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in zoom-in-95 max-h-[80vh] flex flex-col">
              <h3 className="text-lg font-bold mb-4 flex justify-between items-center">
                 <span>加载预案</span>
                 <button onClick={() => setShowLoadModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                 {presets.length === 0 && <p className="text-gray-400 text-center py-4 text-sm">暂无保存的预案</p>}
                 {presets.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => handleLoadPreset(p.id)}
                      className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 cursor-pointer group flex justify-between items-center transition-colors"
                    >
                       <span className="font-medium text-sm text-gray-700 group-hover:text-blue-700">{p.name}</span>
                       <button 
                         onClick={(e) => initiateDeletePreset(p.id, e)}
                         className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                         title="删除预案"
                       >
                          <Trash2 size={14} className="pointer-events-none" />
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* --- DELETE CONFIRM MODAL --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-[100] flex items-center justify-center backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-80 animate-in zoom-in-95">
              <div className="flex flex-col items-center gap-4 text-center">
                 <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <Trash2 size={24} />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-gray-800">确认删除?</h3>
                    <p className="text-sm text-gray-500 mt-1">此操作将永久删除该预案配置，无法恢复。</p>
                 </div>
                 <div className="flex gap-3 w-full mt-2">
                    <button 
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                      取消
                    </button>
                    <button 
                      onClick={executeDeletePreset}
                      className="flex-1 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold"
                    >
                      删除
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ConfigPanel;
