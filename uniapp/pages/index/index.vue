<template>
	<view class="container">
		<!-- 1. 配置向导 (Setup Wizard) - 仅在未配置时显示 -->
		<!-- 使用 scroll-view 包裹，防止小屏手机显示不全 -->
		<scroll-view v-if="!isConfigured" scroll-y="true" class="scroll-container">
			<view class="setup-panel">
				<view class="header">
					<text class="logo-text">🏥</text>
					<text class="title">药房排队大屏终端</text>
					<text class="subtitle">Pharmacy Display Client</text>
				</view>
				
				<view class="card">
					<view class="info-row">
						<text class="label">本级终端 ID:</text>
						<text class="value highlight">{{deviceId}}</text>
					</view>
					<!-- 新增：显示原生获取的真实 IP 和 MAC -->
					<view class="info-row">
						<text class="label">本机 IP:</text>
						<text class="value">{{nativeIp}}</text>
					</view>
					<view class="info-row">
						<text class="label">本机 MAC:</text>
						<text class="value">{{nativeMac}}</text>
					</view>

					<text class="desc">请在后台“终端管理”中添加此 ID 以绑定窗口。</text>
				</view>
				
				<view class="card form-card">
					<text class="label">前端网页地址 (Frontend URL):</text>
					<input 
						class="input" 
						v-model="inputUrl" 
						placeholder="例如 http://192.168.1.100:80" 
						:adjust-position="true"
					/>
					<text class="desc">请输入 IIS 部署的 React 网站地址。\n(注意：不要填成 8081 的后端 API 地址)</text>
				</view>
				
				<button class="btn-save" @click="saveConfig" hover-class="btn-hover">连接并启动</button>
			</view>
		</scroll-view>

		<!-- 2. 全屏 WebView - 配置完成后显示 -->
		<block v-else>
			<!-- 增加 v-if 用于强制销毁重建 WebView -->
			<web-view 
				v-if="webviewVisible"
				:src="fullUrl"
				class="webview"
				@error="handleWebError"
				@message="handleWebMessage"
			></web-view>
			
			<!-- 网络断开提示层 -->
			<cover-view v-if="!isOnline" class="offline-mask">
				<cover-view class="offline-box">
					<cover-image src="/static/wifi-off.png" class="offline-icon"></cover-image>
					<cover-view class="offline-text">网络连接已断开</cover-view>
					<cover-view class="offline-sub">正在尝试重新连接...</cover-view>
				</cover-view>
			</cover-view>
			
			<!-- 3. 悬浮设置按钮 (Cover View 用于覆盖 WebView) -->
			<cover-view class="float-btn" @click="handleSettingsClick">
				<cover-view class="float-icon">⚙️</cover-view>
			</cover-view>
		</block>
	</view>
</template>

