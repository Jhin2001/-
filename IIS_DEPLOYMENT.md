
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
    *   这个文件夹包含了 `index.html` 以及 `static/` 目录。
    *   **这就是我们需要部署到 IIS 的全部内容。**

## 3. IIS 站点配置

1.  **复制文件**: 将 `build` 文件夹中的所有内容复制到服务器上的某个目录，例如 `C:\inetpub\wwwroot\pharmacy-queue`。
2.  **打开 IIS 管理器**: `Win + R` 输入 `inetmgr`。
3.  **添加网站**:
    *   右键点击 "网站" -> "添加网站"。
    *   **网站名称**: PharmacyQueue (自定义)。
    *   **物理路径**: 选择步骤1中的文件夹路径 (例如 `C:\inetpub\wwwroot\pharmacy-queue`)。
    *   **端口**: 设置一个未被占用的端口，例如 `8080` 或 `80`。
    *   点击 "确定"。

## 4. 配置 web.config (解决 SPA 路由与 404 问题)

React 是单页应用 (SPA)，如果用户直接访问非根路径（例如刷新页面），IIS 会默认寻找对应的物理文件而导致 404 错误。我们需要配置 URL 重写规则，将所有非静态资源的请求都指向 `index.html`。

在部署目录（即 `C:\inetpub\wwwroot\pharmacy-queue`）下，创建一个名为 `web.config` 的文件，并粘贴以下内容：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!-- 
      重要: 需要安装 IIS URL Rewrite 模块 
      下载: https://www.iis.net/downloads/microsoft/url-rewrite
    -->
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <!-- 如果请求的是文件，则不重写 -->
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <!-- 如果请求的是目录，则不重写 -->
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <!-- 如果请求的是 API 路径 (假设后端也在同域下)，则不重写 -->
            <!-- 如果后端是独立域名，这一行可以去掉 -->
            <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
          </conditions>
          <!-- 所有其他请求重写到 index.html -->
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>

    <!-- 配置 MIME 类型，确保 .json 等文件能正确加载 -->
    <staticContent>
        <remove fileExtension=".json" />
        <mimeMap fileExtension=".json" mimeType="application/json" />
        <remove fileExtension=".woff" />
        <mimeMap fileExtension=".woff" mimeType="font/woff" />
        <remove fileExtension=".woff2" />
        <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
</configuration>
```

## 5. 常见问题排查

### Q1: 访问页面出现 HTTP 500.19 错误
*   **原因**: 通常是因为没有安装 **URL Rewrite 模块**，但 `web.config` 中配置了 `<rewrite>` 节点。
*   **解决**: 请下载并安装 [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite)，安装后需重启 IIS。

### Q2: 页面能打开，但点击刷新后 404
*   **原因**: `web.config` 文件缺失或配置不正确。
*   **解决**: 确保 `web.config` 文件存在于网站根目录，并且内容如第4步所示。

### Q3: 无法加载 .json 文件或字体图标
*   **原因**: IIS 默认可能没有添加某些 MIME 类型。
*   **解决**: `web.config` 中的 `<staticContent>` 部分已经处理了常见类型。如果仍有问题，可在 IIS 管理器中手动检查 "MIME 类型" 设置。

### Q4: 权限问题 (访问被拒绝)
*   **解决**: 确保 `IUSR` 或 `IIS_IUSRS` 用户组对物理文件夹 (`C:\inetpub\wwwroot\pharmacy-queue`) 拥有 **读取** 和 **执行** 权限。

## 6. 与后端 API 的连接

部署完成后，前端默认连接的 API 地址可能需要修改。
1.  打开浏览器访问部署好的前端地址。
2.  进入 **系统全局设置** (System Settings)。
3.  修改 **后端 API 接口地址** 为实际的生产环境后端地址 (例如 `http://192.168.1.100:5000/api/v1`)。
4.  点击保存。
    *   *注意：此配置保存在浏览器 LocalStorage 或数据库中。如果更换浏览器访问，可能需要重新配置。*
