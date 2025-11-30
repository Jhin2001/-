
import { QueueConfig, PRESET_THEMES, GlobalSystemSettings, DeviceBinding } from './types';

export const DEFAULT_GLOBAL_SETTINGS: GlobalSystemSettings = {
  loginTitle: '药房排队叫号管理系统',
  loginSubtitle: 'Distributed Queue Management System',
  loginBackgroundImage: 'https://images.unsplash.com/photo-1516549655169-df83a0929519?q=80&w=2070&auto=format&fit=crop',
  adminPassword: '123456',
  apiPort: 8080,
  systemName: '南部市中心医院'
};

export const DEFAULT_DEVICES: DeviceBinding[] = [
  {
    id: 'd1',
    name: '1号窗口电视',
    ipAddress: '192.168.1.101',
    macAddress: 'AA:BB:CC:DD:EE:01',
    assignedWindowNumber: '1',
    assignedWindowName: '西药发药窗',
    linkedPresetId: 'default',
    status: 'online',
    lastSeen: Date.now()
  },
  {
    id: 'd2',
    name: '2号窗口电视',
    ipAddress: '192.168.1.102',
    macAddress: 'AA:BB:CC:DD:EE:02',
    assignedWindowNumber: '2',
    assignedWindowName: '麻精专窗',
    linkedPresetId: 'default',
    status: 'offline',
    lastSeen: Date.now() - 3600000
  }
];

export const DEFAULT_CONFIG: QueueConfig = {
  configVersion: 'v1.0.0', // Init version

  // Data
  currentPatient: { id: 'c1', name: '张三', number: 'A001', windowNumber: '2', windowName: '麻精专窗', callTimestamp: Date.now(), checkInTime: Date.now() - 300000 },
  waitingList: [
    { id: 'w1', name: '孙悟空', number: 'A109', checkInTime: Date.now() - 1200000, windowNumber: '1', windowName: '普通窗口' },
    { id: 'w2', name: '猪八戒', number: 'A110', checkInTime: Date.now() - 1150000, windowNumber: '1', windowName: '普通窗口' },
    { id: 'w3', name: '沙悟净', number: 'A111', checkInTime: Date.now() - 1100000, windowNumber: '2', windowName: '麻精专窗' },
    { id: 'w4', name: '唐僧', number: 'A112', checkInTime: Date.now() - 1050000, windowNumber: '2', windowName: '麻精专窗' },
    { id: 'w5', name: '白龙马', number: 'A113', checkInTime: Date.now() - 1000000, windowNumber: '1', windowName: '普通窗口' },
    { id: 'w6', name: '红孩儿', number: 'A114', checkInTime: Date.now() - 950000, windowNumber: '3', windowName: '咨询窗口' },
  ],
  passedList: [
    { id: 'p1', name: '丁一', number: 'A000', checkInTime: Date.now() - 5000000, windowNumber: '1', windowName: '普通窗口' },
    { id: 'p2', name: '赵六', number: 'A111', checkInTime: Date.now() - 4800000, windowNumber: '2', windowName: '麻精专窗' },
    { id: 'p3', name: '钱七', number: 'A112', checkInTime: Date.now() - 4600000, windowNumber: '1', windowName: '普通窗口' },
  ],

  // Specific Element Configs (Global Fallbacks)
  windowNumber: '2',
  windowName: '麻精专窗',
  windowNumberSize: 80,
  windowNameSize: 32,
  
  // Visuals
  showQueueNumber: true,
  queueNumberStyle: 'rounded',
  passedDisplayMode: 'zone', // Default to separate zone
  grayOutPassed: true,

  // Style
  theme: PRESET_THEMES.purple,
  cardRounded: 12,

  // New Header Config
  header: {
    show: true,
    height: 80,
    logoType: 'default',
    hospitalName: '南部市中心医院',
    hospitalNameSize: 28,
    centerTitle: '药房取药叫号',
    centerTitleSize: 20,
    showCenterTitle: true,
    rightContentType: 'time',
    rightTextContent: '请保持安静',
    timeFormat: 'HH:mm:ss',
  },

  // New Layout Config
  layout: {
    orientation: 'landscape', // Default
    gap: 16,
    containerPadding: 16,
    splitRatio: 40, // 40% Width for Left Column (Landscape)
    leftSplitRatio: 50, // 50% Height for Top Left
    rightSplitRatio: 50, // 50% Height for Top Right
    footerShow: true,
    footerText: '<span style="color: #fbbf24; font-weight: bold;">温馨提示：</span>取药时请核对药品名称、规格、数量，离柜概不负责。祝您早日康复！',
    footerHeight: 40,
    footerScroll: true,
    footerSpeed: 20,
    
    // Default Layout Assignment
    topLeft: { 
      type: 'window-info',
      showWindowNumber: true,
      windowNumberFontSize: 80,
      windowNameFontSize: 32,
      windowSubTitleHtml: '<div style="opacity:0.9;">请排队 取号</div>'
    },
    bottomLeft: { 
      type: 'current-call',
      showCurrentTitle: true,
      currentTitleText: '正在取药',
      currentTitleFontSize: 24,
      currentNameFontSize: 60,
      currentNumberFontSize: 36
    },
    topRight: { 
      type: 'waiting-list', 
      title: '等待取药', 
      titleColor: '#ffffff', 
      titleFontSize: 18,
      gridColumns: 2,
      gridRows: 4,
      contentFontSize: 24,
      includeCurrent: false,
      highlightCurrent: true
    },
    bottomRight: { 
      type: 'passed-list', 
      title: '过号患者', 
      titleColor: '#ffffff', 
      titleFontSize: 18,
      gridColumns: 2,
      gridRows: 3,
      contentFontSize: 20
    }
  },

  // System
  system: {
    apiBaseUrl: 'https://api.hospital.com/v1',
    deviceId: 'WIN-02',
    deviceMac: '00:1B:44:11:3A:B7',
    deviceIp: '192.168.1.102',
    isRegistered: true // Simulates a registered device
  },

  // Data Source
  dataSource: {
    mode: 'push',
    pollingStrategy: 'realtime', // Default to Realtime
    pollingInterval: 5,
    dbType: 'sqlserver',
    dbConnectionString: 'Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;',
    tableName: 'VIEW_PHARMACY_QUEUE_V1',
    fieldMap: {
      id: 'patient_id',
      name: 'patient_name',
      number: 'queue_no',
      status: 'queue_status',
      windowId: 'window_id',
      order: 'checkin_time'
    },
    statusMap: {
      waitingValue: '0',
      calledValue: '1',
      passedValue: '2'
    }
  },

  // Speech (Voice Broadcast)
  speech: {
    enabled: true,
    broadcastMode: 'all',
    template: '请 {number}号 {name} 到 {window} 取药',
    volume: 1,
    rate: 1,
    pitch: 1
  }
};
