

# 药房排队系统前端 - IIS 部署指南

本文档介绍如何将药房排队系统的前端项目（React）部署到 Windows Server 的 IIS (Internet Information Services) 上。

## 1. 环境准备

### 开发环境 (构建机)
*   **Node.js**: 需要安装 Node.js (建议 v16+) 以便打包项目。

### 服务器环境 (运行机)
*   **Windows Server**: 2016 / 2019 / 2022。
*   **IIS**: 已启用 Web 服务器 (IIS) 角色。
*   **IIS URL Rewrite 模块**: **(关键)** 必须安装，用于支持单页应用路由。
    *   下载地址: [Microsoft URL Rewrite Module 2.1](https://www.iis.net/downloads/microsoft/url-rewrite)

## 2. 项目构建

在将代码部署到服务器之前，需要先编译生成静态文件。

1.  打开命令行终端，进入项目根目录。
2.  安装依赖（如果尚未安装）：
    ```bash
    npm install
    ```
3.  执行构建命令：
    ```bash
    npm run build
    ```
4.  构建完成后，会在项目根目录下生成一个 `build` (或 `dist`) 文件夹。
    *   这个文件夹包含了 `index.html`、`web.config` 以及 `static/` 目录。
    *   **这就是我们需要部署到 IIS 的全部内容。**

## 3. IIS 站点配置

1.  **复制文件**: 将 `build` (或 `dist`) 文件夹中的所有内容复制到服务器上的某个目录，例如 `C:\inetpub\wwwroot\pharmacy-queue`。
    *   *注意：确保 `web.config` 文件也在其中。*
2.  **打开 IIS 管理器**: `Win + R` 输入 `inetmgr`。
3.  **添加网站**:
    *   右键点击 "网站" -> "添加网站"。
    *   **网站名称**: PharmacyQueue (自定义)。
    *   **物理路径**: 选择步骤1中的文件夹路径 (例如 `C:\inetpub\wwwroot\pharmacy-queue`)。
    *   **端口**: 设置一个未被占用的端口，例如 `8080` (HTTP) 或 `443` (HTTPS)。
    *   点击 "确定"。

## 4. 常见问题排查 (Troubleshooting)

### Q1: "localhost 发送了无效的响应" (ERR_SSL_PROTOCOL_ERROR)
*   **现象**: 浏览器显示“此站点的连接不安全”或“发送了无效的响应”。
*   **原因**: 协议不匹配。你可能正在尝试用 `https://` 访问一个只绑定了 HTTP 端口的 IIS 站点。
    *   例如：IIS 绑定的是 `8080` (HTTP)，但你在浏览器输入了 `https://localhost:8080`。
*   **解决**:
    *   请使用 `http://` 访问（例如 `http://localhost:8080`）。
    *   如果必须使用 HTTPS，请在 IIS 绑定设置中添加 HTTPS 绑定并选择有效的 SSL 证书。

### Q2: 访问页面出现 HTTP 500.19 错误
*   **原因**: 通常是因为没有安装 **URL Rewrite 模块**，但 `web.config` 中配置了 `<rewrite>` 节点。
*   **解决**: 请下载并安装 [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite)，安装后需重启 IIS。

### Q3: 页面能打开，但点击刷新后 404
*   **原因**: `web.config` 文件缺失。
*   **解决**: 确保构建输出中包含了 `web.config` 文件，并且该文件位于网站根目录下。

### Q4: 权限问题 "Temporary ASP.NET Files"
*   **错误信息**: `Current identity (IIS APPPOOL\xxx) does not have write access to 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Temporary ASP.NET Files'`
*   **解决**:
    1. 在 IIS 管理器中，点击左侧 **应用程序池**。
    2. 双击你的网站对应的应用程序池。
    3. 将 **.NET CLR 版本** 设置为 **无托管代码 (No Managed Code)**。
    4. 确定并回收/重启应用程序池。

### Q5: DELETE/PUT 请求失败 (405 Method Not Allowed 或 Network Error)
*   **现象**: 在管理后台删除设备或预案时，控制台报错 "Failed to fetch" 或 "405 Method Not Allowed"。
*   **原因**: IIS 默认启用了 **WebDAV 模块**，该模块通常会拦截并阻止 `PUT` 和 `DELETE` 请求。
*   **解决**: 
    *   **方法一 (推荐)**: 确保项目根目录下的 `web.config` 包含 `<modules><remove name="WebDAVModule" /></modules>`。构建后的 `web.config` 已经默认包含了此修复。
    *   **方法二 (手动)**: 
        1. 在 IIS 管理器中，点击你的网站。
        2. 双击 **模块 (Modules)**。
        3. 找到 `WebDAVModule`，右键点击 -> **删除**。
        4. 返回网站首页，双击 **处理程序映射 (Handler Mappings)**。
        5. 找到 `WebDAV`，右键点击 -> **删除**。

## 5. API 连接配置

部署完成后，请务必在前端页面的 **系统设置** 中配置正确的后端 API 地址。
*   如果在本地 IIS 部署且没有配置 SSL 证书，请确保 API 地址也是 `http://` 开头，或者如果是 `https://` 开头（如 IIS Express），请务必先在浏览器中单独访问 API 地址并信任证书。
