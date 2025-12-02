
import React from 'react';
import { Monitor, ShieldCheck, Activity, Clock } from 'lucide-react';

interface LandingPageProps {
  systemName: string;
  onEnterAdmin: () => void;
  onEnterTv: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ systemName, onEnterAdmin, onEnterTv }) => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans select-none">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-wide">{systemName}</h1>
            <p className="text-xs text-gray-400">Queue Management System</p>
          </div>
        </div>
        <div className="text-sm text-gray-500 font-mono flex items-center gap-2">
           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
           System Online
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Admin Card */}
          <div 
            onClick={onEnterAdmin}
            className="group relative bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20 flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-gray-700 group-hover:bg-blue-600 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 shadow-inner">
               <ShieldCheck size={40} className="text-gray-400 group-hover:text-white transition-colors" />
            </div>
            <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-400 transition-colors">管理后台</h2>
            <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-4">Admin Console</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
              进入系统配置、队列管理、设备绑定及数据报表中心。需要管理员权限。
            </p>
            <div className="mt-8 px-6 py-2 rounded-full border border-gray-600 text-gray-400 text-sm group-hover:border-blue-500 group-hover:text-blue-400 transition-all">
               点击进入 &rarr;
            </div>
          </div>

          {/* TV Display Card */}
          <div 
            onClick={onEnterTv}
            className="group relative bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/20 flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-gray-700 group-hover:bg-purple-600 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 shadow-inner">
               <Monitor size={40} className="text-gray-400 group-hover:text-white transition-colors" />
            </div>
            <h2 className="text-2xl font-bold mb-2 group-hover:text-purple-400 transition-colors">大屏展示</h2>
            <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-4">Display Client</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
              启动排队叫号显示界面。适用于大厅电视、窗口显示屏。
            </p>
            <div className="mt-8 px-6 py-2 rounded-full border border-gray-600 text-gray-400 text-sm group-hover:border-purple-500 group-hover:text-purple-400 transition-all">
               启动画面 &rarr;
            </div>
          </div>

        </div>

        <p className="mt-16 text-gray-500 text-xs text-center max-w-md">
           此页面为系统安全入口。未经授权请勿尝试登录管理后台。<br/>
           &copy; 2025 Pharmacy Queue Management System. All rights reserved.
        </p>
      </main>
    </div>
  );
};

export default LandingPage;
