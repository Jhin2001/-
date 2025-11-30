


import { QueueConfig, Patient, GlobalSystemSettings, DeviceBinding } from '../types';
import { DEFAULT_CONFIG } from '../constants';

// Helper to get base URL dynamically
const getBaseUrl = () => {
    // Try to read the global settings object first
    const settingsStr = localStorage.getItem('pqms_settings');
    if (settingsStr) {
        try {
            const settings = JSON.parse(settingsStr);
            if (settings.apiBaseUrl) return settings.apiBaseUrl;
        } catch(e) {}
    }
    // Fallback default
    return 'https://localhost:30335/api/v1'; 
}

interface ApiResponse<T> {
  code: number; // 0 或 200 表示成功
  message: string;
  data: T;
}

/**
 * 统一 HTTP 请求封装
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  // Remove trailing slash if present in baseUrl, and leading slash in endpoint
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = `${cleanBase}/${cleanEndpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    // 如果有 Token 认证，可以在这里添加
    // 'Authorization': `Bearer ${localStorage.getItem('token')}` 
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // 处理 HTTP 错误状态
    if (!response.ok) {
      const errorBody = await response.text();
      // Throwing detailed error for caller to handle (e.g. 404)
      throw new Error(`HTTP Error ${response.status}: ${errorBody || response.statusText}`);
    }

    // FIX: Handle 204 No Content (Delete success with empty body)
    if (response.status === 204) {
        return {} as T;
    }

    // 解析 JSON
    const text = await response.text();
    const result: ApiResponse<T> = text ? JSON.parse(text) : {};

    // 处理业务错误码 (假设后端 0 或 200 为成功)
    if (result.code !== undefined && result.code !== 0 && result.code !== 200) {
      throw new Error(result.message || 'Unknown Business Error');
    }

    return result.data !== undefined ? result.data : (result as any);
  } catch (error) {
    // Re-throw to allow caller to handle connection errors
    throw error;
  }
}

export const api = {
  // --- 终端设备相关接口 ---
  device: {
    /**
     * 设备启动初始化：获取设备配置、绑定信息和 UI 预案
     * @param deviceId 设备唯一标识
     * @param ip (可选) 当前 IP
     */
    getConfig: (deviceId: string, ip?: string) => {
      // 这里的泛型 QueueConfig 代表期望后端返回的数据结构
      return request<QueueConfig>(`/device/${deviceId}/config?ip=${ip || ''}`);
    },

    /**
     * 发送心跳包：上报设备存活状态
     */
    heartbeat: (deviceId: string, status: 'online' | 'error', details?: any) => {
      return request<void>('/device/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ deviceId, status, timestamp: Date.now(), details }),
      });
    }
  },

  // --- 队列业务接口 ---
  queue: {
    /**
     * 获取当前队列快照 (用于轮询)
     * @param windowNumber (可选) 如果是本地模式，只拉取特定窗口的数据
     */
    getSnapshot: (windowNumber?: string) => {
      const query = windowNumber ? `?window=${windowNumber}` : '';
      return request<{
        currentPatient: Patient;
        waitingList: Patient[];
        passedList: Patient[];
        version: string; //用于比对是否需要刷新 UI 配置
      }>(`/queue/snapshot${query}`);
    },

    /**
     * 叫号 / 顺呼下一位
     */
    callNext: (windowNumber: string) => {
      return request<{ result: string; patient: Patient }>('/queue/call', {
        method: 'POST',
        body: JSON.stringify({ windowNumber, action: 'next' }),
      });
    },

    /**
     * 重呼当前患者
     */
    recall: (patientId: string) => {
      return request<{ result: string }>('/queue/recall', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },

    /**
     * 过号操作
     */
    pass: (patientId: string) => {
      return request<{ result: string }>('/queue/pass', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },
    
    /**
     * 优先/置顶
     */
    top: (patientId: string) => {
        return request<{ result: string }>('/queue/top', {
            method: 'POST',
            body: JSON.stringify({ patientId }),
        });
    },

    /**
     * 复位/重排 (Restore from passed to waiting)
     */
    restore: (patientId: string) => {
      return request<{ result: string }>('/queue/restore', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },

    /**
     * 删除 (Delete)
     */
    delete: (patientId: string) => {
      return request<{ result: string }>('/queue/delete', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    }
  },

  // --- 管理后台接口 ---
  admin: {
    /**
     * 管理员登录
     */
    login: (password: string) => {
      return request<{ token: string; user: any }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },

    /**
     * 获取系统全局配置 (从数据库)
     */
    getSystemSettings: () => {
      return request<GlobalSystemSettings>('/admin/settings');
    },

    /**
     * 保存系统全局配置 (到数据库)
     */
    saveSystemSettings: (settings: GlobalSystemSettings) => {
       return request<void>('/admin/settings', {
         method: 'POST',
         body: JSON.stringify(settings)
       });
    },

    /**
     * 获取所有设备列表
     */
    getDevices: () => {
      return request<DeviceBinding[]>('/admin/devices');
    },

    /**
     * 保存/更新设备信息
     */
    saveDevice: (device: DeviceBinding) => {
      return request<void>('/admin/device/save', {
        method: 'POST',
        body: JSON.stringify(device),
      });
    },

    /**
     * 删除设备
     */
    deleteDevice: (deviceId: string) => {
      return request<void>(`/admin/device/${deviceId}`, {
        method: 'DELETE'
      });
    },

    /**
     * 获取所有预案摘要列表
     */
    getPresets: () => {
      return request<{id: string, name: string}[]>('/admin/presets');
    },

    /**
     * 获取单个预案详情
     */
    getPreset: (id: string) => {
      return request<any>(`/admin/preset/${id}`);
    },

    /**
     * 保存全局预案/配置
     */
    savePreset: (presetId: string, name: string, config: QueueConfig) => {
      return request<void>('/admin/preset/save', {
        method: 'POST',
        // FIX: The backend C# model likely defines 'Config' as a string.
        // We must stringify the config object to pass it as a JSON string.
        body: JSON.stringify({ 
            id: presetId, 
            name, 
            config: JSON.stringify(config) 
        }),
      });
    },

    /**
     * 删除预案
     */
    deletePreset: (presetId: string) => {
      return request<void>(`/admin/preset/${presetId}`, {
        method: 'DELETE'
      });
    }
  }
};

export default api;
