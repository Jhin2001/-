

# 药房排队叫号系统 (Pharmacy Queue System) - 后端 API 接口文档

**版本**: v1.0.3  
**日期**: 2025-05-20  
**适用端**: Android TV (UniApp), Web 管理后台, 呼叫器终端

---

## 1. 基础规范 (General)

### 1.1 接口地址
*   **Base URL**: `http://{server_ip}:{port}/api/v1`
*   **协议**: HTTP/1.1 (建议生产环境使用 HTTPS)

### 1.2 请求头 (Headers)
所有请求应包含：
*   `Content-Type: application/json`
*   `Authorization: Bearer {token}` (仅限管理后台接口)

### 1.3 通用响应格式 (Response Wrapper)
所有接口（除非特殊说明）均返回统一的 JSON 结构：

```json
{
  "code": 200,          // 业务状态码: 200=成功, 400=参数错误, 500=系统异常, 401=未登录
  "message": "success", // 提示信息，用于前端 Toast 显示
  "data": { ... }       // 具体的业务数据对象或数组
}
```

### 1.4 时间格式 (Time Format)
*   **重要**: 所有时间字段 (如 `lastSeen`, `checkInTime`) 统一使用 **标准日期时间字符串**，格式为 `yyyy-MM-dd HH:mm:ss.fff`。
*   示例: `"2025-11-30 14:30:05.123"`

---

## 2. 核心数据模型 (Data Models)

### Patient (患者/队列项)
```json
{
  "id": "uuid-string",
  "name": "张三",
  "number": "A001",           // 排队号
  "status": 0,                // 0=等待(Waiting), 1=正在叫号(Calling), 2=已过号(Passed), 9=完成(Done)
  "windowNumber": "1",        // 分配的窗口号
  "windowName": "西药房",      // 窗口名称
  "checkInTime": "2025-11-30 08:30:00.000", // 报到时间
  "callTime": "2025-11-30 09:15:22.123"     // 最近一次叫号时间
}
```

### DeviceBinding (设备终端)
```json
{
  "id": "TV-001",             // 设备唯一标识 (Client ID)
  "name": "大厅1号屏",
  "ipAddress": "192.168.1.10",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "assignedWindowNumber": "1", // 绑定的窗口号 (用于过滤语音和数据)
  "linkedPresetId": "preset_1",// 绑定的 UI 样式预案 ID
  "status": "online",          // online, offline
  "lastSeen": "2025-11-30 14:00:00.000"
}
```

### GlobalSystemSettings (系统全局配置)
```json
{
  "loginTitle": "药房排队叫号管理系统",
  "loginSubtitle": "Distributed Queue Management System",
  "loginBackgroundImage": "https://...",
  "adminPassword": "...",
  "systemName": "市中心医院",
  "apiBaseUrl": "https://api.hospital.com"
}
```

---

## 3. 终端设备接口 (Device API)

**调用方**: Android TV, UniApp 壳子  
**鉴权**: 无需 Token，通过 `deviceId` 识别

### 3.1 获取设备启动配置 (Bootstrap)
终端开机时调用。后端需根据 `deviceId` 查找绑定的预案 (Preset) 和窗口信息，并将它们合并返回。

*   **Method**: `GET`
*   **Path**: `/device/{deviceId}/config`
*   **Params**:
    *   `ip`: (Query, Optional) 上报设备当前 IP
*   **Response**: 返回前端 `QueueConfig` 完整 JSON 对象。
    *   **逻辑说明**:
        1.  在 `Devices` 表查找 `{deviceId}`。
        2.  如果没找到，返回默认配置，标记 `isRegistered: false`。
        3.  如果找到，读取 `linkedPresetId` 对应的 `Presets` 表中的 JSON。
        4.  **关键**: 将设备绑定的 `assignedWindowNumber` 覆盖到 Config JSON 中的 `windowNumber` 字段，确保每台电视显示正确的窗口号。

### 3.2 设备心跳上报 (Heartbeat)
终端每隔 30-60 秒调用一次，用于运维监控。

*   **Method**: `POST`
*   **Path**: `/device/heartbeat`
*   **Body**:
    ```json
    {
      "deviceId": "TV-001",
      "status": "online",
      "timestamp": "2025-11-30 14:00:00.000",
      "details": {
         "appVersion": "1.0.2",
         "ip": "192.168.1.55"
      }
    }
    ```
*   **Response**: `{ "code": 200 }`

---

## 4. 队列业务接口 (Queue API)

**调用方**: 显示屏(轮询), 叫号器软件, 医生工作站

### 4.1 获取队列快照 (Polling Snapshot)
**高频接口**。前端每隔 N 秒调用一次。

*   **Method**: `GET`
*   **Path**: `/queue/snapshot`
*   **Params**:
    *   `window`: (Query, Optional) 窗口号过滤。
        *   若传值 (e.g., `?window=1`)，只返回该窗口的队列数据（分诊屏模式）。
        *   若不传，返回所有窗口数据（综合大屏模式）。
    *   `deviceId`: (Query, Optional) 设备ID，用于后端判断该设备是走直连数据库(Pull)还是本地推送(Push)。