<script>
	// ==========================================
	// [可选] 硬编码服务器地址
	const DEFAULT_SERVER_URL = ''; 
	// ==========================================

	export default {
		data() {
			return {
				isConfigured: false,
				deviceId: '',
				inputUrl: 'http://',
				savedUrl: '',
				webviewVisible: true, // 控制 WebView 显隐用于重载
				isOnline: true,
				retryCount: 0,
				nativeIp: '0.0.0.0',
				nativeMac: '00:00:00:00:00:00'
			}
		},
		computed: {
			fullUrl() {
				if (!this.savedUrl) return '';
				const base = this.savedUrl.replace(/\/+$/, '');
				// 增加 timestamp 防止 WebView 缓存
				// 同时将 IP 和 MAC 透传给 React 前端，方便其上报心跳
				return `${base}/?mode=tv&deviceId=${this.deviceId}&ip=${this.nativeIp}&mac=${this.nativeMac}&ts=${Date.now()}`;
			}
		},
		onLoad() {
			this.initDeviceId();
			this.getNativeNetworkInfo(); // 获取真实网络信息
			this.initServerUrl();
			this.setupCrashProtection();
		},
		onShow() {
			// #ifdef APP-PLUS
			// 强力保活：应用切回前台时，再次申请唤醒锁
			plus.device.setWakelock(true);
			plus.screen.lockOrientation('landscape-primary');
			// #endif
		},
		methods: {
			initDeviceId() {
				let id = '';
				try {
					id = uni.getStorageSync('pqms_device_id');
				} catch(e) { console.error(e); }

				if (!id) {
					const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
					id = `TV-${randomStr}`;
					try {
						uni.setStorageSync('pqms_device_id', id);
					} catch(e) { console.error(e); }
				}
				this.deviceId = id;
			},
			
			// --- Native.js 获取真实 IP 和 MAC (Android) ---
			getNativeNetworkInfo() {
				// #ifdef APP-PLUS
				if (plus.os.name === 'Android') {
					try {
						console.log("Starting Native Network Info Fetch...");
						
						// 1. 获取 IPv4
						let ip = "0.0.0.0";
						const NetworkInterface = plus.android.importClass("java.net.NetworkInterface");
						const Inet4Address = plus.android.importClass("java.net.Inet4Address");
						const Collections = plus.android.importClass("java.util.Collections");
						
						const interfaces = NetworkInterface.getNetworkInterfaces();
						const interfaceList = Collections.list(interfaces);
						
						// 遍历接口
						for (let i = 0; i < interfaceList.size(); i++) {
							const intf = interfaceList.get(i);
							const name = intf.getName();
							// console.log("Checking interface: " + name);
							
							// 忽略回环和未启动的接口，通常找 wlan0 (wifi) 或 eth0 (有线)
							if (!intf.isLoopback() && intf.isUp()) {
								const addrs = intf.getInetAddresses();
								while (addrs.hasMoreElements()) {
									const addr = addrs.nextElement();
									// 仅获取 IPv4
									if (plus.android.instanceOf(addr, Inet4Address)) {
										const sAddr = addr.getHostAddress();
										// 排除 127.0.0.1 (虽然 isLoopback 已经排除了，双重保险)
										if (!sAddr.startsWith("127.")) {
											ip = sAddr;
											// 如果是有线 eth0，优先级最高，直接覆盖
											if (name.indexOf("eth") !== -1) {
												this.nativeIp = ip;
												// 继续找 MAC
											} else {
												// 暂存 wlan0 的 IP，如果后面没有 eth0 就用这个
												this.nativeIp = ip;
											}
										}
									}
								}
							}
						}

						// 2. 获取 MAC 地址 (绕过 Android 10+ 限制，读取系统文件)
						// 标准 API 在 Android 10+ 返回 02:00:00:00:00:00
						let mac = "";
						const File = plus.android.importClass("java.io.File");
						const FileReader = plus.android.importClass("java.io.FileReader");
						const BufferedReader = plus.android.importClass("java.io.BufferedReader");

						const readMacFile = (path) => {
							try {
								const file = new File(path);
								if (file.exists()) {
									const reader = new FileReader(file);
									const br = new BufferedReader(reader);
									const line = br.readLine();
									br.close();
									reader.close();
									return line ? line.trim().toUpperCase() : "";
								}
							} catch(e) {
								console.error("Read file error: " + path, e);
							}
							return "";
						};

						// 优先尝试有线，再尝试 WiFi
						mac = readMacFile("/sys/class/net/eth0/address");
						if (!mac || mac === "00:00:00:00:00:00") {
							mac = readMacFile("/sys/class/net/wlan0/address");
						}
						
						if (mac && mac !== "00:00:00:00:00:00") {
							this.nativeMac = mac;
						} else {
							// Fallback: 尝试使用 WifiManager (针对旧版本 Android)
							// 这里省略，因为现在大多数电视盒都是 Android 7/8/9+，文件读取通常更有效
						}

					} catch(e) {
						console.error("Native Info Error:", e);
					}
				}
				// #endif
			},

			initServerUrl() {
				if (DEFAULT_SERVER_URL && DEFAULT_SERVER_URL.length > 0) {
					console.log("Using hardcoded URL:", DEFAULT_SERVER_URL);
					this.savedUrl = DEFAULT_SERVER_URL;
					this.isConfigured = true;
					return;
				}

				let storedUrl = '';
				try {
					storedUrl = uni.getStorageSync('pqms_server_url');
				} catch(e) { console.error(e); }

				if (storedUrl) {
					console.log("Using stored URL:", storedUrl);
					this.savedUrl = storedUrl;
					this.isConfigured = true;
					return;
				}

				this.isConfigured = false;
			},
			
			// --- 稳定性核心逻辑 ---
			setupCrashProtection() {
				// 1. 网络监听
				uni.getNetworkType({
					success: (res) => {
						this.isOnline = res.networkType !== 'none';
					}
				});
				
				uni.onNetworkStatusChange((res) => {
					console.log("Network changed:", res.isConnected);
					this.isOnline = res.isConnected;
					
					if (res.isConnected) {
						// 网络恢复后，延迟 2秒 刷新 WebView，防止瞬断导致白屏
						setTimeout(() => {
							this.reloadWebview();
						}, 2000);
					}
				});

				// 2. 内存泄漏防护 (可选：每 12 小时重载一次)
				// setInterval(() => { this.reloadWebview(); }, 12 * 60 * 60 * 1000);
			},

			reloadWebview() {
				console.log("Reloading WebView...");
				this.webviewVisible = false;
				this.$nextTick(() => {
					setTimeout(() => {
						this.webviewVisible = true;
					}, 200); // 短暂延迟确保销毁
				});
			},

			handleWebError(e) {
				console.error("WebView Load Error:", e);
				// 自动重试机制
				this.retryCount++;
				const delay = Math.min(this.retryCount * 2000, 10000); // 2s, 4s, 6s... max 10s

				// 显示原生 Toast 提示
				uni.showToast({
					title: `连接中断，${delay/1000}秒后重试...`,
					icon: 'none',
					duration: delay
				});

				setTimeout(() => {
					this.reloadWebview();
				}, delay);
			},
			
			handleWebMessage(e) {
				// 接收来自 React 的消息（预留）
			},
			
			// --- 配置逻辑 ---
			saveConfig() {
				// FIX: 增加 trim 处理，去除前后空格
				if (!this.inputUrl) return uni.showToast({ title: '请输入地址', icon: 'none' });
				
				let url = this.inputUrl.trim();
				if (!url) return uni.showToast({ title: '请输入地址', icon: 'none' });
				
				if (!url.startsWith('http://') && !url.startsWith('https://')) {
					url = 'http://' + url;
				}
				
				try {
					uni.setStorageSync('pqms_server_url', url);
					this.savedUrl = url;
					this.isConfigured = true;
					uni.showToast({ title: '配置已保存', icon: 'success' });
				} catch(e) {
					uni.showToast({ title: '保存失败: 存储受限', icon: 'none' });
				}
			},
			handleSettingsClick() {
				const isHardcoded = DEFAULT_SERVER_URL && DEFAULT_SERVER_URL.length > 0;
				let content = `当前设备ID: ${this.deviceId}\n本机IP: ${this.nativeIp}\n本机MAC: ${this.nativeMac}\n前端地址: ${this.savedUrl}`;
				if (isHardcoded) content += `\n\n(注意：当前使用代码硬编码地址)`;
				else content += `\n\n确定要重置连接地址吗？`;

				uni.showModal({
					title: '系统设置',
					content: content,
					confirmText: isHardcoded ? '确定' : '重置配置',
					showCancel: !isHardcoded,
					success: (res) => {
						if (!isHardcoded && res.confirm) {
							try {
								uni.removeStorageSync('pqms_server_url');
							} catch(e) {}
							this.isConfigured = false;
							this.inputUrl = this.savedUrl;
						}
					}
				});
			}
		}
	}
