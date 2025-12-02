
import React, { useState, useEffect } from 'react';
import { DeviceBinding, Preset } from '../types';
import { Monitor, Plus, Edit2, Trash2, Save, X, CloudLightning, CloudOff, Server, ExternalLink, Hash } from 'lucide-react';
import api from '../services/api';
import { useToast } from './ToastProvider';
import ConfirmModal from './ConfirmModal';

interface DeviceManagerProps {
  devices: DeviceBinding[];
  presets: Preset[];
  onUpdateDevices: (devices: DeviceBinding[]) => void;
  isConnected?: boolean;
}

const DeviceManager: React.FC<DeviceManagerProps> = ({ devices, presets, onUpdateDevices, isConnected }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeviceBinding | null>(null);
  const [availablePresets, setAvailablePresets] = useState<{id: string, name: string}[]>([]);
  const toast = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch from API if connected
  useEffect(() => {
    if (isConnected) {
        // Fetch Devices
        api.admin.getDevices().then(apiDevices => {
            onUpdateDevices(apiDevices);
        }).catch(err => {
            if (err.message && err.message.includes('Failed to fetch')) return;
            console.error("Failed to fetch devices", err);
        });

        // Fetch Presets for Dropdown
        api.admin.getPresets().then(list => {
            const mapped = list.map((p:any) => ({ id: p.id || p.Id, name: p.name || p.Name }));
            setAvailablePresets(mapped);
        }).catch(console.error);

    } else {
        // Use local props if offline
        setAvailablePresets(presets);
    }
  }, [isConnected, presets]);

  // NEW: Quick add Server Monitor
  const handleAddServerMonitor = async () => {
      const serverDev: DeviceBinding = {
          id: 'SERVER_MONITOR',
          name: '服务端预览监视器',
          ipAddress: '127.0.0.1',
          macAddress: '00:00:00:00:00:00',
          assignedWindowNumber: '1',
          assignedWindowName: '综合窗口',
          linkedPresetId: availablePresets[0]?.id || '',
          status: 'online',
          lastSeen: new Date().toISOString()
      };

      if (isConnected) {
          try {
              await api.admin.saveDevice(serverDev);
              const apiDevices = await api.admin.getDevices();
              onUpdateDevices(apiDevices);
              toast.success("服务端监视器已创建");
          } catch(e) { console.error(e); toast.error("创建失败"); }
      } else {
          // Local
          const exists = devices.find(d => d.id === serverDev.id);
          if (!exists) onUpdateDevices([...devices, serverDev]);
          toast.success("服务端监视器已创建 (本地)");
      }
  };

  // NEW: Launch TV Mode for a specific device
  const handleLaunch = (deviceId: string) => {
      const url = `${window.location.origin}/?mode=tv&deviceId=${deviceId}`;
      window.open(url, '_blank');
  };

  const handleAddNew = () => {
    // Use a temporary ID for the editing state, but form ID is empty for user input
    const tempId = '__NEW_DEVICE__'; 
    const newDevice: DeviceBinding = {
      id: '', // Empty initially, user must input
      name: '新设备',
      ipAddress: '',
      macAddress: '',
      assignedWindowNumber: '1',
      assignedWindowName: '综合窗口',
      linkedPresetId: availablePresets[0]?.id || '',
      status: 'unregistered',
      lastSeen: new Date().toISOString()
    };
    setEditForm(newDevice);
    setEditingId(tempId);
  };

  const handleEdit = (device: DeviceBinding) => {
    setEditForm({ ...device });
    setEditingId(device.id);
  };

  const handleSave = async () => {
    if (!editForm) return;

    // Validation
    if (!editForm.id.trim()) {
        toast.error("设备 ID 不能为空");
        return;
    }

    if (isConnected) {
        try {
            // Fix: Ensure numerical values are converted to strings for backend compatibility
            const payload = {
                ...editForm,
                // If lastSeen is a number (timestamp), convert to ISO string. If 0, use current time.
                lastSeen: typeof editForm.lastSeen === 'number' 
                    ? new Date(editForm.lastSeen || Date.now()).toISOString()
                    : (editForm.lastSeen || new Date().toISOString()),
                // Ensure window number is string
                assignedWindowNumber: String(editForm.assignedWindowNumber || '')
            };

            await api.admin.saveDevice(payload as any);
            const apiDevices = await api.admin.getDevices();
            onUpdateDevices(apiDevices);
            setEditingId(null);
            setEditForm(null);
            toast.success("保存成功");
        } catch (e) {
            toast.error('保存失败: API 错误');
            console.error(e);
        }
        return;
    }
    
    // Local Fallback
    const exists = devices.find(d => d.id === editForm.id);
    let newDevices;
    if (exists && editingId !== '__NEW_DEVICE__') {
      newDevices = devices.map(d => d.id === editForm.id ? editForm : d);
    } else {
      // Check if ID collision for new device
      if (devices.find(d => d.id === editForm.id)) {
          toast.error("设备 ID 已存在");
          return;
      }
      newDevices = [...devices, editForm];
    }
    
    onUpdateDevices(newDevices);
    setEditingId(null);
    setEditForm(null);
    toast.success("保存成功 (本地)");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    
    if (isConnected) {
        try {
            await api.admin.deleteDevice(id);
            const apiDevices = await api.admin.getDevices();
            onUpdateDevices(apiDevices);
            toast.success("删除成功");
        } catch(e) {
            toast.error("删除失败");
            console.error(e);
        }
    } else {
        // Local Fallback
        onUpdateDevices(devices.filter(d => d.id !== id));
        toast.success("删除成功 (本地)");
    }
    setDeleteId(null);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'online': return { color: 'bg-green-500', label: '在线' };
      case 'offline': return { color: 'bg-red-500', label: '离线' };
      case 'unregistered': return { color: 'bg-yellow-500', label: '未注册' };
      default: return { color: 'bg-gray-300', label: '未知' };
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Monitor className="text-blue-600" />
            终端窗口管理
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <p className="text-gray-500">配置电视终端(Android)的 ID 绑定及对应的显示预案。</p>
             {isConnected ? (
                <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 rounded-full border border-green-200">
                    <CloudLightning size={10} /> API Connected
                </span>
             ) : (
                <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-2 rounded-full border border-gray-200">
                    <CloudOff size={10} /> Local Mode
                </span>
             )}
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleAddServerMonitor}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm"
                title="创建一个虚拟设备用于在本机预览效果"
            >
                <Server size={18} /> 创建服务端监视器
            </button>
            <button 
                onClick={handleAddNew}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
            >
                <Plus size={18} /> 新增终端
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">状态</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">设备 ID</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">设备名称</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">IP / MAC</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">绑定窗口</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">应用预案</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* New Item Creation Row */}
            {editingId === '__NEW_DEVICE__' && editForm && (
               <tr className="bg-blue-50 animate-in fade-in">
                 {renderEditRow(editForm, setEditForm, handleSave, () => setEditingId(null), availablePresets, true)}
               </tr>
            )}

            {devices.map(device => (
              <React.Fragment key={device.id}>
                {editingId === device.id && editForm ? (
                   <tr className="bg-blue-50">
                     {renderEditRow(editForm, setEditForm, handleSave, () => setEditingId(null), availablePresets, false)}
                   </tr>
                ) : (
                  // ... read mode row ...
                  <tr className={`hover:bg-gray-50 transition-colors ${device.id === 'SERVER_MONITOR' ? 'bg-purple-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-2.5 w-2.5 rounded-full ${getStatusConfig(device.status).color}`}></span>
                        <span className="text-sm text-gray-600">
                          {getStatusConfig(device.status).label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-gray-700">
                        {device.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                        {device.id === 'SERVER_MONITOR' && <Server size={14} className="inline mr-1 text-purple-600"/>}
                        {device.name}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">
                      <div>{device.ipAddress || '---'}</div>
                      <div className="text-xs text-gray-400">{device.macAddress}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-800">{device.assignedWindowName}</div>
                      <div className="text-xs text-gray-500">#{device.assignedWindowNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                        {availablePresets.find(p => p.id === device.linkedPresetId)?.name || device.linkedPresetId || '未知预案'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {/* Launch Button */}
                      <button 
                        onClick={() => handleLaunch(device.id)}
                        className="text-green-600 hover:bg-green-50 p-2 rounded flex items-center gap-1 text-xs font-bold border border-transparent hover:border-green-200"
                        title="在新窗口打开此终端画面"
                      >
                        <ExternalLink size={16} />
                      </button>

                      <div className="h-4 w-px bg-gray-300 mx-1"></div>

                      <button 
                        onClick={() => handleEdit(device)}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                         onClick={() => setDeleteId(device.id)}
                         className="text-red-500 hover:bg-red-50 p-2 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {devices.length === 0 && !editingId && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  暂无设备，请点击右上角新增
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal 
        isOpen={!!deleteId}
        title="确认删除"
        description="确定要删除此设备配置吗？"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        isDangerous={true}
      />
    </div>
  );
};

// Helper for row editing
const renderEditRow = (
  form: DeviceBinding, 
  setForm: React.Dispatch<React.SetStateAction<DeviceBinding | null>>,
  onSave: () => void,
  onCancel: () => void,
  presets: {id: string, name: string}[],
  isNew: boolean
) => (
  <>
    <td className="px-6 py-4">
       <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
          <span className="text-xs text-gray-500">配置中</span>
       </div>
    </td>
    {/* Device ID Input - Only editable if New */}
    <td className="px-6 py-4">
      {isNew ? (
          <div className="relative">
             <Hash size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
             <input 
                type="text" 
                value={form.id}
                onChange={(e) => setForm({...form, id: e.target.value})}
                className="w-full border border-blue-300 bg-white p-1.5 pl-7 rounded text-sm font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="TV-XXXX"
                autoFocus
             />
             <div className="text-[10px] text-blue-600 mt-1">请输入屏幕上显示的绿色ID</div>
          </div>
      ) : (
          <span className="font-mono font-bold text-gray-500">{form.id}</span>
      )}
    </td>
    <td className="px-6 py-4">
      <input 
        type="text" 
        value={form.name}
        onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full border p-1 rounded text-sm"
        placeholder="设备备注名"
      />
    </td>
    <td className="px-6 py-4 space-y-2">
      <input 
        type="text" 
        value={form.ipAddress}
        onChange={(e) => setForm({...form, ipAddress: e.target.value})}
        className="w-full border p-1 rounded text-sm font-mono"
        placeholder="IP Address"
      />
      <input 
        type="text" 
        value={form.macAddress}
        onChange={(e) => setForm({...form, macAddress: e.target.value})}
        className="w-full border p-1 rounded text-sm font-mono"
        placeholder="MAC Address"
      />
    </td>
    <td className="px-6 py-4 space-y-2">
      <input 
        type="text" 
        value={form.assignedWindowName}
        onChange={(e) => setForm({...form, assignedWindowName: e.target.value})}
        className="w-full border p-1 rounded text-sm font-bold"
        placeholder="窗口名称"
      />
      <input 
        type="text" 
        value={form.assignedWindowNumber}
        onChange={(e) => setForm({...form, assignedWindowNumber: e.target.value})}
        className="w-20 border p-1 rounded text-sm"
        placeholder="窗口号"
      />
    </td>
    <td className="px-6 py-4">
       <select 
         value={form.linkedPresetId}
         onChange={(e) => setForm({...form, linkedPresetId: e.target.value})}
         className="w-full border p-1 rounded text-sm"
       >
         {presets.map(p => (
           <option key={p.id} value={p.id}>{p.name}</option>
         ))}
       </select>
    </td>
    <td className="px-6 py-4 text-right">
       <div className="flex justify-end gap-2">
         <button onClick={onSave} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700">
           <Save size={16} />
         </button>
         <button onClick={onCancel} className="bg-gray-400 text-white p-1.5 rounded hover:bg-gray-500">
           <X size={16} />
         </button>
       </div>
    </td>
  </>
);

export default DeviceManager;
