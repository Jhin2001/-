
import React, { useState } from 'react';
import { GlobalSystemSettings } from '../types';
import { LogIn, User, Lock, Activity, Info } from 'lucide-react';
import api from '../services/api';

interface LoginPageProps {
  settings: GlobalSystemSettings;
  onLogin: (success: boolean) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ settings, onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        // 1. Try API Login first
        await api.admin.login(password);
        // If API call succeeds (no error thrown), we log in
        onLogin(true);
    } catch (err) {
        // 2. Fallback to Local Check (Offline Mode)
        console.warn("API Login failed, attempting local fallback:", err);
        
        // Wait a brief moment to prevent brute-force timing attacks (optional, mostly for UX here)
        // Check against the settings prop OR the hardcoded default '123456'
        // This ensures that even if local settings are messed up, the user can still enter with the default.
        if (username === 'admin' && (password === settings.adminPassword || password === '123456')) {
            onLogin(true);
        } else {
            setError('用户名或密码错误 (默认: 123456)');
            setIsLoading(false);
        }
    }
  };

  return (
    <div 
      className="h-screen w-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ 
        backgroundImage: `url(${settings.loginBackgroundImage})`,
        backgroundColor: '#111827'
      }}
    >
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl overflow-hidden p-8">
           
           <div className="text-center mb-8">
              <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform rotate-3">
                 <Activity size={40} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md">{settings.loginTitle}</h1>
              <p className="text-blue-200 text-sm tracking-wide font-medium opacity-80">{settings.loginSubtitle}</p>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <User size={18} className="text-blue-300 group-focus-within:text-blue-400 transition-colors" />
                   </div>
                   <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-600 text-white placeholder-gray-400 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="管理员账号"
                   />
                </div>

                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <Lock size={18} className="text-blue-300 group-focus-within:text-blue-400 transition-colors" />
                   </div>
                   <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-600 text-white placeholder-gray-400 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="登录密码 (默认: 123456)"
                   />
                </div>
              </div>

              {error && (
                <div className="text-red-300 text-sm text-center bg-red-900/40 border border-red-500/30 p-2.5 rounded-lg animate-in shake">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                 {isLoading ? (
                   <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 ) : (
                   <>
                     <LogIn className="w-5 h-5" />
                     进入管理系统
                   </>
                 )}
              </button>
           </form>
           
           <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
               <Info size={12} className="text-blue-400"/>
               <span>离线/未配置 API 时，请使用默认密码: <span className="text-white font-mono font-bold">123456</span></span>
           </div>
        </div>
        
        <p className="text-center text-gray-400 text-xs mt-6">
           © 2025 Pharmacy Queue Management System
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
