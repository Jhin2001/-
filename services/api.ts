
import { QueueConfig, Patient, GlobalSystemSettings, DeviceBinding, DashboardMetrics, AuditLog, QueueRule } from '../types';

// Helper to get base URL dynamically
const getBaseUrl = () => {
    try {
        const settingsStr = localStorage.getItem('pqms_settings');
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.apiBaseUrl) return settings.apiBaseUrl;
        }
    } catch(e) {}

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `http://${hostname}:8081/api/v1`;
        }
    }
    return 'http://localhost:8081/api/v1'; 
}

interface ApiResponse<T> {
  code: number; 
  message: string;
  data: T;
}

export interface MediaFile {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video';
    size: number;
    uploadTime: string;
}

export class ApiError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = `${cleanBase}/${cleanEndpoint}`;
  
  const defaultHeaders: Record<string, string> = {};

  if (!(options.body instanceof FormData) && options.body) {
      defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(`HTTP Error ${response.status}: ${errorBody || response.statusText}`, response.status);
    }

    if (response.status === 204) return {} as T;

    const text = await response.text();
    if (!text) return {} as T;
    
    const result: ApiResponse<T> = JSON.parse(text);

    if (result.code !== undefined && result.code !== 0 && result.code !== 200) {
      throw new ApiError(result.message || 'Unknown Business Error', result.code);
    }

    if (result.data !== undefined) return result.data;
    if (Object.keys(result).length > 0 && result.data === undefined) return result as unknown as T;
    return {} as T;
    
  } catch (error: any) {
    // console.error(`[API Exception] ${url}`, error); // Quiet mode
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new ApiError('Connection Failed', 0);
    }
    throw error;
  }
}

const generateMockDashboard = (): DashboardMetrics => {
    return {
        todayServed: 128, waitingCount: 14, avgWaitTimeMinutes: 12.5, peakHour: "09:00 - 10:00",
        windowPerformance: [
            { windowNumber: "1", windowName: "西药窗", servedCount: 55, avgTime: 2.5 },
            { windowNumber: "2", windowName: "中药窗", servedCount: 32, avgTime: 4.8 },
            { windowNumber: "3", windowName: "综合窗", servedCount: 41, avgTime: 3.2 }
        ],
        trendData: [
            { time: "08:00", count: 12 }, { time: "09:00", count: 45 }, { time: "10:00", count: 32 }, { time: "11:00", count: 22 },
            { time: "12:00", count: 8 },  { time: "13:00", count: 15 }, { time: "14:00", count: 28 }, { time: "15:00", count: 35 }
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
    health: () => request<{ status: string; serverTime: string; version: string; }>('/system/health')
  },
  device: {
    getConfig: (deviceId: string, ip?: string) => request<QueueConfig>(`/device/${deviceId}/config?ip=${ip || ''}`),
    heartbeat: (deviceId: string, status: 'online' | 'error', details?: any) => request<void>('/device/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ deviceId, status, timestamp: Date.now(), details }),
    })
  },
  queue: {
    getSnapshot: (windowNumber?: string, deviceId?: string) => {
      const params = new URLSearchParams();
      if (windowNumber) params.append('window', windowNumber);
      if (deviceId) params.append('deviceId', deviceId);
      const queryString = params.toString();
      return request<{
        currentPatient: Patient; waitingList: Patient[]; passedList: Patient[]; version: string; 
      }>(`/queue/snapshot${queryString ? `?${queryString}` : ''}`);
    },
    callNext: (windowNumber: string) => request<{ result: string; patient: Patient }>('/queue/call', { method: 'POST', body: JSON.stringify({ windowNumber, action: 'next' }) }),
    recall: (patientId: string) => request<{ result: string }>('/queue/recall', { method: 'POST', body: JSON.stringify({ patientId }) }),
    pass: (patientId: string) => request<{ result: string }>('/queue/pass', { method: 'POST', body: JSON.stringify({ patientId }) }),
    top: (patientId: string) => request<{ result: string }>('/queue/top', { method: 'POST', body: JSON.stringify({ patientId }) }),
    restore: (patientId: string) => request<{ result: string }>('/queue/restore', { method: 'POST', body: JSON.stringify({ patientId }) }),
    delete: (patientId: string) => request<{ result: string }>('/queue/delete', { method: 'POST', body: JSON.stringify({ patientId }) })
  },
  admin: {
    login: (password: string) => request<{ token: string; user: any }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
    getSystemSettings: () => request<GlobalSystemSettings>('/admin/settings'),
    saveSystemSettings: (settings: GlobalSystemSettings) => request<void>('/admin/settings', { method: 'POST', body: JSON.stringify(settings) }),
    getDevices: () => request<DeviceBinding[]>('/admin/devices'),
    saveDevice: (device: DeviceBinding) => request<void>('/admin/device/save', { method: 'POST', body: JSON.stringify(device) }),
    deleteDevice: (deviceId: string) => request<void>(`/admin/device/${deviceId}`, { method: 'DELETE' }),
    getPresets: () => request<{id: string, name: string}[]>('/admin/presets'),
    getPreset: (id: string) => request<QueueConfig>(`/admin/preset/${id}`),
    savePreset: (id: string, name: string, config: QueueConfig) => request<void>('/admin/preset/save', { method: 'POST', body: JSON.stringify({ id, name, config: JSON.stringify(config) }) }),
    deletePreset: (id: string) => request<void>(`/admin/preset/${id}`, { method: 'DELETE' }),
    getMediaFiles: () => request<MediaFile[]>('/admin/media'),
    uploadFile: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<MediaFile>('/admin/upload', { method: 'POST', body: formData });
    },
    getDashboardStats: async () => { try { return await request<DashboardMetrics>('/admin/dashboard'); } catch (e) { return generateMockDashboard(); } },
    getLogs: async () => { try { return await request<AuditLog[]>('/admin/logs'); } catch (e) { return generateMockLogs(); } },
    getRules: async () => {
         try { return await request<QueueRule[]>('/admin/rules'); } catch (e) {
            try { return JSON.parse(localStorage.getItem('pqms_rules') || '[]'); } catch(e) { return []; }
        }
    },
    saveRule: async (rule: QueueRule) => {
         try { return await request<void>('/admin/rules', { method: 'POST', body: JSON.stringify(rule) }); } catch (e) {
            try {
                const saved = localStorage.getItem('pqms_rules');
                const rules = saved ? JSON.parse(saved) : [];
                const idx = rules.findIndex((r:any) => r.id === rule.id);
                if (idx >= 0) rules[idx] = rule; else rules.push(rule);
                localStorage.setItem('pqms_rules', JSON.stringify(rules));
            } catch(e) {}
        }
    },
    deleteRule: async (id: string) => {
         try { return await request<void>(`/admin/rules/${id}`, { method: 'DELETE' }); } catch (e) {
            try {
                const saved = localStorage.getItem('pqms_rules');
                if(saved) {
                    const rules = JSON.parse(saved);
                    localStorage.setItem('pqms_rules', JSON.stringify(rules.filter((r:any) => r.id !== id)));
                }
            } catch(e) {}
        }
    }
  }
};

export default api;
