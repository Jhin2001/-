import React, { useEffect, useState } from 'react';
import { GitBranch, Plus, Save, Trash2, AlertTriangle, Info } from 'lucide-react';
import api from '../services/api';
import { QueueRule } from '../types';
import { useToast } from './ToastProvider';
import ConfirmModal from './ConfirmModal';

const RuleSettings: React.FC = () => {
    const [rules, setRules] = useState<QueueRule[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await api.admin.getRules();
            setRules(data);
        } finally {
            setLoading(false);
        }
    };

    const addRule = () => {
        const newRule: QueueRule = {
            id: `rule-${Date.now()}`,
            name: '新规则',
            prefix: '',
            targetWindows: [],
            isVip: false,
            priority: 0
        };
        setRules([...rules, newRule]);
    };

    const updateRule = (id: string, field: keyof QueueRule, value: any) => {
        setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const saveRule = async (rule: QueueRule) => {
        if (!rule.prefix) { toast.error("前缀不能为空"); return; }
        await api.admin.saveRule(rule);
        toast.success("规则已保存");
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        await api.admin.deleteRule(deleteId);
        setRules(rules.filter(r => r.id !== deleteId));
        toast.success("规则已删除");
        setDeleteId(null);
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <GitBranch className="text-blue-600" /> 分诊规则配置
                    </h2>
                    <p className="text-gray-500 mt-1">设置号码前缀与窗口的绑定关系，以及 VIP 优先策略。</p>
                </div>
                <button onClick={addRule} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Plus size={18} /> 新增规则
                </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800 flex items-start gap-3">
                <Info size={20} className="shrink-0 mt-0.5" />
                <div>
                    <strong>规则说明：</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 opacity-90">
                        <li>当新号码生成时，系统会匹配号码前缀 (如 A001 匹配 "A")。</li>
                        <li>匹配成功的号码将仅分配给指定的“目标窗口”进行呼叫。</li>
                        <li>勾选 <strong>VIP 优先</strong> 后，该类号码将自动插入到等待队列的最前方。</li>
                    </ul>
                </div>
            </div>

            <div className="space-y-4">
                {rules.map((rule) => (
                    <div key={rule.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">规则名称</label>
                                <input 
                                    type="text" value={rule.name}
                                    onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                                    className="w-full border p-2 rounded text-sm"
                                    placeholder="e.g. 西药常规"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">号码前缀 (Prefix)</label>
                                <input 
                                    type="text" value={rule.prefix}
                                    onChange={(e) => updateRule(rule.id, 'prefix', e.target.value)}
                                    className="w-full border p-2 rounded text-sm font-mono uppercase bg-gray-50"
                                    placeholder="e.g. A"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">目标窗口 (Window IDs)</label>
                                <input 
                                    type="text" value={rule.targetWindows.join(',')}
                                    onChange={(e) => updateRule(rule.id, 'targetWindows', e.target.value.split(','))}
                                    className="w-full border p-2 rounded text-sm font-mono"
                                    placeholder="1,2,3"
                                />
                                <div className="text-[10px] text-gray-400 mt-1">用逗号分隔</div>
                            </div>
                            <div className="flex items-center gap-4 pt-4 md:pt-0">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" checked={rule.isVip}
                                        onChange={(e) => updateRule(rule.id, 'isVip', e.target.checked)}
                                        className="w-5 h-5 accent-orange-500 rounded"
                                    />
                                    <span className={`text-sm font-bold ${rule.isVip ? 'text-orange-600' : 'text-gray-500'}`}>VIP 插队</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <button 
                                onClick={() => saveRule(rule)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded border border-transparent hover:border-green-200 transition-colors"
                                title="保存"
                            >
                                <Save size={20} />
                            </button>
                            <button 
                                onClick={() => setDeleteId(rule.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                                title="删除"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}

                {rules.length === 0 && !loading && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                        暂无规则，请点击上方“新增规则”
                    </div>
                )}
            </div>

            <ConfirmModal 
                isOpen={!!deleteId}
                title="删除规则"
                description="确定要删除此分诊规则吗？"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
                isDangerous={true}
            />
        </div>
    );
};

export default RuleSettings;
