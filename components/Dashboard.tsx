
import React, { useEffect, useState } from 'react';
import { BarChart3, Users, Clock, TrendingUp, Download, RefreshCcw, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { DashboardMetrics } from '../types';

interface DashboardProps {
    isConnected?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ isConnected }) => {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.admin.getDashboardStats();
            setMetrics(data);
        } catch (e) {
            console.error("Failed to load dashboard", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [isConnected]);

    // Simple CSV Export Logic (Frontend)
    const handleExport = () => {
        if (!metrics) return;
        
        // Prepare CSV Content
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM
        
        // Summary
        csvContent += "=== 今日概览 ===\n";
        csvContent += `总服务人数,${metrics.todayServed}\n`;
        csvContent += `当前排队,${metrics.waitingCount}\n`;
        csvContent += `平均等待(分),${metrics.avgWaitTimeMinutes}\n`;
        csvContent += `高峰时段,${metrics.peakHour}\n\n`;

        // Window Stats
        csvContent += "=== 窗口绩效 ===\n";
        csvContent += "窗口号,窗口名称,服务人数,平均耗时(分)\n";
        metrics.windowPerformance.forEach(w => {
            csvContent += `${w.windowNumber},${w.windowName},${w.servedCount},${w.avgTime}\n`;
        });
        csvContent += "\n";

        // Trend
        csvContent += "=== 时段流量 ===\n";
        csvContent += "时间,人数\n";
        metrics.trendData.forEach(t => {
            csvContent += `${t.time},${t.count}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `queue_report_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-gray-500"><RefreshCcw className="animate-spin mr-2"/> 加载数据中...</div>;
    }

    if (!metrics) return null;

    // --- Chart Helpers (Pure CSS/SVG) ---
    const maxTrend = Math.max(...metrics.trendData.map(d => d.count), 10);
    const maxWindow = Math.max(...metrics.windowPerformance.map(d => d.servedCount), 10);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="text-blue-600" /> 数据概览 (Dashboard)
                    </h2>
                    <p className="text-gray-500 mt-1">实时监控药房队列运行状态与关键指标。</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadData} className="p-2 text-gray-500 hover:text-blue-600 rounded hover:bg-gray-100">
                        <RefreshCcw size={20} />
                    </button>
                    <button 
                        onClick={handleExport}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm font-medium transition-transform active:scale-95"
                    >
                        <Download size={18} /> 导出报表
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                    <div>
                        <div className="text-gray-500 text-sm font-medium mb-1">今日服务人数</div>
                        <div className="text-3xl font-bold text-gray-800">{metrics.todayServed}</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-blue-600"><Users size={24}/></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                    <div>
                        <div className="text-gray-500 text-sm font-medium mb-1">当前积压</div>
                        <div className="text-3xl font-bold text-gray-800">{metrics.waitingCount}</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg text-orange-600"><AlertCircle size={24}/></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                    <div>
                        <div className="text-gray-500 text-sm font-medium mb-1">平均等待时长</div>
                        <div className="text-3xl font-bold text-gray-800">{metrics.avgWaitTimeMinutes} <span className="text-sm font-normal text-gray-400">分</span></div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-green-600"><Clock size={24}/></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                    <div>
                        <div className="text-gray-500 text-sm font-medium mb-1">今日高峰时段</div>
                        <div className="text-xl font-bold text-gray-800 mt-1">{metrics.peakHour}</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-purple-600"><TrendingUp size={24}/></div>
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Trend Chart (Line/Area) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                        <TrendingUp size={18} /> 时段流量趋势
                    </h3>
                    <div className="h-64 flex items-end gap-2 sm:gap-4">
                        {metrics.trendData.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group">
                                <div className="w-full bg-blue-50 rounded-t-lg relative flex items-end justify-center overflow-hidden hover:bg-blue-100 transition-all cursor-pointer" style={{ height: '100%' }}>
                                     <div 
                                        className="w-full bg-blue-500 opacity-80 rounded-t-sm transition-all duration-1000 group-hover:opacity-100"
                                        style={{ height: `${(d.count / maxTrend) * 100}%` }}
                                     ></div>
                                     <div className="absolute -top-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                         {d.count}人
                                     </div>
                                </div>
                                <div className="text-xs text-gray-400 mt-2 font-mono">{d.time}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Window Performance (Horizontal Bar) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                        <Users size={18} /> 窗口绩效TOP
                    </h3>
                    <div className="space-y-4">
                        {metrics.windowPerformance.map((w, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-700">#{w.windowNumber} {w.windowName}</span>
                                    <span className="font-bold text-gray-900">{w.servedCount} 人</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 rounded-full"
                                        style={{ width: `${(w.servedCount / maxWindow) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs text-gray-400 text-right">平均处理 {w.avgTime} 分/人</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
