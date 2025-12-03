import React, { useState, useEffect, useRef } from 'react';
import { QueueConfig, PRESET_THEMES, ContentType, QueueNumberStyle, PassedDisplayMode, ZoneConfig } from '../types';
import api from '../services/api';
import DisplayScreen from './DisplayScreen';
import MediaLibraryModal from './MediaLibraryModal';
import { 
  Settings, Layout, Type, Palette, Mic, Database, 
  Save, FolderOpen, RefreshCw, Smartphone, Monitor,
  Grid, Trash2, AlertTriangle, Check, CloudLightning, CloudOff, X, Maximize, Lock, Copy, Video, Image
} from 'lucide-react';
import { useToast } from './ToastProvider';
import { DEFAULT_CONFIG } from '../constants';

interface ConfigPanelProps {
  config: QueueConfig;
  onUpdateConfig: (newConfig: QueueConfig) => void;
  isConnected?: boolean;
}

const TABS = [
  { id: 'layout', label: '布局', icon: <Layout size={18} /> },
  { id: 'header', label: '头部', icon: <Type size={18} /> },
  { id: 'zones', label: '区域', icon: <Grid size={18} /> },
  { id: 'theme', label: '外观', icon: <Palette size={18} /> },
  { id: 'voice', label: '语音', icon: <Mic size={18} /> },
  { id: 'data', label: '数据', icon: <Database size={18} /> },
];

const ZONE_OPTIONS: { id: keyof QueueConfig['layout']; label: string }[] = [
  { id: 'topLeft', label: '左上区域' },
  { id: 'bottomLeft', label: '左下区域' },
  { id: 'topRight', label: '右上区域' },
  { id: 'bottomRight', label: '右下区域' },
];

