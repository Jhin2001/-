
import React, { useState } from 'react';
import { GlobalSystemSettings } from '../types';
import { Settings, Image, Key, Type, Database, Save, Check } from 'lucide-react';

interface SystemSettingsProps {
  settings: GlobalSystemSettings;
  onUpdate: (newSettings: GlobalSystemSettings) => void;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({ settings, onUpdate }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleChange = (key: keyof GlobalSystemSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
    setSaveStatus('idle');
  };

  const handleSave = () => {
    setSaveStatus('saving');
    // Simulate API/LocalStorage save delay
    setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-gray-600" />
          系统全局设置
        </h2>
      </div>

      <div className="space-y-6">
        
        {/* Login Config */}
        <section className="bg-white rounded-xl shadow-sm border p-6">
           <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b">
             <Key size={18} /> 登录页面配置
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

        {/* Core Config */}
        <section className="bg-white rounded-xl shadow-sm border p-6">
           <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b">
             <Database size={18} /> 核心参数
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <label className="block text-sm font-medium text-gray-600 mb-1">医院/系统名称</label>
                 <input 
                    type="text" 
                    value={settings.systemName}
                    onChange={(e) => handleChange('systemName', e.target.value)}
                    className="w-full border p-2 rounded"
                  />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-600 mb-1">服务端口 (Simulation)</label>
                 <input 
                    type="number" 
                    value={settings.apiPort}
                    onChange={(e) => handleChange('apiPort', Number(e.target.value))}
                    className="w-full border p-2 rounded"
                  />
              </div>
           </div>
        </section>

      </div>

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
           {saveStatus === 'saved' ? '保存成功' : saveStatus === 'saving' ? '保存中...' : '保存设置'}
         </button>
      </div>
    </div>
  );
};

export default SystemSettings;
