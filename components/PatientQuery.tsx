

import React, { useState } from 'react';
import { QueueConfig, Patient } from '../types';
import { Search, Filter, RotateCcw, ArrowRight, ArrowUp, Trash2, Clock, Monitor } from 'lucide-react';
import api from '../services/api';

interface PatientQueryProps {
  config: QueueConfig;
  onUpdateConfig?: (newConfig: QueueConfig) => void;
  isConnected?: boolean;
}

type PatientStatus = 'all' | 'calling' | 'waiting' | 'passed';

interface HistoryItem extends Patient {
  status: PatientStatus;
  statusLabel: string;
}

const PatientQuery: React.FC<PatientQueryProps> = ({ config, onUpdateConfig, isConnected }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PatientStatus>('all');
  const [windowFilter, setWindowFilter] = useState<string>('all');

  // Flatten all data into a single searchable list
  const getAllPatients = (): HistoryItem[] => {
    const list: HistoryItem[] = [];
    
    // Current
    if (config.currentPatient && config.currentPatient.id) {
      list.push({ ...config.currentPatient, status: 'calling', statusLabel: '正在叫号' });
    }
    
    // Waiting
    config.waitingList.forEach(p => {
       list.push({ ...p, status: 'waiting', statusLabel: '等待中' });
    });

    // Passed
    config.passedList.forEach(p => {
       list.push({ ...p, status: 'passed', statusLabel: '已过号' });
    });

    return list;
  };

  const allPatients = getAllPatients();

  // Extract unique window numbers for filter
  const uniqueWindows = Array.from(new Set(allPatients.map(p => p.windowNumber || p.windowName || '未分配').filter(Boolean))).sort();

  // Filter Logic
  const filteredPatients = allPatients.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.number.includes(searchTerm) || p.id.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    let matchesWindow = true;
    if (windowFilter !== 'all') {
       // Match against number OR name
       const wNum = p.windowNumber || '未分配';
       const wName = p.windowName || '未分配';
       matchesWindow = wNum === windowFilter || wName === windowFilter;
    }

    return matchesSearch && matchesStatus && matchesWindow;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'calling': return 'bg-green-100 text-green-700 border-green-200';
      case 'waiting': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'passed': return 'bg-gray-100 text-gray-500 border-gray-200';
      default: return 'bg-gray-50';
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
  };

  // --- Operations Logic ---

  const handlePass = async (patient: HistoryItem) => {
    if (isConnected) {
        try {
            await api.queue.pass(patient.id);
        } catch(e) { console.error('API Error:', e); alert('操作失败'); }
        return;
    }

    if (!onUpdateConfig) return;
    
    // Logic: Move from Current/Waiting -> Passed
    const newPassed = [{ ...patient, checkInTime: patient.checkInTime || Date.now() }, ...config.passedList].slice(0, 50);
    
    let newCurrent = config.currentPatient;
    let newWaiting = [...config.waitingList];

    if (patient.status === 'calling') {
       // If passing current, pull next from waiting
       const next = newWaiting.length > 0 ? newWaiting[0] : { id: '', name: '---', number: '---' } as Patient;
       newWaiting = newWaiting.length > 0 ? newWaiting.slice(1) : [];
       newCurrent = next;
    } else if (patient.status === 'waiting') {
       newWaiting = newWaiting.filter(p => p.id !== patient.id);
    }

    onUpdateConfig({
      ...config,
      currentPatient: newCurrent,
      waitingList: newWaiting,
      passedList: newPassed
    });
  };

  const handleRecall = async (patient: HistoryItem) => {
     if (isConnected) {
        try {
            await api.queue.recall(patient.id);
        } catch(e) { console.error('API Error:', e); alert('操作失败'); }
        return;
     }

     if (!onUpdateConfig) return;

     if (patient.status === 'calling') {
        // Just update timestamp to re-trigger voice
        onUpdateConfig({
          ...config,
          currentPatient: { ...patient, callTimestamp: Date.now() }
        });
     }
  };

  const handleRestore = async (patient: HistoryItem) => {
    if (isConnected) {
        try {
            await api.queue.restore(patient.id);
        } catch(e) { console.error('API Error:', e); alert('操作失败'); }
        return;
    }

    if (!onUpdateConfig) return;
    // Move from Passed -> Waiting (End)
    const newPassed = config.passedList.filter(p => p.id !== patient.id);
    const newWaiting = [...config.waitingList, { ...patient }];
    
    onUpdateConfig({
      ...config,
      passedList: newPassed,
      waitingList: newWaiting
    });
  };

  const handleTop = async (patient: HistoryItem) => {
    if (isConnected) {
        try {
            await api.queue.top(patient.id);
        } catch(e) { console.error('API Error:', e); alert('操作失败'); }
        return;
    }

    if (!onUpdateConfig) return;
    // Move from Waiting -> Waiting (Index 0)
    const filteredWaiting = config.waitingList.filter(p => p.id !== patient.id);
    const newWaiting = [patient, ...filteredWaiting];
    
    onUpdateConfig({
      ...config,
      waitingList: newWaiting
    });
  };

  const handleDelete = async (patient: HistoryItem) => {
     if (confirm(`确定要删除 ${patient.name} 吗?`)) {
        if (isConnected) {
            try {
                await api.queue.delete(patient.id);
            } catch(e) { console.error('API Error:', e); alert('操作失败'); }
            return;
        }

        if (!onUpdateConfig) return;
        if (patient.status === 'waiting') {
           onUpdateConfig({
             ...config,
             waitingList: config.waitingList.filter(p => p.id !== patient.id)
           });
        } else if (patient.status === 'passed') {
           onUpdateConfig({
             ...config,
             passedList: config.passedList.filter(p => p.id !== patient.id)
           });
        }
     }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
       <div className="mb-6">
         <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           <Search className="text-blue-600" />
           数据查询与操作
         </h2>
         <p className="text-gray-500 mt-1">查询推送至系统的患者数据状态，并进行过号、重呼等人工干预操作。</p>
       </div>

       {/* Toolbar */}
       <div className="bg-white p-4 rounded-xl shadow-sm border mb-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜索姓名、号码..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
             </div>
             {/* Window Filter Dropdown */}
             <div className="relative w-48">
                <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select 
                  value={windowFilter}
                  onChange={(e) => setWindowFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-700"
                >
                  <option value="all">所有窗口 (All)</option>
                  {uniqueWindows.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
             </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
             {[
               { id: 'all', label: '全部' },
               { id: 'calling', label: '正在叫号' },
               { id: 'waiting', label: '等待中' },
               { id: 'passed', label: '已过号' },
             ].map((filter) => (
               <button
                 key={filter.id}
                 onClick={() => setStatusFilter(filter.id as PatientStatus)}
                 className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                   statusFilter === filter.id 
                     ? 'bg-blue-600 text-white' 
                     : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                 }`}
               >
                 {filter.label}
               </button>
             ))}
          </div>
       </div>

       {/* Table */}
       <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">排队号码</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">患者姓名</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">分配窗口</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">当前状态</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                     <div className="flex items-center gap-1"><Clock size={12}/> 时间信息</div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 font-mono font-bold text-gray-700">
                        {patient.number}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {patient.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                           <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                             {patient.windowNumber || '?'}
                           </span>
                           <span className="text-xs">{patient.windowName || '未分配'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(patient.status)}`}>
                          {patient.statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex flex-col">
                          <span className="font-mono text-gray-700">
                             {patient.status === 'calling' ? formatTime(patient.callTimestamp) : formatTime(patient.checkInTime)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                             {patient.status === 'calling' ? '叫号时间' : '报到时间'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                           
                           {/* CALLING OPERATIONS */}
                           {patient.status === 'calling' && (
                             <>
                               <button onClick={() => handleRecall(patient)} className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200" title="重呼">
                                 <RotateCcw size={16} />
                               </button>
                               <button onClick={() => handlePass(patient)} className="p-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200" title="过号">
                                 <ArrowRight size={16} />
                               </button>
                             </>
                           )}

                           {/* WAITING OPERATIONS */}
                           {patient.status === 'waiting' && (
                             <>
                               <button onClick={() => handleTop(patient)} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="优先/置顶">
                                 <ArrowUp size={16} />
                               </button>
                               <button onClick={() => handlePass(patient)} className="p-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200" title="过号">
                                 <ArrowRight size={16} />
                               </button>
                               <button onClick={() => handleDelete(patient)} className="p-1.5 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600" title="删除">
                                 <Trash2 size={16} />
                               </button>
                             </>
                           )}

                           {/* PASSED OPERATIONS */}
                           {patient.status === 'passed' && (
                             <>
                               <button onClick={() => handleRestore(patient)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="复位/重排">
                                 <RotateCcw size={16} />
                               </button>
                               <button onClick={() => handleDelete(patient)} className="p-1.5 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600" title="删除">
                                 <Trash2 size={16} />
                               </button>
                             </>
                           )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                       <div className="flex flex-col items-center gap-2">
                          <Filter size={32} className="opacity-20" />
                          <span>没有找到匹配的患者数据</span>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t bg-gray-50 text-xs text-gray-500 flex justify-between">
             <span>显示 {filteredPatients.length} 条记录</span>
             <span>数据源: {isConnected ? '实时 API (Live)' : '内存模拟 (Local)'}</span>
          </div>
       </div>
    </div>
  );
};

export default PatientQuery;
