import React, { useState } from 'react';
import { GlobalSystemSettings } from '../types';
import { Settings, Image, Key, Type, Database, Save, Check, Link, Activity, ExternalLink, AlertTriangle, CloudLightning, CloudOff, FolderOpen } from 'lucide-react';
import api from '../services/api';
import MediaLibraryModal from './MediaLibraryModal';
import { useToast } from './ToastProvider';

interface SystemSettingsProps {
  settings: GlobalSystemSettings;
  onUpdate: (newSettings: GlobalSystemSettings) => void;
  isConnected?: boolean;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({ settings, onUpdate, isConnected }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  
  // Media Modal
  const [showMediaModal, setShowMediaModal] = useState(false);
  const toast = useToast();

  const handleChange = (key: keyof GlobalSystemSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
    setSaveStatus('idle');
    setTestStatus('idle');
    setTestMsg('');
  };

  const handleMediaSelect = (url: string) => {
      handleChange('loginBackgroundImage', url);
      setShowMediaModal(false);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    // 1. Always save to LocalStorage so API URL persists across reloads (Critical for API connectivity)
    try {
        localStorage.setItem('pqms_settings', JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings to localStorage (Quota exceeded or restricted?)", e);
        toast.error("本地缓存保存失败 (受限环境)");
    }

    // 2. If connected, try to sync with Backend
    if (isConnected) {
        try {
            await api.admin.saveSystemSettings(settings);
        } catch (e) {
            console.error("Failed to sync settings to server", e);
            toast.error("云端同步失败，但本地保存尝试已执行");
        }
    }

    setSaveStatus('saved');
    toast.success("系统设置已保存");
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    setTestMsg('正在连接...');
    
    // Ensure URL has no trailing slash for the test
    const baseUrl = (settings.apiBaseUrl || '').replace(/\/+$/, '');
    
    // FIX: Use dedicated health check endpoint instead of business endpoint
    // This avoids 400 Bad Request errors when checking connection if params are missing
    const testUrl = `${baseUrl}/system/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(testUrl, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
         setTestStatus('success');
         setTestMsg('连接成功！API 服务正常。');
         toast.success('连接成功');
      } else {
         setTestStatus('error');
         setTestMsg(`连接失败: 服务器返回状态码 ${res.status}`);
         toast.error(`连接失败: ${res.status}`);
      }
    } catch (e: any) {
       console.error("API Test Failed:", e);
       setTestStatus('error');
       
       // Detect SSL Error / Network Error
       if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
          setTestMsg('连接被拒绝。可能是 SSL 证书未被信任，或者 API 地址错误。');
          toast.error('连接被拒绝，请检查证书或地址');
       } else {
          setTestMsg(`连接错误: ${e.message}`);
          toast.error('连接发生异常');
       }
    }
  };

  const openApiInNewTab = () => {
      const baseUrl = (settings.apiBaseUrl || '').replace(/\/+$/, '');
      window.open(`${baseUrl}/system/health`, '_blank');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Settings className="text-gray-600" />
             系统全局设置
           </h2>
           <p className="text-gray-500 text-sm mt-1">配置医院名称、API 连接及登录页样式。</p>
        </div>
        
        {/* Connection Badge */}
        {isConnected ? (
           <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200">
              <CloudLightning size={14} />
              已连接至远程数据库 (API Mode)
           </div>
        ) : (
           <div className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200">
              <CloudOff size={14} />
              当前使用本地存储 (Local Mode)
           </div>
        )}
      </div>

      <div className="space-y-6">
        
        {/* Core Config */}
        <section className="bg-white rounded-xl shadow-sm border p-6">
           <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b">
             <Database size={18} /> 核心参数 (Core)
           </h3>
           
           <div className="grid grid-cols-1 gap-6">
              <div>
                 <label className="block text-sm font-medium text-gray-600 mb-1">医院/系统名称</label>
                 <input 
                    type="text" 
                    value={settings.systemName}
                    onChange={(e) => handleChange('systemName', e.target.value)}
                    className="w-full border p-2 rounded"
                  />
              </div>

              <div className="bg-blue-50 p-4 rounded border border-blue-100">
                 <label className="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                    <Link size={16}/> 后端 API 接口地址 (API Base URL)
                 </label>
                 <div className="text-xs text-blue-600 mb-3 opacity-80 leading-relaxed">
                    指向后端服务的地址 (e.g. C# WebAPI)。<br/>
                    注意：如果使用 <b>https://localhost</b>，首次连接可能会因为自签名证书失败。请点击下方“信任证书”按钮解决。
                 </div>
                 
                 <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="https://localhost:30335/api/v1"
                        value={settings.apiBaseUrl || ''}
                        onChange={(e) => handleChange('apiBaseUrl', e.target.value)}
                        className="flex-1 border p-2 rounded font-mono text-sm shadow-sm"
                    />
                    <button 
                       onClick={handleTestConnection}
                       disabled={testStatus === 'loading'}
                       className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                       {testStatus === 'loading' ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"/> : <Activity size={16}/>}
                       测试连接
                    </button>
                 </div>

                 {/* Test Result Feedback */}
                 {testStatus === 'success' && (
                    <div className="mt-3 p-2 bg-green-100 text-green-700 text-xs rounded border border-green-200 flex items-center gap-2">
                       <Check size={14} /> {testMsg}
                    </div>
                 )}
                 
                 {testStatus === 'error' && (
                    <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                       <div className="flex items-center gap-2 font-bold mb-1">
                          <AlertTriangle size={14} /> {testMsg}
                       </div>
                       <div className="pl-6">
                          如果是 SSL 证书问题，请点击下方按钮打开 API 地址，并在浏览器中选择 <b>“高级” -&gt; “继续前往”</b> 以信任证书。
                          <button 
                             onClick={openApiInNewTab}
                             className="mt-2 flex items-center gap-1 text-blue-600 hover:underline font-bold"
                          >
                             <ExternalLink size={12} /> 打开 API 地址以信任证书
                          </button>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </section>

        {/* Login Config */}
        <section className="bg-white rounded-xl shadow-sm border p-6">
           <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b">
             <Key size={18} /> 登录页面配置 (Login)
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">系统标题 (Login Title)</label>
                <div className="flex items-center gap-2">
                  <Type size={16} className="text-gray-400" />
                  <input 
                    type="text" 
                    value={settings.loginTitle}
                    onChange={(e) => handleChange('loginTitle', e.target.value)}
                    className="flex-1 border p-2 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">系统副标题 (Subtitle)</label>
                <input 
                  type="text" 
                  value={settings.loginSubtitle}
                  onChange={(e) => handleChange('loginSubtitle', e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">背景图片链接 (Background URL)</label>
                <div className="flex gap-2">
                   <div className="flex-1 flex items-center gap-2">
                      <Image size={16} className="text-gray-400" />
                      <input 
                        type="text" 
                        value={settings.loginBackgroundImage}
                        onChange={(e) => handleChange('loginBackgroundImage', e.target.value)}
                        className="w-full border p-2 rounded"
                      />
                   </div>
                   <button 
                      onClick={() => setShowMediaModal(true)}
                      className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 px-3 py-2 rounded text-xs whitespace-nowrap flex items-center gap-2"
                   >
                      <FolderOpen size={14} /> 选择图片
                   </button>
                   <div 
                     className="w-16 h-10 bg-cover bg-center rounded border"
                     style={{ backgroundImage: `url(${settings.loginBackgroundImage})` }}
                   ></div>
                </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-600 mb-1">Admin 默认密码</label>
                 <input 
                    type="text" 
                    value={settings.adminPassword}
                    onChange={(e) => handleChange('adminPassword', e.target.value)}
                    className="w-full border p-2 rounded font-mono"
                  />
              </div>
           </div>
        </section>
      </div>
      
      {/* Media Library Modal */}
      <MediaLibraryModal 
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onSelect={handleMediaSelect}
          allowedTypes="image"
          isConnected={isConnected}
      />

      {/* Floating Save Button */}
      <div className="fixed bottom-8 right-8 z-20">
         <button 
           onClick={handleSave}
           className={`
             flex items-center gap-2 px-6 py-3 rounded-full shadow-xl font-bold transition-all transform hover:scale-105 active:scale-95
             ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}
           `}
         >
           {saveStatus === 'saved' ? <Check size={20} /> : <Save size={20} />}
           {saveStatus === 'saved' ? '保存成功' : saveStatus === 'saving' ? '保存中...' : isConnected ? '保存设置 (至数据库)' : '保存设置 (至本地)'}
         </button>
      </div>
    </div>
  );
};

export default SystemSettings;