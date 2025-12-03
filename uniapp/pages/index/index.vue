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
				@load="handleWebLoad"
                @message="handleMessage"
			></web-view>
			
			<!-- 3. 加载中/错误状态覆盖层 (Cover View) -->
			<!-- 当正在加载或加载失败时显示，背景不透明，防止黑屏 -->
			<cover-view v-if="isLoadFailed || isLoading" class="status-overlay">
				
				<!-- Loading 状态 -->
				<cover-view v-if="isLoading" class="status-box">
					<cover-view class="spinner"></cover-view>
					<cover-view class="status-text">正在连接服务器...</cover-view>
					<cover-view class="status-sub">{{savedUrl}}</cover-view>
					<!-- 如果卡在 Loading 太久，提供强制退出按钮 -->
					<cover-view class="btn-mini" @click="reconfigure">取消并重设</cover-view>
				</cover-view>

				<!-- Error 状态 -->
				<cover-view v-if="isLoadFailed" class="status-box error-box">
					<cover-image src="/static/wifi-off.png" class="status-icon"></cover-image>
					<cover-view class="status-title">连接失败</cover-view>
					<cover-view class="status-desc">无法访问地址: {{savedUrl}}</cover-view>
					<cover-view class="status-desc">请检查地址是否正确或服务是否启动</cover-view>
					
					<cover-view class="btn-row">
						<cover-view class="btn-action btn-retry" @click="retryConnection">重试连接</cover-view>
						<cover-view class="btn-action btn-reset" @click="reconfigure">重新配置地址</cover-view>
					</cover-view>
				</cover-view>
			</cover-view>
			
			<!-- 4. 悬浮设置按钮 (仅在加载成功后显示，避免遮挡错误页) -->
			<cover-view v-if="!isLoadFailed && !isLoading" class="float-btn" @click="handleSettingsClick">
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
				webviewVisible: true,
				
				// 状态控制
				isLoading: true,     // 是否正在加载
				isLoadFailed: false, // 是否加载失败
				loadingTimer: null,  // 超时定时器
				
				nativeIp: '0.0.0.0', // 简化版，不再强求获取
				nativeMac: '00:00:00:00:00:00',
				
				hasLoadedOnce: false // 标记是否成功加载过一次
			}
		},
		computed: {
			fullUrl() {
				if (!this.savedUrl) return '';
				const base = this.savedUrl.replace(/\/+$/, '');
				// 增加 timestamp 防止 WebView 缓存
				return `${base}/?mode=tv&deviceId=${this.deviceId}&ts=${Date.now()}`;
			}
		},
		onLoad() {
			this.initDeviceId();
			this.initServerUrl();
		},
		onShow() {
			// #ifdef APP-PLUS
			plus.device.setWakelock(true);
			plus.screen.lockOrientation('landscape-primary');
			// #endif
		},
		// 监听物理返回键 (Android)
		onBackPress(e) {
			if (this.isConfigured) {
				// 如果当前在 WebView 页面，拦截返回键，询问是否重置
				// 避免误触直接退出 App
				this.handleSettingsClick();
				return true; // 阻止默认返回行为
			}
			return false; // 在配置页允许退出
		},
		methods: {
			initDeviceId() {
				let id = '';
				try { id = uni.getStorageSync('pqms_device_id'); } catch(e) {}
				if (!id) {
					const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
					id = `TV-${randomStr}`;
					try { uni.setStorageSync('pqms_device_id', id); } catch(e) {}
				}
				this.deviceId = id;
			},
			
			initServerUrl() {
				if (DEFAULT_SERVER_URL && DEFAULT_SERVER_URL.length > 0) {
					this.savedUrl = DEFAULT_SERVER_URL;
					this.startLoading();
					return;
				}

				let storedUrl = '';
				try { storedUrl = uni.getStorageSync('pqms_server_url'); } catch(e) {}

				if (storedUrl) {
					this.savedUrl = storedUrl;
					this.startLoading();
					return;
				}

				this.isConfigured = false;
			},

			startLoading() {
				this.isConfigured = true;
				this.isLoading = true;
				this.isLoadFailed = false;
				this.hasLoadedOnce = false;
				this.webviewVisible = true;
				
				// 设置超时保护：如果 15秒还没加载成功
				// 采用 "Fail-Open" 策略：假设已经加载成功了，直接隐藏遮罩层
				// 这样即使 index.css 404 或 @message 丢失，用户也能看到界面，而不是被红色错误页挡住
				if (this.loadingTimer) clearTimeout(this.loadingTimer);
				this.loadingTimer = setTimeout(() => {
					// 只有当还没有成功加载过时，才触发
					if (this.isLoading && !this.hasLoadedOnce) {
						console.log("Loading Timeout - Strategy: Fail Open");
						// 核心修改：超时不报错，而是直接认为成功，隐藏 Loading
						this.isLoading = false; 
						this.isLoadFailed = false;
					}
				}, 15000);
			},

			handleWebLoad() {
				// WebView 加载成功回调
				console.log("WebView Loaded Successfully (onLoad)");
				this.isLoading = false;
				this.isLoadFailed = false;
				this.hasLoadedOnce = true;
				if (this.loadingTimer) clearTimeout(this.loadingTimer);
			},

            // Handle handshake message from React App
            handleMessage(e) {
                console.log("Received Message from WebView:", e.detail);
                // If we receive ANY data from the page, it means it's running!
                if (e.detail && e.detail.data) {
                    this.handleWebLoad();
                }
            },

			handleWebError(e) {
				// UniApp 的 WebView @error 非常敏感，任何资源 404 (如 index.css) 都会触发。
				// 我们不再在此处判定为失败，而是完全依赖 startLoading 中的超时检测。
				// 超时检测也改为 Fail-Open 策略，所以非致命错误不会再阻断页面显示。
				console.warn("WebView reported error (ignored, waiting for load or timeout):", e);
			},

			retryConnection() {
				// 强制刷新 WebView
				this.webviewVisible = false;
				this.isLoading = true;
				this.isLoadFailed = false;
				this.hasLoadedOnce = false;
				
				this.$nextTick(() => {
					setTimeout(() => {
						this.webviewVisible = true;
						this.startLoading(); // 重启超时计时
					}, 300);
				});
			},

			reconfigure() {
				// 清除配置并返回首页
				try {
					uni.removeStorageSync('pqms_server_url');
				} catch(e) {}
				
				this.isConfigured = false;
				this.isLoading = false;
				this.isLoadFailed = false;
				this.inputUrl = this.savedUrl || 'http://';
				if (this.loadingTimer) clearTimeout(this.loadingTimer);
			},
			
			saveConfig() {
				if (!this.inputUrl) return uni.showToast({ title: '请输入地址', icon: 'none' });
				
				let url = this.inputUrl.trim();
				if (!url) return uni.showToast({ title: '请输入地址', icon: 'none' });
				
				if (!url.startsWith('http://') && !url.startsWith('https://')) {
					url = 'http://' + url;
				}
				
				// 简单的格式校验
				if (url.length < 10) return uni.showToast({ title: '地址格式不正确', icon: 'none' });

				try {
					uni.setStorageSync('pqms_server_url', url);
					this.savedUrl = url;
					this.startLoading();
				} catch(e) {
					uni.showToast({ title: '保存失败: 存储受限', icon: 'none' });
				}
			},

			handleSettingsClick() {
				const isHardcoded = DEFAULT_SERVER_URL && DEFAULT_SERVER_URL.length > 0;
				let content = `当前设备ID: ${this.deviceId}\n前端地址: ${this.savedUrl}`;
				if (isHardcoded) content += `\n(代码硬编码地址)`;

				uni.showModal({
					title: '系统设置',
					content: content,
					confirmText: isHardcoded ? '确定' : '重新配置',
					cancelText: '取消',
					showCancel: !isHardcoded,
					success: (res) => {
						if (!isHardcoded && res.confirm) {
							this.reconfigure();
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
	
	.scroll-container {
		flex: 1;
		height: 0;
		width: 100%;
	}

	.setup-panel {
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		box-sizing: border-box;
	}
	
	.header { text-align: center; margin-bottom: 20px; }
	.logo-text { font-size: 48px; margin-bottom: 10px; display: block; }
	.title { font-size: 24px; font-weight: bold; margin-bottom: 5px; display: block; }
	.subtitle { font-size: 16px; color: #888; }
	
	.card { background-color: #333; border-radius: 12px; padding: 20px; width: 100%; max-width: 500px; margin-bottom: 20px; box-sizing: border-box; }
	.info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
	.label { font-size: 16px; color: #aaa; margin-bottom: 8px; display: block; }
	.value { font-size: 18px; color: #fff; font-family: monospace; }
	.value.highlight { font-size: 24px; color: #4cd964; font-weight: bold; }
	.desc { font-size: 12px; color: #666; margin-top: 5px; display: block; white-space: pre-line; line-height: 1.5; }
	
	.form-card { background-color: #2a2a2a; border: 1px solid #444; }
	.input { background-color: #000; color: #fff; border: 1px solid #555; padding: 15px; font-size: 18px; border-radius: 8px; margin-bottom: 10px; }
	.btn-save { background-color: #007aff; color: white; font-size: 18px; padding: 10px 40px; border-radius: 8px; width: 100%; max-width: 500px; margin-top: 20px; }
	
	/* WebView & Overlays */
	.webview { flex: 1; width: 100%; height: 100%; }
	
	.status-overlay {
		position: fixed; top: 0; left: 0; right: 0; bottom: 0;
		background-color: #1a1a1a; /* 不透明背景，遮住可能黑屏的WebView */
		display: flex; align-items: center; justify-content: center;
		z-index: 1000;
	}
	
	.status-box {
		width: 320px;
		background-color: #333;
		border-radius: 16px;
		padding: 30px 20px;
		display: flex; flex-direction: column;
		align-items: center;
	}
	
	.error-box { border: 1px solid #500; background-color: #2a1111; }
	
	.spinner {
		width: 40px; height: 40px;
		border-radius: 50%;
		border: 4px solid #555;
		border-top-color: #007aff;
		/* UniApp cover-view 动画支持有限，静态显示即可，或者使用原生loading组件 */
		margin-bottom: 20px;
	}
	
	.status-icon { width: 64px; height: 64px; margin-bottom: 15px; }
	
	.status-text { font-size: 20px; color: #fff; font-weight: bold; margin-bottom: 10px; }
	.status-title { font-size: 22px; color: #ff5555; font-weight: bold; margin-bottom: 10px; }
	
	.status-sub { font-size: 14px; color: #aaa; text-align: center; word-break: break-all; margin-bottom: 20px;}
	.status-desc { font-size: 14px; color: #ccc; text-align: center; margin-bottom: 5px; }
	
	.btn-row { display: flex; flex-direction: row; gap: 10px; margin-top: 20px; width: 100%; }
	
	.btn-action {
		flex: 1;
		height: 44px;
		line-height: 44px;
		text-align: center;
		border-radius: 8px;
		font-size: 14px;
		color: #fff;
	}
	.btn-retry { background-color: #007aff; }
	.btn-reset { background-color: #555; }
	
	.btn-mini {
		margin-top: 15px;
		padding: 5px 15px;
		border-radius: 4px;
		border: 1px solid #555;
		color: #888;
		font-size: 12px;
	}

	.float-btn {
		position: fixed; top: 20px; left: 20px;
		width: 40px; height: 40px;
		background-color: rgba(0,0,0,0.5);
		border-radius: 20px;
		display: flex; align-items: center; justify-content: center;
		z-index: 2000;
		border: 1px solid rgba(255,255,255,0.2);
	}
	.float-icon { color: #fff; font-size: 20px; line-height: 40px; text-align: center; width: 40px; }
</style>