
import React, { useEffect, useState } from 'react';
import { FileText, Search, Filter, Monitor, User } from 'lucide-react';
import api from '../services/api';
import { AuditLog } from '../types';

const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await api.admin.getLogs();
            setLogs(data);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(l => 
        l.action.includes(filter) || 
        l.details.includes(filter) ||
        l.operator.includes(filter)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-blue-600" /> 日志审计
                </h2>
                <p className="text-gray-500 mt-1">追踪系统关键操作记录 (本地/API)。</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border mb-4 flex gap-4">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="搜索操作员、动作或详情..." 
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>
                 <button onClick={loadLogs} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-medium">
                    刷新日志
                 </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b sticky top-0">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">时间</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">操作来源</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">动作类型</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">详情</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">IP 地址</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-sm font-mono text-gray-600">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3 text-sm font-medium text-gray-800">
                                        <div className="flex items-center gap-2">
                                            {log.operator === 'Admin' ? <User size={14} className="text-blue-500"/> : <Monitor size={14} className="text-purple-500"/>}
                                            {log.operator}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold 
                                            ${log.action === 'SYSTEM_ERROR' ? 'bg-red-100 text-red-700' : 
                                              log.action === 'CONFIG_UPDATE' ? 'bg-orange-100 text-orange-700' : 
                                              'bg-blue-50 text-blue-600'}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-600 truncate max-w-md" title={log.details}>
                                        {log.details}
                                    </td>
                                    <td className="px-6 py-3 text-sm font-mono text-gray-400">
                                        {log.ipAddress || '-'}
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">无日志记录</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditLogViewer;