</script>

<style>
	.container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #1a1a1a;
		color: #fff;
	}
	
	/* 新增 Scroll Container 确保小屏可滚动 */
	.scroll-container {
		flex: 1;
		height: 0; /* 配合 flex:1 确保内部滚动生效 */
		width: 100%;
	}

	.setup-panel {
		/* 改为 min-height，允许内容撑开 */
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		/* 减小内边距适配手机 */
		padding: 20px;
		box-sizing: border-box;
	}
	
	/* 调整头部间距 */
	.header { text-align: center; margin-bottom: 20px; }
	/* 减小字号适配手机 */
	.logo-text { font-size: 48px; margin-bottom: 10px; display: block; }
	.title { font-size: 24px; font-weight: bold; margin-bottom: 5px; display: block; }
	
	.subtitle { font-size: 16px; color: #888; }
	.card { background-color: #333; border-radius: 12px; padding: 20px; width: 100%; max-width: 500px; margin-bottom: 20px; box-sizing: border-box; }
	.info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
	.label { font-size: 16px; color: #aaa; margin-bottom: 8px; display: block; }
	.value { font-size: 18px; color: #fff; font-family: monospace; }
	.value.highlight { font-size: 24px; color: #4cd964; font-weight: bold; font-family: monospace; word-break: break-all; }
	.desc { font-size: 12px; color: #666; margin-top: 5px; display: block; white-space: pre-line; line-height: 1.5; }
	.form-card { background-color: #2a2a2a; border: 1px solid #444; }
	.input { background-color: #000; color: #fff; border: 1px solid #555; padding: 15px; font-size: 18px; border-radius: 8px; margin-bottom: 10px; }
	.btn-save { background-color: #007aff; color: white; font-size: 18px; padding: 10px 40px; border-radius: 8px; width: 100%; max-width: 500px; margin-top: 20px; }
	
	.float-btn {
		position: fixed;
		top: 20px; left: 20px;
		width: 40px; height: 40px;
		background-color: rgba(0,0,0,0.3);
		border-radius: 20px;
		display: flex; align-items: center; justify-content: center;
		z-index: 9999;
		border: 1px solid rgba(255,255,255,0.1);
	}
	.float-icon { color: #fff; font-size: 20px; line-height: 40px; text-align: center; width: 40px; }

	/* 离线遮罩层 */
	.offline-mask {
		position: fixed; top: 0; left: 0; right: 0; bottom: 0;
		background-color: rgba(0,0,0,0.8);
		display: flex; align-items: center; justify-content: center;
		z-index: 9000;
	}
	.offline-box {
		width: 300px; height: 200px;
		background-color: #333;
		border-radius: 16px;
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
	}
	.offline-icon { width: 64px; height: 64px; margin-bottom: 20px; opacity: 0.5; }
	.offline-text { font-size: 20px; color: #fff; font-weight: bold; }
	.offline-sub { font-size: 14px; color: #aaa; margin-top: 10px; }
</style>