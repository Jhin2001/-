
# 内网/离线环境资源部署指南 (Offline Resources Guide)

为了解决内网环境下 `ERR_INTERNET_DISCONNECTED` 或 `ERR_CONNECTION_RESET` 的报错，请按照以下步骤手动下载并部署静态资源。

## 1. 创建目录结构

在项目根目录（即 `index.html` 所在的同级目录）下，创建以下文件夹：

```
/
├── index.html
├── lib/               <-- 创建此文件夹 (存放 JS 库)
└── images/            <-- 创建此文件夹 (存放自定义图片，可选)
```

## 2. 下载并放置文件

请在有网络的电脑上下载以下文件，并拷贝到内网服务器的对应目录中。

### A. Tailwind CSS 引擎 (必需)
*   **文件名**: `tailwindcss.js`
*   **下载地址**: [https://cdn.tailwindcss.com/3.4.17](https://cdn.tailwindcss.com/3.4.17) (右键 -> 另存为)
*   **存放路径**: `/lib/tailwindcss.js`

### B. UniApp WebView SDK (必需 - 用于电视端通信)
*   **文件名**: `uni.webview.js`
*   **下载地址**: [https://js.cdn.aliyun.dcloud.net.cn/dev/uni-app/uni.webview.1.5.2.js](https://js.cdn.aliyun.dcloud.net.cn/dev/uni-app/uni.webview.1.5.2.js)
*   **存放路径**: `/lib/uni.webview.js`

### C. 登录背景图 (可选)
*   **说明**: 系统已内置默认的深色渐变背景（内嵌代码，无需下载）。如果您想自定义背景，可以下载任意图片并替换。
*   **可选操作**:
    1.  找一张 1920x1080 的 `.jpg` 图片。
    2.  命名为 `background.jpg`。
    3.  放入 `/images/` 文件夹中。
    4.  在系统登录后的“系统全局设置”中，将背景图链接修改为 `./images/background.jpg`。

## 3. 验证部署

完成上述步骤后：

1.  刷新浏览器。
2.  打开控制台 (F12)。
3.  确认不再出现 `cdn.tailwindcss.com` 等红色报错。

## 4. 清除旧缓存 (重要)

如果部署后仍然看到 Unsplash 404 报错，是因为浏览器缓存了旧的配置。请执行以下操作重置：

1.  在登录页地址栏后添加参数：`http://localhost:xxxx/?resetConfig=true`，然后按回车。
2.  页面刷新后，报错应消失，背景将显示为默认的深蓝色渐变。
