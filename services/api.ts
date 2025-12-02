import { QueueConfig, Patient, GlobalSystemSettings, DeviceBinding, DashboardMetrics, AuditLog, QueueRule } from '../types';

// Helper to get base URL dynamically
const getBaseUrl = () => {
    // Try to read the global settings object first
    try {
        const settingsStr = localStorage.getItem('pqms_settings');
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.apiBaseUrl) return settings.apiBaseUrl;
        }
    } catch(e) {
        // Fallback or silence error in preview mode
    }
    // Fallback default
    return 'http://localhost:8081/api/v1'; 
}

interface ApiResponse<T> {
  code: number; // 0 或 200 表示成功
  message: string;
  data: T;
}

// Media File Interface
export interface MediaFile {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video';
    size: number;
    uploadTime: string;
}

// Custom Error Class
export class ApiError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/**
 * 统一 HTTP 请求封装
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = `${cleanBase}/${cleanEndpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    // 'Authorization': `Bearer ${localStorage.getItem('token')}` 
  };

  // Fix: Only add Content-Type if body exists (and is not FormData)
  // Some servers (IIS/WebDAV/Firewalls) block DELETE/GET requests that have Content-Type header
  if (!(options.body instanceof FormData) && options.body) {
      defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // --- DEBUG LOGGING ---
  console.log(`[API Request] ${config.method || 'GET'} ${url}`, config.body instanceof FormData ? '(FormData)' : (config.body ? '(JSON body)' : ''));

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Error] ${response.status} ${url}`, errorBody);
      throw new ApiError(`HTTP Error ${response.status}: ${errorBody || response.statusText}`, response.status);
    }

    if (response.status === 204) {
        return {} as T;
    }

    const text = await response.text();
    // Safely handle empty response that isn't 204
    if (!text) return {} as T;
    
    const result: ApiResponse<T> = JSON.parse(text);

    if (result.code !== undefined && result.code !== 0 && result.code !== 200) {
      throw new ApiError(result.message || 'Unknown Business Error', result.code);
    }

    if (result.data !== undefined) {
      return result.data;
    }
    
    // Some APIs might return the object directly without wrapper, or result.data is null
    // If result has keys but no 'data', assume result IS the data for legacy compatibility
    if (Object.keys(result).length > 0 && result.data === undefined) {
         return result as unknown as T;
    }
    
    // Strict mode: if we expect data but got none
    // throw new ApiError('Invalid API response: data field is missing');
    return {} as T;
    
  } catch (error: any) {
    console.error(`[API Exception] ${url}`, error);
    
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
        const isHttps = url.startsWith('https');
        const currentUrl = url;
        
        if (isLocalhost && isHttps) {
             // 尝试提供 HTTP 替代方案
             const httpUrl = currentUrl.replace('https://', 'http://');
             throw new ApiError(
               `连接失败: 无法连接到 ${currentUrl}\n\n` +
               `可能的原因：\n` +
               `1. API 服务未启动\n` +
               `2. HTTPS 证书未信任（本地开发环境）\n` +
               `3. 端口或地址配置错误\n\n` +
               `建议：\n` +
               `- 如果使用 IIS 部署，请将 API 地址改为 HTTP: ${httpUrl}\n` +
               `- 在浏览器中直接访问 API 地址测试连接\n` +
               `- 检查系统设置中的 API 地址配置`
             );
        } else if (isLocalhost) {
             throw new ApiError(
               `连接失败: 无法连接到 ${currentUrl}\n\n` +
               `可能的原因：\n` +
               `1. API 服务未启动\n` +
               `2. 端口或地址配置错误\n` +
               `3. 防火墙阻止了连接\n\n` +
               `建议：\n` +
               `- 确认 API 服务正在运行\n` +
               `- 在浏览器中直接访问: ${currentUrl.replace('/api/v1', '/api/v1/system/health')}\n` +
               `- 检查系统设置中的 API 地址配置`
             );
        }
    }
    throw error;
  }
}

// --- MOCK DATA GENERATORS (FOR OFFLINE/DEMO MODE) ---
const generateMockDashboard = (): DashboardMetrics => {
    return {
        todayServed: 128,
        waitingCount: 14,
        avgWaitTimeMinutes: 12.5,
        peakHour: "09:00 - 10:00",
        windowPerformance: [
            { windowNumber: "1", windowName: "西药窗", servedCount: 55, avgTime: 2.5 },
            { windowNumber: "2", windowName: "中药窗", servedCount: 32, avgTime: 4.8 },
            { windowNumber: "3", windowName: "综合窗", servedCount: 41, avgTime: 3.2 }
        ],
        trendData: [
            { time: "08:00", count: 12 }, { time: "09:00", count: 45 },
            { time: "10:00", count: 32 }, { time: "11:00", count: 22 },
            { time: "12:00", count: 8 },  { time: "13:00", count: 15 },
            { time: "14:00", count: 28 }, { time: "15:00", count: 35 }
        ]
    };
};

const generateMockLogs = (): AuditLog[] => {
    const actions = ['CALL_NEXT', 'PASS', 'LOGIN', 'CONFIG_UPDATE'];
    const logs: AuditLog[] = [];
    for(let i=0; i<20; i++) {
        logs.push({
            id: `log-${i}`,
            timestamp: new Date(Date.now() - i * 360000).toISOString(),
            operator: i % 5 === 0 ? 'Device-01' : 'Admin',
            action: actions[i % 4] as any,
            details: `Executed operation ${i}`,
            ipAddress: '192.168.1.' + (100 + i)
        });
    }
    return logs;
};

export const api = {
  system: {
    health: () => {
      return request<{
        status: string;
        serverTime: string;
        version: string;
      }>('/system/health');
    }
  },

  device: {
    getConfig: (deviceId: string, ip?: string) => {
      return request<QueueConfig>(`/device/${deviceId}/config?ip=${ip || ''}`);
    },
    heartbeat: (deviceId: string, status: 'online' | 'error', details?: any) => {
      return request<void>('/device/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ deviceId, status, timestamp: Date.now(), details }),
      });
    }
  },

  queue: {
    getSnapshot: (windowNumber?: string) => {
      const query = windowNumber ? `?window=${windowNumber}` : '';
      return request<{
        currentPatient: Patient;
        waitingList: Patient[];
        passedList: Patient[];
        version: string; 
      }>(`/queue/snapshot${query}`);
    },
    callNext: (windowNumber: string) => {
      return request<{ result: string; patient: Patient }>('/queue/call', {
        method: 'POST',
        body: JSON.stringify({ windowNumber, action: 'next' }),
      });
    },
    recall: (patientId: string) => {
      return request<{ result: string }>('/queue/recall', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },
    pass: (patientId: string) => {
      return request<{ result: string }>('/queue/pass', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },
    top: (patientId: string) => {
        return request<{ result: string }>('/queue/top', {
            method: 'POST',
            body: JSON.stringify({ patientId }),
        });
    },
    restore: (patientId: string) => {
      return request<{ result: string }>('/queue/restore', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },
    delete: (patientId: string) => {
      return request<{ result: string }>('/queue/delete', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    }
  },

  admin: {
    login: (password: string) => {
      return request<{ token: string; user: any }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
    getSystemSettings: () => {
      return request<GlobalSystemSettings>('/admin/settings');
    },
    saveSystemSettings: (settings: GlobalSystemSettings) => {
       return request<void>('/admin/settings', {
         method: 'POST',
         body: JSON.stringify(settings)
       });
    },
    getDevices: () => {
      return request<DeviceBinding[]>('/admin/devices');
    },
    saveDevice: (device: DeviceBinding) => {
      return request<void>('/admin/device/save', {
        method: 'POST',
        body: JSON.stringify(device),
      });
    },
    deleteDevice: (deviceId: string) => {
      return request<void>(`/admin/device/${deviceId}`, {
        method: 'DELETE'
      });
    },
    getPresets: () => {
      return request<{id: string, name: string}[]>('/admin/presets');
    },
    getPreset: (id: string) => {
      return request<QueueConfig>(`/admin/preset/${id}`);
    },
    savePreset: (id: string, name: string, config: QueueConfig) => {
      return request<void>('/admin/preset/save', {
        method: 'POST',
        body: JSON.stringify({ id, name, config: JSON.stringify(config) }),
      });
    },
    deletePreset: (id: string) => {
      return request<void>(`/admin/preset/${id}`, {
        method: 'DELETE'
      });
    },
    getMediaFiles: () => {
        return request<MediaFile[]>('/admin/media');
    },
    uploadFile: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<MediaFile>('/admin/upload', {
            method: 'POST',
            body: formData
        });
    },

    // --- NEW ANALYTICS & RULES ENDPOINTS ---

    getDashboardStats: async () => {
        try {
            return await request<DashboardMetrics>('/admin/dashboard');
        } catch (e) {
            console.warn("API Dashboard not available, using mock data");
            return generateMockDashboard();
        }
    },

    getLogs: async () => {
        try {
            return await request<AuditLog[]>('/admin/logs');
        } catch (e) {
            console.warn("API Logs not available, using mock data");
            return generateMockLogs();
        }
    },

    getRules: async () => {
         try {
            return await request<QueueRule[]>('/admin/rules');
        } catch (e) {
            try {
                const saved = localStorage.getItem('pqms_rules');
                return saved ? JSON.parse(saved) : [];
            } catch(e) { return []; }
        }
    },

    saveRule: async (rule: QueueRule) => {
         try {
            return await request<void>('/admin/rules', { method: 'POST', body: JSON.stringify(rule) });
        } catch (e) {
            // Local fallback
            try {
                const saved = localStorage.getItem('pqms_rules');
                const rules: QueueRule[] = saved ? JSON.parse(saved) : [];
                const idx = rules.findIndex(r => r.id === rule.id);
                if (idx >= 0) rules[idx] = rule;
                else rules.push(rule);
                localStorage.setItem('pqms_rules', JSON.stringify(rules));
            } catch(e) {}
        }
    },

    deleteRule: async (id: string) => {
         try {
            return await request<void>(`/admin/rules/${id}`, { method: 'DELETE' });
        } catch (e) {
            // Local fallback
            try {
                const saved = localStorage.getItem('pqms_rules');
                if(saved) {
                    const rules: QueueRule[] = JSON.parse(saved);
                    localStorage.setItem('pqms_rules', JSON.stringify(rules.filter(r => r.id !== id)));
                }
            } catch(e) {}
        }
    }
  }
};

export default api;