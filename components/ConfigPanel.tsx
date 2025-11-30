
import React, { useState, useEffect } from 'react';
import { QueueConfig, Preset, ContentType, PRESET_THEMES, QueueNumberStyle, DatabaseType, PassedDisplayMode } from '../types';
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
  Clock
} from 'lucide-react';

interface ConfigPanelProps {
  config: QueueConfig;
  updateConfig: (newConfig: QueueConfig) => void;
}

// Helper to deep update config
const deepUpdate = (obj: any, path: string[], value: any): any => {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  return {
    ...obj,
    [head]: tail.length === 0 ? value : deepUpdate(obj[head], tail, value)
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
                  <label className="text-[10px] text-gray-600 font-bold">显示状态标题 (Show Title)</label>
                  <input 
                    type="checkbox" 
                    checked={zone.showCurrentTitle !== false} 
                    onChange={(e) => onUpdate(zoneKey, 'showCurrentTitle', e.target.checked)} 
                    className="accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">标题文本 (Title Text)</label>
                  <input 
                    type="text" 
                    value={zone.currentTitleText || '正在取药'} 
                    onChange={(e) => onUpdate(zoneKey, 'currentTitleText', e.target.value)}
                    className="w-full text-xs border p-1 rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">状态标题大小 (Title Size)</label>
                  <input 
                     type="range" min="16" max="48"
                     value={zone.currentTitleFontSize || 24}
                     onChange={(e) => onUpdate(zoneKey, 'currentTitleFontSize', Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">姓名大小 (Name Size)</label>
                  <input 
                     type="range" min="30" max="120"
                     value={zone.currentNameFontSize || 60}
                     onChange={(e) => onUpdate(zoneKey, 'currentNameFontSize', Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1">号码大小 (Number Size)</label>
                  <input 
                     type="range" min="20" max="80"
                     value={zone.currentNumberFontSize || 36}
                     onChange={(e) => onUpdate(zoneKey, 'currentNumberFontSize', Number(e.target.value))}
                     className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
           )}
           
           {zone.type === 'static-text' && (
              <div className="pt-2 border-t border-dashed border-gray-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">HTML 内容</span>
                  <button 
                    onClick={() => onUpdate(zoneKey, 'staticTextContent', '<div style="padding:10px;"><h2>默认公告</h2><p>请在此输入内容...</p></div>')}
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    使用模板
                  </button>
                </div>
                <textarea 
                  rows={4}
                  placeholder="<div>支持HTML...</div>"
                  value={zone.staticTextContent || ''}
                  onChange={(e) => onUpdate(zoneKey, 'staticTextContent', e.target.value)}
                  className="w-full text-xs border p-1 rounded font-mono text-gray-600"
                />
                <div className="flex gap-1">
                   <input 
                    type="color" 
                    title="文字颜色"
                    value={zone.staticTextColor || '#000000'} 
                    onChange={(e) => onUpdate(zoneKey, 'staticTextColor', e.target.value)} 
                    className="h-6 w-8 border p-0 rounded cursor-pointer"
                  />
                   <input 
                    type="color" 
                    title="背景颜色"
                    value={zone.staticBgColor || '#ffffff'} 
                    onChange={(e) => onUpdate(zoneKey, 'staticBgColor', e.target.value)} 
                    className="h-6 w-8 border p-0 rounded cursor-pointer"
                  />
                   <input 
                    type="number" 
                    title="默认字号"
                    value={zone.staticTextSize || 24} 
                    onChange={(e) => onUpdate(zoneKey, 'staticTextSize', Number(e.target.value))} 
                    className="w-full text-xs border p-1 rounded"
                  />
                </div>
              </div>
           )}
        </div>
      )}
    </div>
  );
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, updateConfig }) => {
  const [activeTab, setActiveTab] = useState<'design' | 'style' | 'data' | 'system' | 'voice'>('design');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  
  // UI State for saving
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  // UI State for DB Connection Test
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // UI State for collapsibles
  const [sections, setSections] = useState({
    header: true,
    layout: true,
    footer: true
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Preset Management ---
  useEffect(() => {
    const saved = localStorage.getItem('pharmacy-queue-presets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPresets(parsed);
      } catch (e) {
        console.error('Failed to load presets', e);
      }
    }
  }, []);

  const savePresetsToStorage = (newPresets: Preset[]) => {
    localStorage.setItem('pharmacy-queue-presets', JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const handleOpenSaveModal = () => {
    setPresetName(`预案 ${presets.length + 1}`);
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    if (!presetName.trim()) return;

    const newPreset: Preset = {
      id: Date.now().toString(),
      name: presetName,
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(config)) // Deep copy
    };
    
    const newList = [...presets, newPreset];
    savePresetsToStorage(newList);
    setSelectedPresetId(newPreset.id);
    setShowSaveModal(false);
  };

  const handleLoadPreset = (id: string) => {
    const preset = presets.find(p => p.id === id);
    if (preset) {
      updateConfig(preset.config);
      setSelectedPresetId(id);
    }
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) return;
    if (!confirm('确定要删除这个预案吗?')) return;
    const newList = presets.filter(p => p.id !== selectedPresetId);
    savePresetsToStorage(newList);
    setSelectedPresetId('');
  };

  // Keyboard shortcut for saving (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!showSaveModal) {
          handleOpenSaveModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presets, showSaveModal]);

  // --- Config Helpers ---
  const update = (path: string[], value: any) => {
    // Whenever we update layout/design, we simulate a version bump for Hot Reload
    const updated = deepUpdate(config, path, value);
    updated.configVersion = `v${Date.now()}`; // Bump version
    updateConfig(updated);
  };

  const handleZoneChange = (zoneKey: string, field: string, value: any) => {
    update(['layout', zoneKey, field], value);
  };

  const handleTestVoice = () => {
    if ('speechSynthesis' in window) {
      const text = config.speech.template
        .replace(/{name}/g, '张三')
        .replace(/{number}/g, 'A001')
        .replace(/{window}/g, config.windowName || '窗口');
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = config.speech.volume;
      utterance.rate = config.speech.rate;
      utterance.pitch = config.speech.pitch;
      utterance.lang = 'zh-CN';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('您的浏览器不支持语音合成');
    }
  };

  // --- Mock API for DB Testing ---
  const handleTestDbConnection = async () => {
    setTestStatus('loading');
    setTestMessage('正在尝试连接数据库...');

    // Simulate Network Delay
    setTimeout(() => {
      const { dbConnectionString, dbType, tableName } = config.dataSource;
      
      // Mock Validation Logic
      if (!dbConnectionString || dbConnectionString.length < 5) {
        setTestStatus('error');
        setTestMessage('连接失败: 连接字符串不能为空或格式不正确');
        return;
      }

      if (!tableName) {
        setTestStatus('error');
        setTestMessage('连接失败: 未指定视图/表名');
        return;
      }

      // Simulate Success
      setTestStatus('success');
      setTestMessage(`连接成功! 已连接到 [${dbType}] 数据库, 响应时间 24ms`);
    }, 1500);
  };


  // --- Render Components ---

  return (
    <div className="h-full bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden font-sans relative">
      
      {/* --- PRESETS BAR --- */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
         <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
            <Database size={16} className="text-gray-400 shrink-0" />
            <select 
              value={selectedPresetId} 
              onChange={(e) => handleLoadPreset(e.target.value)}
              className="text-sm border-none bg-gray-100 rounded px-2 py-1 w-full focus:ring-2 focus:ring-blue-500 truncate font-medium"
            >
              <option value="" disabled>选择预案...</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
         </div>
         <div className="flex items-center gap-1">
            <button onClick={handleOpenSaveModal} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="保存当前为新预案 (Ctrl+S)">
              <Plus size={18} />
            </button>
            {selectedPresetId && (
              <button onClick={handleDeletePreset} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="删除当前预案">
                <Trash2 size={18} />
              </button>
            )}
         </div>
      </div>

      {/* --- TABS --- */}
      <div className="bg-white border-b border-gray-200 flex shrink-0">
        {[
          { id: 'design', label: '界面', icon: Layout },
          { id: 'style', label: '样式', icon: Palette },
          { id: 'voice', label: '语音', icon: Mic },
          { id: 'data', label: '数据', icon: Database },
          { id: 'system', label: '系统', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* ================= DESIGN TAB ================= */}
        {activeTab === 'design' && (
          <div className="p-4 space-y-4 pb-20">
             {/* Header Section */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
               <div className="px-3 py-2 bg-gray-50 border-b flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => toggleSection('header')}>
                 <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
                   <Monitor size={16} /> 顶部栏 (Header)
                 </div>
                 <div className="flex items-center gap-2">
                    <input type="checkbox" checked={config.header.show} onClick={(e) => e.stopPropagation()} onChange={(e) => update(['header', 'show'], e.target.checked)} className="accent-blue-600 h-4 w-4"/>
                    {sections.header ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                 </div>
               </div>
               {sections.header && config.header.show && (
                 <div className="p-3 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="col-span-2">
                          <label className="text-xs text-gray-500 block mb-1">Logo 模式</label>
                          <div className="flex border rounded overflow-hidden">
                             {['default', 'image', 'hidden'].map(type => (
                               <button key={type} onClick={() => update(['header', 'logoType'], type)} className={`flex-1 py-1 text-xs ${config.header.logoType === type ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-50 text-gray-600'}`}>
                                 {type === 'default' ? '默认' : type === 'image' ? '图片' : '隐藏'}
                               </button>
                             ))}
                          </div>
                       </div>
                       {config.header.logoType === 'image' && (
                          <div className="col-span-2">
                            <input type="text" placeholder="Logo 图片链接 (URL)" value={config.header.logoUrl || ''} onChange={(e) => update(['header', 'logoUrl'], e.target.value)} className="w-full text-xs border p-1.5 rounded"/>
                          </div>
                       )}
                       <div className="col-span-2 space-y-1">
                          <label className="text-xs text-gray-500">主标题内容</label>
                          <input type="text" value={config.header.hospitalName} onChange={(e) => update(['header', 'hospitalName'], e.target.value)} className="w-full text-sm border p-1.5 rounded font-bold"/>
                       </div>
                    </div>
                    <div className="border-t pt-3">
                       <div className="flex justify-between items-center mb-2">
                         <label className="text-xs text-gray-500">中间副标题</label>
                         <input type="checkbox" checked={config.header.showCenterTitle} onChange={(e) => update(['header', 'showCenterTitle'], e.target.checked)} className="accent-blue-600"/>
                       </div>
                       {config.header.showCenterTitle && (
                          <input type="text" value={config.header.centerTitle} onChange={(e) => update(['header', 'centerTitle'], e.target.value)} className="w-full text-xs border p-1.5 rounded"/>
                       )}
                    </div>
                    <div className="border-t pt-3">
                       <label className="text-xs text-gray-500 block mb-1">右侧区域显示</label>
                       <div className="flex gap-2 mb-2">
                          {['time', 'text', 'hidden'].map(t => (
                            <button key={t} onClick={() => update(['header', 'rightContentType'], t)} className={`flex-1 py-1 text-xs border rounded ${config.header.rightContentType === t ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}>
                              {t === 'time' ? '时间' : t === 'text' ? '文本' : '隐藏'}
                            </button>
                          ))}
                       </div>
                       {config.header.rightContentType === 'text' && (
                          <input type="text" value={config.header.rightTextContent} onChange={(e) => update(['header', 'rightTextContent'], e.target.value)} className="w-full text-xs border p-1.5 rounded"/>
                       )}
                    </div>
                 </div>
               )}
            </div>

            {/* Main Layout & Content Section */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
               <div className="px-3 py-2 bg-gray-50 border-b flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => toggleSection('layout')}>
                 <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
                   <Maximize2 size={16} /> 中间布局 & 内容
                 </div>
                 {sections.layout ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
               </div>
               {sections.layout && (
                  <div className="p-3 space-y-5 animate-in fade-in slide-in-from-top-2">
                     
                     {/* Orientation Control */}
                     <div className="bg-gray-50 p-2 rounded border flex items-center justify-between">
                         <label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                           <MonitorSmartphone size={14} /> 屏幕方向
                         </label>
                         <div className="flex gap-2">
                            <button 
                              onClick={() => update(['layout', 'orientation'], 'landscape')}
                              className={`px-3 py-1 text-xs rounded border transition-colors ${config.layout.orientation === 'landscape' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}
                            >
                              横屏 (16:9)
                            </button>
                            <button 
                              onClick={() => update(['layout', 'orientation'], 'portrait')}
                              className={`px-3 py-1 text-xs rounded border transition-colors ${config.layout.orientation === 'portrait' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}
                            >
                              竖屏 (9:16)
                            </button>
                         </div>
                     </div>

                     <div className="bg-blue-50 p-3 rounded border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-700 mb-3 uppercase">布局比例调整</h4>
                        {config.layout.orientation === 'landscape' ? (
                          <div className="mb-4">
                             <div className="flex justify-between text-xs mb-1">
                               <span className="text-gray-600">左右宽度占比</span>
                               <span className="font-mono">{config.layout.splitRatio}% : {100 - config.layout.splitRatio}%</span>
                             </div>
                             <input type="range" min="20" max="80" value={config.layout.splitRatio} onChange={(e) => update(['layout', 'splitRatio'], Number(e.target.value))} className="w-full h-1.5 bg-white rounded-lg appearance-none cursor-pointer accent-blue-600 border border-blue-200"/>
                          </div>
                        ) : (
                          <div className="mb-4 text-[10px] text-blue-500 bg-blue-100 p-2 rounded">
                            竖屏模式下，内容将自动上下堆叠显示。
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <div className="flex justify-between text-xs mb-1 text-gray-600"><span>左/上列上下</span></div>
                              <input type="range" min="20" max="80" value={config.layout.leftSplitRatio} onChange={(e) => update(['layout', 'leftSplitRatio'], Number(e.target.value))} className="w-full h-1.5 bg-white rounded-lg appearance-none cursor-pointer accent-blue-600 border border-blue-200"/>
                           </div>
                           <div>
                              <div className="flex justify-between text-xs mb-1 text-gray-600"><span>右/下列上下</span></div>
                              <input type="range" min="20" max="80" value={config.layout.rightSplitRatio} onChange={(e) => update(['layout', 'rightSplitRatio'], Number(e.target.value))} className="w-full h-1.5 bg-white rounded-lg appearance-none cursor-pointer accent-blue-600 border border-blue-200"/>
                           </div>
                        </div>
                     </div>
                     <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase flex items-center gap-1">
                          <Type size={12}/> 区域内容分配
                        </h4>
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                                {config.layout.orientation === 'landscape' ? '左侧区域 (Left Column)' : '上方区域 (Top Section)'}
                              </div>
                              <ZoneEditor label={config.layout.orientation === 'landscape' ? "左上" : "上方-上"} zoneKey="topLeft" config={config} onUpdate={handleZoneChange} />
                              <ZoneEditor label={config.layout.orientation === 'landscape' ? "左下" : "上方-下"} zoneKey="bottomLeft" config={config} onUpdate={handleZoneChange} />
                           </div>
                           <div className="space-y-2">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mt-4">
                                {config.layout.orientation === 'landscape' ? '右侧区域 (Right Column)' : '下方区域 (Bottom Section)'}
                              </div>
                              <ZoneEditor label={config.layout.orientation === 'landscape' ? "右上" : "下方-上"} zoneKey="topRight" config={config} onUpdate={handleZoneChange} />
                              <ZoneEditor label={config.layout.orientation === 'landscape' ? "右下" : "下方-下"} zoneKey="bottomRight" config={config} onUpdate={handleZoneChange} />
                           </div>
                        </div>
                     </div>
                  </div>
               )}
            </div>
            
            {/* Logic Configuration (Passed Patient) */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden p-3">
               <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                 <ListEnd size={14} /> 过号逻辑配置 (Pass Logic)
               </h4>
               <div className="space-y-2">
                  <label className="text-xs text-gray-600">过号患者显示方式</label>
                  <select 
                     value={config.passedDisplayMode || 'zone'}
                     onChange={(e) => update(['passedDisplayMode'], e.target.value)}
                     className="w-full text-xs border p-1.5 rounded bg-white"
                  >
                     <option value="zone">独立区域 (Default Zone)</option>
                     <option value="footer">底部滚动栏 (Footer Marquee)</option>
                     <option value="wait-list-end">等待列表末尾 (Append to Waiting)</option>
                  </select>
               </div>
               {config.passedDisplayMode === 'wait-list-end' && (
                  <div className="mt-2 flex items-center gap-2">
                     <input 
                       type="checkbox" 
                       checked={config.grayOutPassed !== false}
                       onChange={(e) => update(['grayOutPassed'], e.target.checked)}
                       className="accent-blue-600"
                     />
                     <span className="text-xs text-gray-500">置灰显示 (Gray Out)</span>
                  </div>
               )}
            </div>

            {/* Footer Section */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
               <div className="px-3 py-2 bg-gray-50 border-b flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => toggleSection('footer')}>
                 <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
                   <AlignVerticalJustifyCenter size={16} className="rotate-180" /> 底部栏 (Footer)
                 </div>
                 <div className="flex items-center gap-2">
                    <input type="checkbox" checked={config.layout.footerShow} onClick={(e) => e.stopPropagation()} onChange={(e) => update(['layout', 'footerShow'], e.target.checked)} className="accent-blue-600 h-4 w-4"/>
                    {sections.footer ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                 </div>
               </div>
               {sections.footer && config.layout.footerShow && (
                  <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                     <textarea value={config.layout.footerText} onChange={(e) => update(['layout', 'footerText'], e.target.value)} placeholder="底部滚动跑马灯内容 (支持 HTML)..." className="w-full text-xs border p-2 rounded h-20 font-mono"/>
                     <div className="flex items-center justify-between border-t pt-2">
                        <label className="text-xs text-gray-600 flex items-center gap-2">
                           <input type="checkbox" checked={config.layout.footerScroll} onChange={(e) => update(['layout', 'footerScroll'], e.target.checked)} className="accent-blue-600"/>
                           开启滚动播放 (Marquee)
                        </label>
                     </div>
                  </div>
               )}
            </div>
          </div>
        )}

        {/* ================= VOICE TAB ================= */}
        {activeTab === 'voice' && (
           <div className="p-4 space-y-4">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                 <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Mic size={16} className="text-purple-500" />
                    语音播报设置 (Broadcast)
                 </h4>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-gray-600 font-bold">启用语音播报</span>
                       <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={config.speech?.enabled} onChange={(e) => update(['speech', 'enabled'], e.target.checked)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                       </label>
                    </div>

                    <div className={!config.speech?.enabled ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                       {/* Broadcast Mode */}
                       <div className="mb-4 bg-purple-50 p-3 rounded border border-purple-100">
                          <label className="text-xs font-bold text-purple-800 block mb-2 flex items-center gap-1">
                             <Volume2 size={14} /> 广播模式 (Broadcast Mode)
                          </label>
                          <div className="flex gap-2">
                             <button 
                               onClick={() => update(['speech', 'broadcastMode'], 'all')}
                               className={`flex-1 py-1.5 text-xs border rounded ${config.speech.broadcastMode === 'all' ? 'bg-purple-600 text-white border-purple-600 font-bold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                             >
                               集中广播 (Central)
                             </button>
                             <button 
                               onClick={() => update(['speech', 'broadcastMode'], 'local')}
                               className={`flex-1 py-1.5 text-xs border rounded ${config.speech.broadcastMode === 'local' ? 'bg-purple-600 text-white border-purple-600 font-bold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                             >
                               分诊广播 (Local Only)
                             </button>
                          </div>
                          
                          {/* NEW: Local Identity Config */}
                          <div className="mt-3 pt-3 border-t border-purple-200">
                              <label className="text-[10px] text-purple-700 font-bold block mb-1 flex items-center gap-1">
                                 <Megaphone size={10} /> 
                                 {config.speech.broadcastMode === 'local' 
                                   ? '当前终端的窗口编号 (Local Window No.)' 
                                   : '默认窗口号 (Default Window No.)'}
                              </label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={config.windowNumber} 
                                  onChange={(e) => updateConfig({...config, windowNumber: e.target.value})}
                                  placeholder="e.g. 1"
                                  className="w-full text-xs border p-1.5 rounded border-purple-200 focus:ring-purple-500"
                                />
                                <div className="text-[9px] text-purple-500 w-32 leading-tight">
                                   {config.speech.broadcastMode === 'local' 
                                     ? "仅当患者分配的窗口号 (Window No.) 与此编号一致时，本机才会播放语音。"
                                     : "仅用于 {number} 模板变量的默认值。"}
                                </div>
                              </div>
                              <div className="mt-2 text-[10px] text-purple-400">
                                 当前绑定窗口名称: {config.windowName} (仅用于显示)
                              </div>
                          </div>

                          <p className="text-[10px] text-purple-600 mt-2 leading-relaxed">
                             {config.speech.broadcastMode === 'all' 
                               ? "模式说明：播放所有叫号语音。适用于使用集中式大喇叭广播的场景。" 
                               : "模式说明：仅播放分配给当前窗口号的叫号语音。"}
                          </p>
                       </div>

                       <div className="space-y-2 mb-4">
                          <label className="text-xs text-gray-500 block">播报模板 (Template)</label>
                          <textarea 
                             value={config.speech?.template || ''}
                             onChange={(e) => update(['speech', 'template'], e.target.value)}
                             rows={3}
                             className="w-full border p-2 rounded text-xs"
                             placeholder="请 {number}号 {name} 到 {window} 取药"
                          />
                          <div className="flex gap-2 text-[10px] text-gray-400">
                             <span className="bg-gray-100 px-1 rounded">{`{name}`} 姓名</span>
                             <span className="bg-gray-100 px-1 rounded">{`{number}`} 号码</span>
                             <span className="bg-gray-100 px-1 rounded">{`{window}`} 窗口</span>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 gap-4">
                          <div>
                             <div className="flex justify-between text-xs mb-1 text-gray-500">
                                <span>音量 (Volume)</span>
                                <span>{Math.round((config.speech?.volume || 1) * 100)}%</span>
                             </div>
                             <input 
                               type="range" min="0" max="1" step="0.1"
                               value={config.speech?.volume || 1}
                               onChange={(e) => update(['speech', 'volume'], parseFloat(e.target.value))}
                               className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                             />
                          </div>
                          <div>
                             <div className="flex justify-between text-xs mb-1 text-gray-500">
                                <span>语速 (Rate)</span>
                                <span>{config.speech?.rate || 1}x</span>
                             </div>
                             <input 
                               type="range" min="0.5" max="2" step="0.1"
                               value={config.speech?.rate || 1}
                               onChange={(e) => update(['speech', 'rate'], parseFloat(e.target.value))}
                               className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                             />
                          </div>
                          <div>
                             <div className="flex justify-between text-xs mb-1 text-gray-500">
                                <span>语调 (Pitch)</span>
                                <span>{config.speech?.pitch || 1}</span>
                             </div>
                             <input 
                               type="range" min="0" max="2" step="0.1"
                               value={config.speech?.pitch || 1}
                               onChange={(e) => update(['speech', 'pitch'], parseFloat(e.target.value))}
                               className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                             />
                          </div>
                       </div>

                       <button 
                         onClick={handleTestVoice}
                         className="mt-4 w-full py-2 bg-purple-100 text-purple-700 rounded text-xs font-bold hover:bg-purple-200 flex items-center justify-center gap-2"
                       >
                         <Mic size={14}/> 测试语音 (Test Voice)
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* ================= STYLE TAB ================= */}
        {activeTab === 'style' && (
          <div className="p-4 space-y-6">
             <section className="bg-white p-4 rounded-lg shadow-sm border">
               <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Palette size={16} className="text-blue-500"/> 预设色彩
               </h3>
               <div className="grid grid-cols-4 gap-3">
                 {(Object.keys(PRESET_THEMES) as Array<keyof typeof PRESET_THEMES>).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateConfig({...config, theme: PRESET_THEMES[t]})}
                      className={`h-10 rounded-lg shadow-sm border-2 transition-transform hover:scale-105 ${config.theme.primary === PRESET_THEMES[t].primary ? 'border-gray-600 scale-105 ring-2 ring-blue-200' : 'border-transparent'}`}
                      style={{ background: `linear-gradient(135deg, ${PRESET_THEMES[t].primary} 50%, ${PRESET_THEMES[t].secondary} 50%)` }}
                      title={t}
                    />
                  ))}
               </div>
             </section>
             <section className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
                <h3 className="text-sm font-bold text-gray-800 mb-2">排队号样式</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600">显示排队号</span>
                  <input type="checkbox" checked={config.showQueueNumber} onChange={(e) => update(['showQueueNumber'], e.target.checked)} className="accent-blue-600"/>
                </div>
                {config.showQueueNumber && (
                   <div className="flex gap-2">
                      {(['circle', 'rounded', 'square', 'none'] as QueueNumberStyle[]).map(style => (
                        <button key={style} onClick={() => update(['queueNumberStyle'], style)} className={`flex-1 py-1.5 text-xs border rounded ${config.queueNumberStyle === style ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>
                          {style === 'circle' ? '圆形' : style === 'rounded' ? '圆角' : style === 'square' ? '方形' : '无框'}
                        </button>
                      ))}
                   </div>
                )}
             </section>
          </div>
        )}

        {/* ================= DATA TAB ================= */}
        {activeTab === 'data' && (
           <div className="p-4 space-y-4">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                 <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Server size={16} className="text-green-600" />
                    数据源配置
                 </h4>
                 
                 <div className="mb-4">
                    <div className="flex bg-gray-100 rounded p-1 mb-3">
                       <button onClick={() => update(['dataSource', 'mode'], 'push')} className={`flex-1 py-1 text-xs rounded ${config.dataSource?.mode === 'push' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>
                         API 推送模式
                       </button>
                       <button onClick={() => update(['dataSource', 'mode'], 'pull')} className={`flex-1 py-1 text-xs rounded ${config.dataSource?.mode === 'pull' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>
                         数据库读取模式
                       </button>
                    </div>
                    
                    {/* Polling Strategy Configuration */}
                    <div className="mb-4 bg-green-50 p-3 rounded border border-green-100">
                         <label className="text-xs font-bold text-green-800 block mb-2 flex items-center gap-1">
                           <Zap size={14} /> 轮询策略 (Polling Strategy)
                         </label>
                         <div className="flex gap-2 mb-2">
                            <button 
                               onClick={() => update(['dataSource', 'pollingStrategy'], 'realtime')}
                               className={`flex-1 py-1.5 text-xs border rounded ${config.dataSource?.pollingStrategy === 'realtime' ? 'bg-green-600 text-white border-green-600 font-bold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                             >
                               实时模式 (Realtime)
                             </button>
                             <button 
                               onClick={() => update(['dataSource', 'pollingStrategy'], 'smart')}
                               className={`flex-1 py-1.5 text-xs border rounded ${config.dataSource?.pollingStrategy === 'smart' ? 'bg-green-600 text-white border-green-600 font-bold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                             >
                               智能模式 (Smart)
                             </button>
                         </div>
                         <p className="text-[10px] text-green-600 leading-relaxed">
                            {config.dataSource?.pollingStrategy === 'smart' 
                              ? "智能模式：当界面仅显示静态文本/富文本时，自动暂停数据库查询以节省带宽。界面布局变更仍会通过版本号检测自动触发刷新(Hot Reload)。" 
                              : "实时模式：始终按间隔查询数据库，适用于所有场景。"}
                         </p>
                    </div>

                    {config.dataSource?.mode === 'pull' ? (
                       <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                          
                          {/* Connection Config */}
                          <div className="space-y-2">
                             <div>
                                <label className="text-xs text-gray-500 block mb-1">数据库类型 (DB Type)</label>
                                <select 
                                  value={config.dataSource?.dbType || 'mysql'} 
                                  onChange={(e) => update(['dataSource', 'dbType'], e.target.value)}
                                  className="w-full border p-1.5 text-xs rounded bg-white"
                                >
                                   <option value="mysql">MySQL</option>
                                   <option value="sqlserver">SQL Server</option>
                                   <option value="oracle">Oracle</option>
                                   <option value="postgresql">PostgreSQL</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-xs text-gray-500 block mb-1">连接字符串 (Connection String)</label>
                                <textarea 
                                  rows={2}
                                  value={config.dataSource?.dbConnectionString || ''} 
                                  onChange={(e) => update(['dataSource', 'dbConnectionString'], e.target.value)}
                                  placeholder="Server=myServer;Database=myDB;User Id=myUser;Password=myPassword;"
                                  className="w-full border p-1.5 text-xs rounded font-mono"
                                />
                             </div>
                             
                             {/* Test Connection Button */}
                             <div className="flex items-center gap-2">
                                <button 
                                  onClick={handleTestDbConnection}
                                  disabled={testStatus === 'loading'}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm ${
                                    testStatus === 'loading' ? 'bg-gray-100 text-gray-400 cursor-wait' :
                                    testStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    testStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                                    'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                                  }`}
                                >
                                  {testStatus === 'loading' && <Loader2 size={12} className="animate-spin" />}
                                  {testStatus === 'success' && <CheckCircle size={12} />}
                                  {testStatus === 'error' && <AlertCircle size={12} />}
                                  {testStatus === 'loading' ? '正在连接...' : '测试连接 (Test Connection)'}
                                </button>
                             </div>
                             
                             {/* Test Message */}
                             {testMessage && (
                               <div className={`text-[10px] p-2 rounded border ${
                                 testStatus === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 
                                 testStatus === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 
                                 'bg-gray-50 text-gray-500'
                               }`}>
                                 {testMessage}
                               </div>
                             )}

                             <div>
                                <label className="text-xs text-gray-500 block mb-1">视图/表名 (Table/View Name)</label>
                                <input type="text" placeholder="e.g. view_pharmacy_queue" value={config.dataSource?.tableName} onChange={(e) => update(['dataSource', 'tableName'], e.target.value)} className="w-full border p-1.5 text-xs rounded"/>
                             </div>
                          </div>

                          {/* Field Mapping */}
                          <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-100">
                             <label className="text-xs text-gray-700 font-bold block mb-1">字段映射 (Column Mapping)</label>
                             {[
                               {k:'id', n:'唯一标识 (ID)'}, 
                               {k:'name', n:'患者姓名 (Name)'}, 
                               {k:'number', n:'排队号码 (Number)'}, 
                               {k:'status', n:'状态字段 (Status)'}, 
                               {k:'windowId', n:'窗口过滤 (Window ID)'},
                               {k:'order', n:'排序字段 (Order)'}
                              ].map(f => (
                                <div key={f.k} className="flex items-center gap-2">
                                   <span className="text-[10px] w-24 text-gray-500 text-right">{f.n}</span>
                                   <input 
                                     type="text" 
                                     placeholder={`Column Name`}
                                     value={config.dataSource?.fieldMap?.[f.k as keyof typeof config.dataSource.fieldMap] || ''}
                                     onChange={(e) => update(['dataSource', 'fieldMap', f.k], e.target.value)}
                                     className="flex-1 border p-1 text-xs rounded bg-white"
                                   />
                                </div>
                             ))}
                          </div>

                          {/* Status Value Mapping */}
                          <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-100">
                             <label className="text-xs text-gray-700 font-bold block mb-1">状态值说明 (Status Values)</label>
                             <div className="text-[10px] text-gray-400 mb-1">请输入数据库中代表该状态的具体值 (例如 0, 1, 2)</div>
                             <div className="grid grid-cols-3 gap-2">
                                {[
                                   {k:'waitingValue', n:'等待中 (Wait)'}, 
                                   {k:'calledValue', n:'正在叫号 (Call)'}, 
                                   {k:'passedValue', n:'已过号 (Pass)'}
                                ].map(f => (
                                   <div key={f.k}>
                                      <span className="text-[10px] text-gray-500 block">{f.n}</span>
                                      <input 
                                        type="text" 
                                        value={config.dataSource?.statusMap?.[f.k as keyof typeof config.dataSource.statusMap] || ''}
                                        onChange={(e) => update(['dataSource', 'statusMap', f.k], e.target.value)}
                                        className="w-full border p-1 text-xs rounded bg-white"
                                      />
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    ) : (
                       <div className="space-y-3">
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700">
                             API 仅需推送单条患者变更信息。终端收到后将自动更新本地队列。
                          </div>
                          
                          <div className="bg-gray-800 text-gray-200 p-3 rounded text-[10px] font-mono overflow-x-auto space-y-4">
                            {/* Push Next/Call */}
                            <div>
                               <div className="flex justify-between items-center mb-1 text-green-400 font-bold">
                                  <span>叫号 / 更新 (Call / Update)</span>
                                  <span className="text-[9px] border border-green-700 px-1 rounded">POST /api/queue/push</span>
                               </div>
<pre>{`{
  "deviceId": "${config.system?.deviceId || 'WIN-01'}",
  "action": "call",
  "patient": {
    "id": "p123", 
    "name": "李四", 
    "number": "A102",
    "status": "calling"
  }
}`}</pre>
                            </div>

                            {/* Pass */}
                            <div className="border-t border-gray-700 pt-2">
                               <div className="flex justify-between items-center mb-1 text-yellow-400 font-bold">
                                  <span>过号 (Pass)</span>
                                  <span className="text-[9px] border border-yellow-700 px-1 rounded">POST /api/queue/push</span>
                               </div>
<pre>{`{
  "deviceId": "${config.system?.deviceId || 'WIN-01'}",
  "action": "pass",
  "patient": {
    "id": "p123",
    "status": "passed"
  }
}`}</pre>
                            </div>

                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {/* ================= SYSTEM TAB ================= */}
        {activeTab === 'system' && (
           <div className="p-4 space-y-4">
              {/* Device Binding */}
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                 <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Network size={16} className="text-blue-500" />
                    设备绑定 & 网络
                 </h4>
                 
                 {/* Simulation Controls */}
                 <div className="mb-4 bg-orange-50 border border-orange-200 rounded p-3">
                    <h5 className="text-xs font-bold text-orange-800 mb-2">预览模拟 (Simulation)</h5>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-gray-600">设备状态</span>
                       <button 
                         onClick={() => update(['system', 'isRegistered'], !config.system?.isRegistered)}
                         className={`px-3 py-1 rounded text-xs font-bold transition-colors ${config.system?.isRegistered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                       >
                         {config.system?.isRegistered ? '已注册 (Normal)' : '未注册 (Unregistered)'}
                       </button>
                    </div>
                 </div>

                 <div className="space-y-3 opacity-75">
                    <div>
                       <label className="text-xs text-gray-500 block mb-1">API 基础地址</label>
                       <input 
                        type="text" 
                        value={config.system?.apiBaseUrl || ''} 
                        onChange={(e) => update(['system', 'apiBaseUrl'], e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="w-full border p-1.5 text-xs rounded"
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-xs text-gray-500 block mb-1">设备 ID (Unique)</label>
                          <input 
                            type="text" 
                            value={config.system?.deviceId || ''} 
                            onChange={(e) => update(['system', 'deviceId'], e.target.value)}
                            className="w-full border p-1.5 text-xs rounded bg-gray-50"
                          />
                       </div>
                       <div>
                          <label className="text-xs text-gray-500 block mb-1">MAC 地址 (自动获取)</label>
                          <input 
                            type="text" 
                            disabled
                            value={config.system?.deviceMac || '00:00:00:00:00:00'} 
                            className="w-full border p-1.5 text-xs rounded bg-gray-100 text-gray-500"
                          />
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* --- SAVE PRESET MODAL --- */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-xs animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">保存当前配置为预案</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <input 
                autoFocus
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmSave()}
                className="w-full border p-2 rounded-lg mb-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="预案名称"
              />
              <div className="flex gap-2">
                 <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">取消</button>
                 <button onClick={handleConfirmSave} className="flex-1 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium shadow-sm">保存</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;
