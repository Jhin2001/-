
import React, { useState } from 'react';
import { DeviceBinding, Preset } from '../types';
import { Monitor, Plus, Edit2, Trash2, Save, X, Activity, Wifi } from 'lucide-react';

interface DeviceManagerProps {
  devices: DeviceBinding[];
  presets: Preset[];
  onUpdateDevices: (devices: DeviceBinding[]) => void;
}

const DeviceManager: React.FC<DeviceManagerProps> = ({ devices, presets, onUpdateDevices }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeviceBinding | null>(null);

  const handleAddNew = () => {
    const newDevice: DeviceBinding = {
      id: Date.now().toString(),
      name: '新设备',
      ipAddress: '',
      macAddress: '',
      assignedWindowNumber: '1',
      assignedWindowName: '综合窗口',
      linkedPresetId: presets[0]?.id || '',
      status: 'unregistered',
      lastSeen: 0
    };
    setEditForm(newDevice);
    setEditingId(newDevice.id);
  };

  const handleEdit = (device: DeviceBinding) => {
    setEditForm({ ...device });
    setEditingId(device.id);
  };

  const handleSave = () => {
    if (!editForm) return;
    
    const exists = devices.find(d => d.id === editForm.id);
    let newDevices;
    if (exists) {
      newDevices = devices.map(d => d.id === editForm.id ? editForm : d);
    } else {
      newDevices = [...devices, editForm];
    }
    
    onUpdateDevices(newDevices);
    setEditingId(null);
    setEditForm(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定删除此设备配置吗?')) {
      onUpdateDevices(devices.filter(d => d.id !== id));
    }
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
          <p className="text-gray-500 mt-1">配置电视终端(Android)的 IP/MAC 绑定及对应的显示预案。</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} /> 新增终端
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">状态</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">设备名称</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">IP / MAC</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">绑定窗口</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">应用预案</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* If adding new item that isn't in list yet */}
            {editingId && !devices.find(d => d.id === editingId) && editForm && (
               <tr className="bg-blue-50">
                 {renderEditRow(editForm, setEditForm, handleSave, () => setEditingId(null), presets)}
               </tr>
            )}

            {devices.map(device => (
              <React.Fragment key={device.id}>
                {editingId === device.id && editForm ? (
                   <tr className="bg-blue-50">
                     {renderEditRow(editForm, setEditForm, handleSave, () => setEditingId(null), presets)}
                   </tr>
                ) : (
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-2.5 w-2.5 rounded-full ${getStatusConfig(device.status).color}`}></span>
                        <span className="text-sm text-gray-600">
                          {getStatusConfig(device.status).label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{device.name}</td>
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
                        {presets.find(p => p.id === device.linkedPresetId)?.name || '未知预案'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleEdit(device)}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                         onClick={() => handleDelete(device.id)}
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
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  暂无设备，请点击右上角新增
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Helper for row editing
const renderEditRow = (
  form: DeviceBinding, 
  setForm: React.Dispatch<React.SetStateAction<DeviceBinding | null>>,
  onSave: () => void,
  onCancel: () => void,
  presets: Preset[]
) => (
  <>
    <td className="px-6 py-4">
       <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
          <span className="text-xs text-gray-500">未注册</span>
       </div>
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
        placeholder="窗口名称 (e.g. 麻精窗)"
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