*   **Response**:
    ```json
    {
      "code": 200,
      "data": {
         "version": "a1b2c3d4", // 数据版本号/Hash。前端对比此值，若相同则不刷新 UI。
         "currentPatient": { ...PatientObj... }, // 当前正在叫号的（最新的一个）
         "waitingList": [ ...PatientObj... ],    // 等待列表
         "passedList": [ ...PatientObj... ]      // 过号列表（建议只返回最近 20 条）
      }
    }
    ```

### 4.2 叫号 (Call Next)
*   **Method**: `POST`
*   **Path**: `/queue/call`
*   **Body**:
    ```json
    {
      "windowNumber": "1",
      "action": "next" // next=顺呼, retry=重呼当前
    }
    ```
*   **逻辑说明**:
    1.  开启事务。
    2.  将该窗口当前状态为 `1 (Calling)` 的患者状态改为 `2 (Passed)`。
    3.  从等待队列（状态 `0`）中取 `CheckInTime` 最早的一位，状态改为 `1 (Calling)`，更新 `CallTime` 为当前时间。
    4.  返回这位新患者的信息。

### 4.3 重呼 (Recall)
*   **Method**: `POST`
*   **Path**: `/queue/recall`
*   **Body**: `{ "patientId": "123" }`
*   **逻辑说明**:
    1.  更新该患者的 `CallTime` 为当前时间（这将触发前端重新播放语音）。
    2.  不改变状态。

### 4.4 过号 (Pass)
*   **Method**: `POST`
*   **Path**: `/queue/pass`
*   **Body**: `{ "patientId": "123" }`
*   **逻辑说明**:
    1.  将指定患者状态改为 `2 (Passed)`。
    2.  如果是当前正在叫号的患者，需要清空 `currentPatient`。

### 4.5 优先/置顶 (Top)
*   **Method**: `POST`
*   **Path**: `/queue/top`
*   **Body**: `{ "patientId": "123" }`
*   **逻辑说明**:
    1.  修改该患者的 `CheckInTime` 为 `Min(CheckInTime) - 1秒`，使其排到队首。

### 4.6 删除/完成 (Delete)
*   **Method**: `POST`
*   **Path**: `/queue/delete`
*   **Body**: `{ "patientId": "123" }`
*   **逻辑说明**: 软删除或硬删除该记录。

---

## 5. 管理后台接口 (Admin API)

**调用方**: Web 配置面板 (ConfigPanel)

### 5.1 获取所有设备
*   **Method**: `GET`
*   **Path**: `/admin/devices`
*   **Response**:
    ```json
    {
      "code": 200,
      "data": [ 
          { 
              "id": "TV-01", 
              "name": "设备1", 
              "lastSeen": "2025-11-30 14:00:00.000",
              "status": "online"
          } 
      ]
    }
    ```

### 5.2 保存/注册设备
*   **Method**: `POST`
*   **Path**: `/admin/device/save`
*   **Body**: `DeviceBinding` 对象
*   **逻辑说明**: 根据 `id` 进行 Upsert (存在则更新，不存在则插入)。

### 5.3 删除设备
*   **Method**: `DELETE`
*   **Path**: `/admin/device/{id}`

### 5.4 获取所有预案列表
*   **Method**: `GET`
*   **Path**: `/admin/presets`
*   **Response**: 返回预案摘要列表（不包含巨大的 config json，节省流量）。
    ```json
    { "data": [ { "id": "p1", "name": "默认样式" }, ... ] }
    ```

### 5.5 获取单个预案详情
*   **Method**: `GET`
*   **Path**: `/admin/preset/{id}`
*   **Response**: 返回包含完整 `config` JSON 的预案对象。

### 5.6 保存预案
*   **Method**: `POST`
*   **Path**: `/admin/preset/save`
*   **Body**:
    ```json
    {
      "id": "preset_new",
      "name": "春节限定皮肤",
      "config": "{ ...Escaped JSON String... }" 
      // 注意: 后端可能要求 config 字段是 JSON 字符串而不是对象
    }
    ```

### 5.7 获取系统全局设置
*   **Method**: `GET`
*   **Path**: `/admin/settings`
*   **Response**: `GlobalSystemSettings` 对象。

### 5.8 保存系统全局设置
*   **Method**: `POST`
*   **Path**: `/admin/settings`
*   **Body**: `GlobalSystemSettings` 对象。

### 5.9 删除预案
*   **Method**: `DELETE`
*   **Path**: `/admin/preset/{id}`
*   **Response**: `{ "code": 200 }`
*   **逻辑说明**: 根据 ID 从数据库中物理删除该预案配置。

---

## 6. 系统基础接口 (System API)

**调用方**: 所有终端, 管理后台

### 6.1 服务健康检查 (Health Check)
用于前端检测后端服务是否在线，以及测试网络连接通断。此接口不应包含任何业务逻辑验证。

*   **Method**: `GET`
*   **Path**: `/system/health`
*   **Auth**: 无需鉴权
*   **Response**:
    ```json
    {
      "code": 200,
      "message": "success",
      "data": {
         "status": "online",
         "serverTime": "2025-05-20 12:00:00.000", // 服务器当前时间
         "version": "1.0.0" // 后端版本号
      }
    }
    ```