const CONTENT_TYPES: { id: ContentType; label: string }[] = [
  { id: 'window-info', label: '窗口信息' },
  { id: 'current-call', label: '当前叫号' },
  { id: 'waiting-list', label: '等待队列' },
  { id: 'passed-list', label: '过号队列' },
  { id: 'video', label: '视频播放' },
  { id: 'static-text', label: '静态文本' },
  { id: 'hidden', label: '隐藏' },
];

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onUpdateConfig, isConnected }) => {
  const [activeTab, setActiveTab] = useState('layout');
  const [selectedZone, setSelectedZone] = useState<keyof QueueConfig['layout']>('topLeft');
  const toast = useToast();
  
  // State to track current editing context
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null);
  const [currentPresetName, setCurrentPresetName] = useState<string>('');

  // Modal States
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false); // NEW MODAL STATE
  const [presets, setPresets] = useState<{id: string, name: string}[]>([]);
  const [saveName, setSaveName] = useState('');
  
  // Media Library State
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<{ type: 'image'|'video', path: string[] } | null>(null);

  // Custom Delete Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Preview Scale Calculation
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  // Safe layout access
  const safeLayout = config.layout || DEFAULT_CONFIG.layout;
  const isLandscape = safeLayout.orientation === 'landscape';

  useEffect(() => {
    const calculateScale = () => {
        if (previewContainerRef.current) {
            const containerW = previewContainerRef.current.offsetWidth;
            const containerH = previewContainerRef.current.offsetHeight;
            
            // Safe access inside effect as well
            const currentOrientation = config.layout?.orientation || 'landscape';
            const targetW = currentOrientation === 'landscape' ? 1920 : 1080;
            const targetH = currentOrientation === 'landscape' ? 1080 : 1920;
            
            // Calculate ratios for both dimensions
            const scaleX = (containerW - 40) / targetW; // 40px padding
            const scaleY = (containerH - 40) / targetH;
            
            // Use the smaller scale to ensure it fits entirely
            setScale(Math.max(0.1, Math.min(scaleX, scaleY, 1)));
        }
    };
    
    // Recalculate initially and on resize
    const timer = setTimeout(calculateScale, 100);
    window.addEventListener('resize', calculateScale);
    return () => {
        window.removeEventListener('resize', calculateScale);
        clearTimeout(timer);
    };
  }, [config.layout?.orientation, activeTab]); 


  // Helper to update deep nested state
  const updateConfig = (newConfig: QueueConfig) => {
    onUpdateConfig(newConfig);
  };

  const handleUpdate = (path: string[], value: any) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {}; // Create if missing
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    updateConfig(newConfig);
  };

  // Open Media Library
  const openMediaLibrary = (type: 'image' | 'video', path: string[]) => {
      setMediaTarget({ type, path });
      setShowMediaModal(true);
  };

  const handleMediaSelect = (url: string) => {
      if (mediaTarget) {
          handleUpdate(mediaTarget.path, url);
      }
      setShowMediaModal(false);
      setMediaTarget(null);
  };

  // Keyboard Shortcut for Save (Ctrl+S) -> Triggers Update if ID exists, else Save As
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentPresetId) {
                handleOverwriteSave();
            } else {
                handleOpenSaveAsModal();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPresetId, currentPresetName, config]);

  // --- Load Logic ---
  useEffect(() => {
     if (showLoadModal) {
         if (isConnected) {
             api.admin.getPresets()
               .then(list => {
                   const safeList = list.map((p: any) => ({
                       id: p.id || p.Id,
                       name: p.name || p.Name
                   })).filter((p: any) => p.id);
                   setPresets(safeList);
               })
               .catch(e => {
                  if (e.message && e.message.includes('Failed to fetch')) return;
                  console.error(e);
                  toast.error('获取预案列表失败');
               });
         } else {
             try {
                const saved = localStorage.getItem('pharmacy-queue-presets');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setPresets(parsed.map((p: any) => ({ id: p.id, name: p.name })));
                }
             } catch(e) {
                 console.warn("LocalStorage read failed:", e);
             }
         }
     }
  }, [showLoadModal, isConnected]);

  const handleLoadPreset = async (id: string) => {
    // SPECIAL CASE: Loading System Default
    if (id === 'default') {
        // Create a deep copy of default config to prevent reference issues
        const defaultConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        defaultConfig.configVersion = `v${Date.now()}`;
        // Ensure registered flag is true so preview works immediately
        if (defaultConfig.system) defaultConfig.system.isRegistered = true;

        updateConfig(defaultConfig);
        
        // Reset preset tracking since this is a fresh start based on defaults
        setCurrentPresetId(null); 
        setCurrentPresetName('默认配置 (未保存)');
        
        setShowLoadModal(false);
        toast.success('已加载系统默认配置');
        return;
    }

    if (isConnected) {
        try {
            // FIX: api.admin.getPreset defined to return QueueConfig, but it likely returns the Preset wrapper
            // which contains config and name. We cast to any to avoid TS errors accessing .config and .name.
            const preset = await api.admin.getPreset(id) as any;
            if (preset && preset.config) {
                let configData = preset.config;
                if (typeof configData === 'string') {
                    try {
                        configData = JSON.parse(configData);
                    } catch (e) {
                        console.error("Failed to parse config JSON", e);
                        toast.error("预案数据损坏");
                        return;
                    }
                }
                configData.configVersion = `v${Date.now()}`;
                if (configData.system) configData.system.isRegistered = true;
                
                updateConfig(configData);
                
                // TRACK CURRENT PRESET
                setCurrentPresetId(id);
                setCurrentPresetName(preset.name || '未命名预案');
                
                setShowLoadModal(false);
                toast.success('预案加载成功');
            }
        } catch(e) { console.error(e); toast.error('加载失败'); }
        return;
    }

    try {
        const saved = localStorage.getItem('pharmacy-queue-presets');
        if (saved) {
           const list = JSON.parse(saved);
           const target = list.find((p: any) => p.id === id);
           if (target) {
              const loadedConfig = target.config;
              loadedConfig.configVersion = `v${Date.now()}`;
              if (loadedConfig.system) loadedConfig.system.isRegistered = true;
              
              updateConfig(loadedConfig);
              // TRACK CURRENT PRESET
              setCurrentPresetId(id);
              setCurrentPresetName(target.name);
              
              setShowLoadModal(false);
              toast.success('预案加载成功 (本地)');
           }
        }
    } catch(e) { toast.error("本地读取失败"); }
  };

  // --- Delete Logic ---
  const initiateDeletePreset = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     e.preventDefault();
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
             if (currentPresetId === id) {
                 setCurrentPresetId(null);
                 setCurrentPresetName('');
             }
             toast.success('删除成功');
         } catch(e: any) { 
             console.error("[ConfigPanel] Delete error:", e); 
             // Enhanced Error Handling for WebDAV/IIS issues
             let errMsg = e.message || 'API 请求错误';
             if (errMsg === 'Failed to fetch') {
                 errMsg = '连接失败。如果是 IIS 部署，请检查是否在 web.config 中移除了 WebDAV 模块 (IIS 默认拦截 DELETE 请求)。';
             }
             toast.error(`删除失败: ${errMsg}`);
         }
     } else {
         try {
             const saved = localStorage.getItem('pharmacy-queue-presets');
             if (saved) {
                const list = JSON.parse(saved);
                const newList = list.filter((p: any) => p.id !== id);
                localStorage.setItem('pharmacy-queue-presets', JSON.stringify(newList));
                setPresets(newList);
                if (currentPresetId === id) {
                    setCurrentPresetId(null);
                    setCurrentPresetName('');
                }
                toast.success('删除成功 (本地)');
             }
         } catch(e) { toast.error("本地删除失败"); }
     }
     setDeleteConfirmId(null);
  };

  // --- Save Logic (Update Existing) ---
  const handleOverwriteSave = () => {
      if (!currentPresetId) return;
      setShowOverwriteModal(true);
  };

  const executeOverwriteSave = async () => {
      if (!currentPresetId) return;
      
      console.log(`[ConfigPanel] Executing Overwrite Save. ID: ${currentPresetId}, Connected: ${isConnected}`);

      if (isConnected) {
          try {
              // Pass EXISTING ID to update
              await api.admin.savePreset(currentPresetId, currentPresetName, config);
              toast.success("更新成功");
              setShowOverwriteModal(false);
          } catch(e: any) {
              console.error(e);
              toast.error(`更新失败: ${e.message}`);
          }
          return;
      }

      // Local
      try {
          const saved = localStorage.getItem('pharmacy-queue-presets');
          let list = saved ? JSON.parse(saved) : [];
          const idx = list.findIndex((p:any) => p.id === currentPresetId);
          if (idx >= 0) {
              list[idx].config = config;
              list[idx].timestamp = Date.now();
              localStorage.setItem('pharmacy-queue-presets', JSON.stringify(list));
              toast.success("更新成功 (本地)");
          }
      } catch(e) { toast.error("本地保存失败"); }
      setShowOverwriteModal(false);
  };

  // --- Save As Logic (Create New) ---
  const handleOpenSaveAsModal = () => {
      setSaveName(currentPresetId ? `${currentPresetName} (副本)` : `预案-${new Date().toLocaleDateString()}`);
      setShowSaveAsModal(true);
  }

  const handleConfirmSaveAs = async () => {
      if(!saveName.trim()) return;
      
      // Generate NEW ID
      const newPresetId = `p-${Date.now()}`;
      
      const newPreset = {
          id: newPresetId,
          name: saveName,
          timestamp: Date.now(),
          config: config
      };

      if (isConnected) {
          try {
              // Pass NEW ID to create
              await api.admin.savePreset(newPreset.id, newPreset.name, newPreset.config);
              toast.success("另存为成功");
              // Switch context to new preset
              setCurrentPresetId(newPresetId);
              setCurrentPresetName(saveName);
              setShowSaveAsModal(false);
          } catch(e: any) {
              console.error(e);
              toast.error(`保存失败: ${e.message}`);
          }
          return;
      }

      // Local
      try {
          const saved = localStorage.getItem('pharmacy-queue-presets');
          const list = saved ? JSON.parse(saved) : [];
          list.push(newPreset);
          localStorage.setItem('pharmacy-queue-presets', JSON.stringify(list));
          toast.success("另存为成功 (本地)");
          
          setCurrentPresetId(newPresetId);
          setCurrentPresetName(saveName);
          setShowSaveAsModal(false);
      } catch(e) { toast.error("本地保存失败"); }
  }


  const renderZoneEditor = () => {
    // @ts-ignore
    const zone: ZoneConfig = config.layout?.[selectedZone] || { type: 'hidden' };
    const zoneKey = ['layout', selectedZone];
    const isList = zone.type === 'waiting-list' || zone.type === 'passed-list';
    const isWindow = zone.type === 'window-info';
    const isCurrent = zone.type === 'current-call';
    const isStatic = zone.type === 'static-text';
    const isVideo = zone.type === 'video';

    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">内容类型</label>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => handleUpdate([...zoneKey, 'type'], type.id)}
                className={`px-2 py-2 text-xs rounded-lg border text-left transition-all ${
                  zone.type === type.id 
                    ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-100' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {zone.type !== 'hidden' && (
          <>
            {!isWindow && !isStatic && !isCurrent && !isVideo && (
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs text-gray-500">标题文本</label>
                    <input 
                      type="text" 
                      value={zone.title || ''} 
                      onChange={(e) => handleUpdate([...zoneKey, 'title'], e.target.value)}
                      className="w-full border p-1 rounded text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-xs text-gray-500">颜色 / 字号</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={zone.titleColor || '#ffffff'} 
                        onChange={(e) => handleUpdate([...zoneKey, 'titleColor'], e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer"
                      />
                      <input 
                        type="number" 
                        value={zone.titleFontSize || 18} 
                        onChange={(e) => handleUpdate([...zoneKey, 'titleFontSize'], Number(e.target.value))}
                        className="w-full border p-1 rounded text-sm"
                        placeholder="Size"
                      />
                    </div>
                 </div>
              </div>
            )}

            {isList && (
              <div className="space-y-3 pt-2 border-t border-dashed">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">列数 (Cols)</label>
                    <input 
                      type="number" min="1" max="6"
                      value={zone.gridColumns || 1} 
                      onChange={(e) => handleUpdate([...zoneKey, 'gridColumns'], Number(e.target.value))}
                      className="w-full border p-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">行数 (Rows)</label>
                    <input 
                      type="number" min="1" max="20"
                      value={zone.gridRows || 3} 
                      onChange={(e) => handleUpdate([...zoneKey, 'gridRows'], Number(e.target.value))}
                      className="w-full border p-1 rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">内容字体大小 (px)</label>
                  <input 
                    type="range" min="12" max="60"
                    value={zone.contentFontSize || 20} 
                    onChange={(e) => handleUpdate([...zoneKey, 'contentFontSize'], Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="text-right text-xs text-gray-400">{zone.contentFontSize}px</div>
                </div>
                
                {zone.type === 'waiting-list' && (
                  <div className="space-y-2 pt-2 border-t border-dashed">
                    <div className="flex justify-between items-center">
                       <label className="text-xs text-gray-600 font-bold">合并显示"正在叫号"</label>
                       <input 
                         type="checkbox" 
                         checked={zone.includeCurrent || false} 
                         onChange={(e) => handleUpdate([...zoneKey, 'includeCurrent'], e.target.checked)}
                         className="accent-blue-600"
                       />
                    </div>
                    {zone.includeCurrent && (
                       <div className="flex justify-between items-center pl-4">
                          <label className="text-xs text-gray-500">特殊样式高亮</label>
                          <input 
                            type="checkbox" 
                            checked={zone.highlightCurrent !== false} 
                            onChange={(e) => handleUpdate([...zoneKey, 'highlightCurrent'], e.target.checked)}
                            className="accent-blue-600"
                          />
                       </div>
                    )}
                  </div>
                )}
              </div>
            )}

           {isVideo && (
             <div className="space-y-3 pt-2 border-t border-dashed">
                <div>
                   <label className="block text-xs font-bold text-gray-600 mb-1">视频地址 (Video URL)</label>
                   <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                         <input 
                            type="text" 
                            value={zone.videoUrl || ''} 
                            onChange={(e) => handleUpdate([...zoneKey, 'videoUrl'], e.target.value)}
                            className="w-full border p-1.5 pl-7 rounded text-sm"
                            placeholder="http://example.com/video.mp4"
                         />
                         <Video size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                      </div>
                      <button 
                         onClick={() => openMediaLibrary('video', [...zoneKey, 'videoUrl'])}
                         className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 px-2 py-1.5 rounded text-xs whitespace-nowrap"
                         title="从媒体库选择"
                      >
                         <FolderOpen size={14} />
                      </button>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-1">支持 .mp4, .webm 格式链接</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="flex justify-between items-center border p-2 rounded bg-gray-50">
                      <label className="text-xs text-gray-600">默认静音</label>
                      <input 
                         type="checkbox" 
                         checked={zone.videoMuted !== false} 
                         onChange={(e) => handleUpdate([...zoneKey, 'videoMuted'], e.target.checked)}
                         className="accent-blue-600"
                      />
                   </div>
                   <div className="flex justify-between items-center border p-2 rounded bg-gray-50">
                      <label className="text-xs text-gray-600">循环播放</label>
                      <input 
                         type="checkbox" 
                         checked={zone.videoLoop !== false} 
                         onChange={(e) => handleUpdate([...zoneKey, 'videoLoop'], e.target.checked)}
                         className="accent-blue-600"
                      />
                   </div>
                </div>
                
                <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-[10px] text-yellow-700">
                    <AlertTriangle size={12} className="inline mr-1" />
                    注意：浏览器通常会阻止自动播放带声音的视频。为了确保自动播放生效，建议勾选“默认静音”。
                </div>

                <div>
                   <label className="block text-xs text-gray-500 mb-1">填充模式 (Object Fit)</label>
                   <select 
                      value={zone.videoFit || 'cover'}
                      onChange={(e) => handleUpdate([...zoneKey, 'videoFit'], e.target.value)}
                      className="w-full border p-1.5 rounded text-sm"
                   >
                      <option value="cover">覆盖填充 (Cover) - 裁剪多余</option>
                      <option value="contain">完整显示 (Contain) - 留黑边</option>
                      <option value="fill">拉伸填充 (Fill) - 可能变形</option>
                   </select>
                </div>
             </div>
           )}

           {isWindow && (
             <div className="space-y-3 pt-2 border-t border-dashed">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-600 font-bold">显示窗口号</label>
                  <input 
                    type="checkbox" 
                    checked={zone.showWindowNumber !== false} 
                    onChange={(e) => handleUpdate([...zoneKey, 'showWindowNumber'], e.target.checked)} 
                    className="accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">窗口号大小</label>
                  <input 
                     type="range" min="40" max="150"
                     value={zone.windowNumberFontSize || 80}
                     onChange={(e) => handleUpdate([...zoneKey, 'windowNumberFontSize'], Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">窗口名大小</label>
                  <input 
                     type="range" min="16" max="60"
                     value={zone.windowNameFontSize || 32}
                     onChange={(e) => handleUpdate([...zoneKey, 'windowNameFontSize'], Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                
                <div className="pt-2 border-t border-dashed">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-gray-600 font-bold">显示副标题</label>
                      <input 
                        type="checkbox" 
                        checked={zone.showWindowSubTitle !== false} 
                        onChange={(e) => handleUpdate([...zoneKey, 'showWindowSubTitle'], e.target.checked)} 
                        className="accent-blue-600"
                      />
                    </div>
                    {zone.showWindowSubTitle !== false && (
                      <textarea 
                        rows={2}
                        value={zone.windowSubTitleHtml || ''}
                        onChange={(e) => handleUpdate([...zoneKey, 'windowSubTitleHtml'], e.target.value)}
                        className="w-full text-[10px] border p-1 rounded font-mono text-gray-600"
                        placeholder="<div class='text-lg'>请排队...</div>"
                      />
                    )}
                </div>
             </div>
           )}

            {isStatic && (
              <div className="space-y-2 pt-2 border-t border-dashed">
                <label className="text-xs text-gray-500">HTML 内容</label>
                <textarea 
                  rows={4}
                  value={zone.staticTextContent || ''}
                  onChange={(e) => handleUpdate([...zoneKey, 'staticTextContent'], e.target.value)}
                  className="w-full border p-2 rounded text-xs font-mono"
                  placeholder="<div>通知...</div>"
                />
                <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="text-xs text-gray-500">背景色</label>
                     <input type="color" value={zone.staticBgColor || '#ffffff'} onChange={e => handleUpdate([...zoneKey, 'staticBgColor'], e.target.value)} className="w-full h-8"/>
                   </div>
                   <div>
                     <label className="text-xs text-gray-500">文字色</label>
                     <input type="color" value={zone.staticTextColor || '#000000'} onChange={e => handleUpdate([...zoneKey, 'staticTextColor'], e.target.value)} className="w-full h-8"/>
                   </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const previewWidth = isLandscape ? 1920 : 1080;
  const previewHeight = isLandscape ? 1080 : 1920;

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden bg-gray-100">
       
       {/* Top Bar */}
       <div className="shrink-0 flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Settings className="text-blue-600" />
                  预案设计
                  <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'} shadow-sm`} title={isConnected ? 'Connected' : 'Offline'}></span>
              </h2>
              {currentPresetId && (
                  <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200 flex items-center gap-1">
                      <span className="font-bold">当前编辑:</span> {currentPresetName}
                  </div>
              )}
          </div>
          <div className="flex gap-2">
              <button 
                  onClick={() => setShowLoadModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm text-gray-700 text-sm font-medium transition-all"
              >
                  <FolderOpen size={16} /> 
                  加载
              </button>

              <div className="h-8 w-px bg-gray-300 mx-1"></div>

              {/* Update Existing Button */}
              <button 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md shadow-sm text-sm font-medium transition-all ${
                      currentPresetId 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleOverwriteSave}
                  disabled={!currentPresetId}
                  title={currentPresetId ? `更新预案: ${currentPresetName}` : "请先加载或保存一个预案"}
              >
                  <RefreshCw size={16} /> 
                  覆盖保存
              </button>

              {/* Save As Button */}
              <button 
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-medium transition-all"
                  onClick={handleOpenSaveAsModal}
              >
                  <Copy size={16} /> 
                  另存为
              </button>
          </div>
       </div>

       {/* Main Split Layout */}
       <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          
          {/* LEFT: Config Editor (Scrollable) */}
          <div className="w-[420px] shrink-0 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
             
             {/* Tab Navigation */}
             <div className="flex overflow-x-auto border-b bg-gray-50 scrollbar-hide">
                {TABS.map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id)}
                     className={`flex-none flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id 
                          ? 'border-blue-600 text-blue-600 bg-white' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                     }`}
                   >
                      {tab.icon}
                      {tab.label.split(' ')[0]} {/* Show short label */}
                   </button>
                ))}
             </div>

             {/* Config Content Area */}
             <div className="flex-1 overflow-y-auto p-5">
                {activeTab === 'layout' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">屏幕方向</label>
                          <div className="flex gap-2">
                            <button 
                               onClick={() => handleUpdate(['layout', 'orientation'], 'landscape')}
                               className={`flex-1 py-1.5 rounded text-xs border ${safeLayout.orientation === 'landscape' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
                            >
                               横屏 (16:9)
                            </button>
                            <button 
                               onClick={() => handleUpdate(['layout', 'orientation'], 'portrait')}
                               className={`flex-1 py-1.5 rounded text-xs border ${safeLayout.orientation === 'portrait' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
                            >
                               竖屏 (9:16)
                            </button>
                          </div>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">主分割比 ({safeLayout.splitRatio}%)</label>
                           <input 
                             type="range" min="20" max="80" 
                             value={safeLayout.splitRatio} 
                             onChange={(e) => handleUpdate(['layout', 'splitRatio'], Number(e.target.value))}
                             className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                           />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">左侧上下比 ({safeLayout.leftSplitRatio ?? 50}%)</label>
                           <input 
                            type="range" min="20" max="80" 
                            value={safeLayout.leftSplitRatio ?? 50} 
                            onChange={(e) => handleUpdate(['layout', 'leftSplitRatio'], Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">右侧上下比 ({safeLayout.rightSplitRatio ?? 50}%)</label>
                           <input 
                            type="range" min="20" max="80" 
                            value={safeLayout.rightSplitRatio ?? 50} 
                            onChange={(e) => handleUpdate(['layout', 'rightSplitRatio'], Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">间距 (Gap)</label>
                           <input 
                             type="number" value={safeLayout.gap} 
                             onChange={(e) => handleUpdate(['layout', 'gap'], Number(e.target.value))}
                             className="w-full border p-1.5 rounded text-sm"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">内边距 (Padding)</label>
                           <input 
                             type="number" value={safeLayout.containerPadding} 
                             onChange={(e) => handleUpdate(['layout', 'containerPadding'], Number(e.target.value))}
                             className="w-full border p-1.5 rounded text-sm"
                           />
                        </div>
                    </div>

                    <div className="bg-orange-50 p-3 rounded border border-orange-100">
                       <label className="block text-xs font-bold text-orange-800 mb-1">电视安全边距 (Overscan)</label>
                       <div className="flex items-center gap-3">
                           <input 
                             type="range" min="0" max="100" 
                             value={safeLayout.overscanPadding || 0} 
                             onChange={(e) => handleUpdate(['layout', 'overscanPadding'], Number(e.target.value))}
                             className="flex-1 h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                           />
                           <span className="text-xs font-mono font-bold text-orange-700">{safeLayout.overscanPadding || 0}px</span>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'header' && (
                  <div className="space-y-4">
                     <div className="flex items-center justify-between border-b pb-2">
                        <label className="text-sm font-bold text-gray-700">显示头部</label>
                        <input 
                          type="checkbox" 
                          checked={config.header?.show ?? DEFAULT_CONFIG.header.show} 
                          onChange={(e) => handleUpdate(['header', 'show'], e.target.checked)}
                          className="accent-blue-600 w-5 h-5"
                        />
                     </div>
                     <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">主标题 (医院名称)</label>
                          <input 
                            type="text" value={config.header?.hospitalName || ''} 
                            onChange={(e) => handleUpdate(['header', 'hospitalName'], e.target.value)}
                            className="w-full border p-1.5 rounded text-sm"
                          />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-600 mb-1">Logo 设置</label>
                           <select 
                                value={config.header?.logoType || 'default'}
                                onChange={(e) => handleUpdate(['header', 'logoType'], e.target.value)}
                                className="w-full border p-1.5 rounded text-sm mb-2"
                           >
                               <option value="default">默认图标</option>
                               <option value="image">自定义图片</option>
                               <option value="hidden">隐藏</option>
                           </select>

                           {config.header?.logoType === 'image' && (
                               <div className="flex gap-2 items-center">
                                   <div className="flex-1 relative">
                                       <input 
                                           type="text" 
                                           value={config.header?.logoUrl || ''} 
                                           onChange={(e) => handleUpdate(['header', 'logoUrl'], e.target.value)}
                                           placeholder="Logo URL"
                                           className="w-full border p-1.5 pl-7 rounded text-sm"
                                       />
                                       <Image size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                                   </div>
                                   <button 
                                      onClick={() => openMediaLibrary('image', ['header', 'logoUrl'])}
                                      className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 px-2 py-1.5 rounded text-xs whitespace-nowrap"
                                   >
                                      <FolderOpen size={14} />
                                   </button>
                               </div>
                           )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">副标题 (中间文本)</label>
                          <input 
                            type="text" value={config.header?.centerTitle || ''} 
                            onChange={(e) => handleUpdate(['header', 'centerTitle'], e.target.value)}
                            className="w-full border p-1.5 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">右侧内容</label>
                          <select 
                            value={config.header?.rightContentType || 'time'}
                            onChange={(e) => handleUpdate(['header', 'rightContentType'], e.target.value)}
                            className="w-full border p-1.5 rounded text-sm"
                          >
                             <option value="time">显示时间</option>
                             <option value="text">自定义文本</option>
                             <option value="hidden">隐藏</option>
                          </select>
                        </div>
                     </div>
                  </div>
                )}

                {activeTab === 'zones' && (
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 mb-4">
                         {ZONE_OPTIONS.map(z => (
                            <button
                              key={z.id}
                              onClick={() => setSelectedZone(z.id)}
                              className={`text-xs px-2 py-2 rounded border transition-colors ${
                                selectedZone === z.id 
                                  ? 'bg-gray-800 text-white border-gray-800' 
                                  : 'bg-white text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {z.label}
                            </button>
                         ))}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                         {renderZoneEditor()}
                      </div>
                   </div>
                )}
                
                {activeTab === 'theme' && (
                   <div className="space-y-4">
                      {/* Presets */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2">预设主题 (Presets)</label>
                        <div className="grid grid-cols-2 gap-3">
                           {Object.entries(PRESET_THEMES).map(([key, theme]) => (
                              <button 
                                key={key}
                                onClick={() => updateConfig({...config, theme: {...theme}})}
                                className={`p-2 border rounded-lg flex items-center gap-2 ${
                                   JSON.stringify(config.theme) === JSON.stringify(theme) ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'
                                }`}
                              >
                                 <div className="w-6 h-6 rounded-full shadow-sm border border-gray-100" style={{ background: theme.primary }}></div>
                                 <span className="capitalize text-xs font-bold">{key}</span>
                              </button>
                           ))}
                        </div>
                      </div>

                      <div className="border-t border-dashed my-2"></div>

                      {/* Custom Colors */}
                      <div>
                         <label className="block text-xs font-bold text-gray-500 mb-2">自定义颜色 (Custom Colors)</label>
                         <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-3">
                            <div className="flex items-center gap-3">
                               <input 
                                  type="color" 
                                  value={config.theme?.primary || '#000000'} 
                                  onChange={(e) => handleUpdate(['theme', 'primary'], e.target.value)}
                                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                               />
                               <div className="flex-1">
                                  <label className="block text-xs font-medium text-gray-700">主色调 (Primary)</label>
                                  <div className="text-[10px] text-gray-400 uppercase font-mono">{config.theme?.primary}</div>
                               </div>
                            </div>

                            <div className="flex items-center gap-3">
                               <input 
                                  type="color" 
                                  value={config.theme?.secondary || '#000000'} 
                                  onChange={(e) => handleUpdate(['theme', 'secondary'], e.target.value)}
                                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                               />
                               <div className="flex-1">
                                  <label className="block text-xs font-medium text-gray-700">次色调 (Secondary)</label>
                                  <div className="text-[10px] text-gray-400 uppercase font-mono">{config.theme?.secondary}</div>
                               </div>
                            </div>

                            <div className="flex items-center gap-3">
                               <input 
                                  type="color" 
                                  value={config.theme?.background || '#ffffff'} 
                                  onChange={(e) => handleUpdate(['theme', 'background'], e.target.value)}
                                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                               />
                               <div className="flex-1">
                                  <label className="block text-xs font-medium text-gray-700">背景色 (Background)</label>
                                  <div className="text-[10px] text-gray-400 uppercase font-mono">{config.theme?.background}</div>
                               </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                               <input 
                                  type="color" 
                                  value={config.theme?.textOnPrimary || '#ffffff'} 
                                  onChange={(e) => handleUpdate(['theme', 'textOnPrimary'], e.target.value)}
                                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                               />
                               <div className="flex-1">
                                  <label className="block text-xs font-medium text-gray-700">主色文字 (Text On Primary)</label>
                                  <div className="text-[10px] text-gray-400 uppercase font-mono">{config.theme?.textOnPrimary}</div>
                               </div>
                            </div>

                            {/* New Colors */}
                            <div className="border-t border-dashed my-2"></div>
                            
                            <div className="flex items-center gap-3">
                               <input 
                                  type="color" 
                                  value={config.theme?.cardBackground || '#ffffff'} 
                                  onChange={(e) => handleUpdate(['theme', 'cardBackground'], e.target.value)}
                                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                               />
                               <div className="flex-1">
                                  <label className="block text-xs font-medium text-gray-700">卡片背景色 (Card BG)</label>
                                  <div className="text-[10px] text-gray-400 uppercase font-mono">{config.theme?.cardBackground || '#ffffff'}</div>
                               </div>
                            </div>

                            <div className="flex items-center gap-3">
                               <input 
                                  type="color" 
                                  value={config.theme?.textMain || '#111827'} 
                                  onChange={(e) => handleUpdate(['theme', 'textMain'], e.target.value)}
                                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                               />
                               <div className="flex-1">
                                  <label className="block text-xs font-medium text-gray-700">内容文字色 (Main Text)</label>
                                  <div className="text-[10px] text-gray-400 uppercase font-mono">{config.theme?.textMain || '#111827'}</div>
                               </div>
                            </div>

                         </div>
                      </div>

                      <div className="border-t border-dashed my-2"></div>

                      <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">卡片圆角 ({config.cardRounded}px)</label>
                         <input 
                           type="range" min="0" max="30" 
                           value={config.cardRounded} 
                           onChange={(e) => handleUpdate(['cardRounded'], Number(e.target.value))}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                   </div>
                )}
                
                {/* Voice Tab */}
                {activeTab === 'voice' && (
                   <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                         <input 
                           type="checkbox" 
                           checked={config.speech?.enabled ?? true} 
                           onChange={(e) => handleUpdate(['speech', 'enabled'], e.target.checked)}
                           className="accent-blue-600"
                         />
                         <span className="text-sm font-bold">启用语音播报</span>
                      </div>
                      <div className="space-y-3">
                         <div>
                             <label className="block text-xs font-bold text-gray-600 mb-1">广播模式</label>
                             <div className="grid grid-cols-2 gap-2 text-xs">
                                 <button 
                                     onClick={() => handleUpdate(['speech', 'broadcastMode'], 'all')}
                                     className={`py-1.5 border rounded ${config.speech?.broadcastMode === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}
                                 >
                                     全部广播 (Central)
                                 </button>
                                 <button 
                                     onClick={() => handleUpdate(['speech', 'broadcastMode'], 'local')}
                                     className={`py-1.5 border rounded ${config.speech?.broadcastMode === 'local' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}
                                 >
                                     仅当前窗口 (Local)
                                 </button>
                             </div>
                         </div>
                         
                         {config.speech?.broadcastMode === 'local' && (
                             <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                 <label className="block text-xs font-bold text-blue-700 mb-1">本地窗口身份 (Window No.)</label>
                                 <input 
                                     type="text" 
                                     value={config.windowNumber || ''}
                                     onChange={(e) => handleUpdate(['windowNumber'], e.target.value)}
                                     placeholder="例如: 2"
                                     className="w-full border p-1.5 rounded text-sm font-mono"
                                 />
                                 <p className="text-[10px] text-blue-500 mt-1">只有分配给此窗口号的叫号才会播报语音。</p>
                             </div>
                         )}

                         <div>
                            <label className="block text-xs text-gray-500 mb-1">播报模板</label>
                            <input 
                                type="text" 
                                value={config.speech?.template || ''}
                                onChange={(e) => handleUpdate(['speech', 'template'], e.target.value)}
                                className="w-full border p-1.5 rounded text-sm"
                            />
                            <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-gray-400">
                                <span>{'{number}'}号</span>
                                <span>{'{name}'}名</span>
                                <span>{'{window}'}窗</span>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                               <label className="text-xs text-gray-500">音量</label>
                               <input type="range" min="0" max="1" step="0.1" value={config.speech?.volume ?? 1} onChange={e => handleUpdate(['speech', 'volume'], Number(e.target.value))} className="w-full h-1.5"/>
                            </div>
                            <div>
                               <label className="text-xs text-gray-500">语速</label>
                               <input type="range" min="0.5" max="2" step="0.1" value={config.speech?.rate ?? 1} onChange={e => handleUpdate(['speech', 'rate'], Number(e.target.value))} className="w-full h-1.5"/>
                            </div>
                         </div>
                      </div>
                   </div>
                )}
                
                {activeTab === 'data' && (
                    <div className="space-y-6">
                        {/* Data Source Mode */}
                        <div className="bg-white rounded border p-3 shadow-sm">
                            <label className="block text-xs font-bold text-gray-700 mb-2">数据获取模式 (Data Mode)</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdate(['dataSource', 'mode'], 'push')}
                                    className={`flex-1 py-2 rounded text-xs border font-medium ${config.dataSource?.mode === 'push' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600'}`}
                                >
                                    API 推送 (Push/Simulate)
                                </button>
                                <button
                                    onClick={() => handleUpdate(['dataSource', 'mode'], 'pull')}
                                    className={`flex-1 py-2 rounded text-xs border font-medium ${config.dataSource?.mode === 'pull' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600'}`}
                                >
                                    直连数据库 (Pull)
                                </button>
                            </div>
                        </div>

                        {/* Polling Config */}
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs text-gray-500 mb-1">轮询间隔 (秒)</label>
                                <input 
                                    type="number" min="1" max="60"
                                    value={config.dataSource?.pollingInterval || 5}
                                    onChange={(e) => handleUpdate(['dataSource', 'pollingInterval'], Number(e.target.value))}
                                    className="w-full border p-1.5 rounded text-sm"
                                />
                             </div>
                             <div>
                                <label className="block text-xs text-gray-500 mb-1">轮询策略</label>
                                <select 
                                    value={config.dataSource?.pollingStrategy || 'realtime'}
                                    onChange={(e) => handleUpdate(['dataSource', 'pollingStrategy'], e.target.value)}
                                    className="w-full border p-1.5 rounded text-sm"
                                >
                                    <option value="realtime">实时轮询 (Realtime)</option>
                                    <option value="smart">智能省流 (Smart)</option>
                                </select>
                             </div>
                        </div>

                        {/* Pull Mode Specifics */}
                        {config.dataSource?.mode === 'pull' && (
                            <div className="space-y-4 pt-2 border-t border-dashed animate-in fade-in">
                                <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200 flex items-start gap-2">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <div>
                                        直连模式下，后端服务将直接查询第三方数据库视图。请确保连接字符串正确且后端服务器有访问权限。
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <label className="block text-xs text-gray-500 mb-1">数据库类型</label>
                                        <select 
                                            value={config.dataSource?.dbType || 'sqlserver'}
                                            onChange={(e) => handleUpdate(['dataSource', 'dbType'], e.target.value)}
                                            className="w-full border p-1.5 rounded text-sm"
                                        >
                                            <option value="sqlserver">SQL Server</option>
                                            <option value="mysql">MySQL</option>
                                            <option value="oracle">Oracle</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">视图/表名</label>
                                        <input 
                                            type="text" 
                                            value={config.dataSource?.tableName || ''}
                                            onChange={(e) => handleUpdate(['dataSource', 'tableName'], e.target.value)}
                                            placeholder="VIEW_PHARMACY_QUEUE"
                                            className="w-full border p-1.5 rounded text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">连接字符串 (Connection String)</label>
                                    <textarea 
                                        rows={2}
                                        value={config.dataSource?.dbConnectionString || ''}
                                        onChange={(e) => handleUpdate(['dataSource', 'dbConnectionString'], e.target.value)}
                                        placeholder="Server=127.0.0.1;Database=HIS;User Id=sa;Password=..."
                                        className="w-full border p-1.5 rounded text-xs font-mono"
                                    />
                                    <button 
                                        onClick={() => toast.info("连接测试功能需后端支持 (请保存后查看后端日志)")}
                                        className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <CloudLightning size={10} /> 测试数据库连接
                                    </button>
                                </div>

                                {/* Field Mapping */}
                                <div className="pt-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-2">字段映射 (Field Mapping)</label>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {['id', 'name', 'number', 'status', 'windowId', 'order'].map(field => (
                                            <div key={field} className="flex items-center gap-2">
                                                <span className="w-16 text-gray-500 text-right capitalize">{field}:</span>
                                                <input 
                                                    type="text"
                                                    value={(config.dataSource?.fieldMap as any)?.[field] || ''}
                                                    onChange={(e) => handleUpdate(['dataSource', 'fieldMap', field], e.target.value)}
                                                    className="flex-1 border p-1 rounded font-mono"
                                                    placeholder={`db_${field}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Status Mapping */}
                                <div className="pt-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-2">状态值映射 (Status Values)</label>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <label className="block text-gray-500 mb-1">等待 (Wait)</label>
                                            <input 
                                                type="text" 
                                                value={config.dataSource?.statusMap?.waitingValue || ''}
                                                onChange={(e) => handleUpdate(['dataSource', 'statusMap', 'waitingValue'], e.target.value)}
                                                className="w-full border p-1 rounded text-center"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 mb-1">叫号 (Call)</label>
                                            <input 
                                                type="text" 
                                                value={config.dataSource?.statusMap?.calledValue || ''}
                                                onChange={(e) => handleUpdate(['dataSource', 'statusMap', 'calledValue'], e.target.value)}
                                                className="w-full border p-1 rounded text-center"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 mb-1">过号 (Pass)</label>
                                            <input 
                                                type="text" 
                                                value={config.dataSource?.statusMap?.passedValue || ''}
                                                onChange={(e) => handleUpdate(['dataSource', 'statusMap', 'passedValue'], e.target.value)}
                                                className="w-full border p-1 rounded text-center"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

             </div>
          </div>

          {/* RIGHT: Live Preview (Sticky) */}
          <div className="flex-1 h-full overflow-hidden flex flex-col items-center bg-gray-900 rounded-xl shadow-lg border border-gray-800 relative">
              <div className="w-full bg-gray-800 px-4 py-2 flex justify-between items-center text-xs text-gray-400 border-b border-gray-700 shrink-0">
                  <div className="flex items-center gap-2">
                      <Monitor size={14} className="text-blue-400"/>
                      <span className="font-bold text-gray-200">实时预览 (Live Preview)</span>
                  </div>
                  <div className="font-mono">{isLandscape ? '1920x1080' : '1080x1920'} | Scale: {Math.round(scale * 100)}%</div>
              </div>
              
              <div ref={previewContainerRef} className="flex-1 w-full overflow-hidden flex items-center justify-center p-4">
                  <div 
                     className="bg-black shadow-2xl overflow-hidden transition-all duration-300 ease-in-out border border-gray-700 origin-center"
                     style={{
                        width: `${previewWidth}px`,
                        height: `${previewHeight}px`,
                        transform: `scale(${scale})`,
                     }}
                  >
                     <DisplayScreen config={config} />
                  </div>
              </div>
          </div>
       </div>

       {/* Media Library Modal */}
       <MediaLibraryModal 
           isOpen={showMediaModal}
           onClose={() => setShowMediaModal(false)}
           onSelect={handleMediaSelect}
           allowedTypes={mediaTarget?.type === 'video' ? 'video' : 'image'}
           isConnected={isConnected}
       />

       {/* ... Other Modals ... */}
       {/* (Keeping the modals as they were in the previous version) */}
       {showLoadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-in fade-in zoom-in-95 relative">
                    <button onClick={() => setShowLoadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18}/></button>
                    <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2"><FolderOpen size={20}/> 选择预案</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        <button onClick={() => handleLoadPreset('default')} className="w-full text-left p-3 hover:bg-blue-50 hover:text-blue-700 rounded border border-transparent hover:border-blue-100 transition-all font-medium">
                            默认预案 (System Default)
                        </button>
                        {presets.map(p => (
                            <div key={p.id} className="group flex items-center gap-2">
                                <button onClick={() => handleLoadPreset(p.id)} className="flex-1 text-left p-3 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-100 hover:border-blue-100 transition-all text-sm text-gray-600">
                                    {p.name}
                                </button>
                                <button 
                                  onClick={(e) => initiateDeletePreset(p.id, e)}
                                  className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded border border-transparent transition-all opacity-0 group-hover:opacity-100 pointer-events-auto"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        
        {showSaveAsModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-in zoom-in-95">
                    <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2"><Copy size={20}/> 另存为新预案</h3>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">新预案名称</label>
                        <input 
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="请输入名称..."
                        />
                    </div>
                    <div className="flex gap-3 w-full">
                         <button 
                            onClick={() => setShowSaveAsModal(false)}
                            className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-gray-600 font-medium"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleConfirmSaveAs}
                            disabled={!saveName.trim()}
                            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
                        >
                            确认保存
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showOverwriteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-80 animate-in zoom-in-95">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <RefreshCw size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">确认覆盖更新?</h3>
                            <p className="text-gray-500 text-sm mt-1">
                                将更新预案: <strong>{currentPresetName}</strong>
                            </p>
                        </div>
                        <div className="flex gap-3 w-full mt-2">
                            <button 
                                onClick={() => setShowOverwriteModal(false)}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-gray-600 font-medium"
                            >
                                取消
                            </button>
                            <button 
                                onClick={executeOverwriteSave}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                            >
                                确认更新
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {deleteConfirmId && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-80 animate-in zoom-in-95">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">确认删除?</h3>
                            <p className="text-gray-500 text-sm mt-1">删除后将无法恢复此预案。</p>
                        </div>
                        <div className="flex gap-3 w-full mt-2">
                            <button 
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-gray-600 font-medium"
                            >
                                取消
                            </button>
                            <button 
                                onClick={executeDeletePreset}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
                            >
                                确认删除
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