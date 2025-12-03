<template>
	<view class="container">
		<!-- 1. 配置向导 (Setup Wizard) -->
		<view v-if="!isConfigured" class="setup-panel">
			<view class="content-wrapper">
				<view class="header-section">
					<text class="logo-icon">🏥</text>
					<view class="text-group">
						<text class="app-title">药房排队大屏终端</text>
						<text class="app-subtitle">Pharmacy Display Client</text>
					</view>
				</view>
				
				<view class="card info-card">
					<text class="card-label">本级终端 ID (Device ID)</text>
					<text class="device-id">{{deviceId}}</text>
					<text class="card-tip">请在后台“终端管理”中添加此 ID</text>
				</view>
				
				<view class="card input-card">
					<text class="card-label">前端地址 (Frontend URL)</text>
					<input 
						class="url-input" 
						v-model="inputUrl" 
						placeholder="http://192.168.1.X:8080" 
						:adjust-position="true"
						confirm-type="go"
						@confirm="saveConfig"
					/>
				</view>
				
				<button class="btn-start" @click="saveConfig" hover-class="btn-hover">连接并启动</button>
			</view>
		</view>

		<!-- 2. 全屏 WebView -->
		<block v-else>
			<web-view 
				v-if="webviewVisible"
				:src="fullUrl"
				class="webview"
				@error="handleWebError"
				@load="handleWebLoad"
                @message="handleMessage"
			></web-view>
			
			<!-- 3. 状态覆盖层 (Loading/Error) -->
			<cover-view v-if="isLoadFailed || isLoading" class="status-overlay">
				<!-- Loading -->
				<cover-view v-if="isLoading" class="status-box">
					<cover-view class="loading-spinner"></cover-view>
					<cover-view class="status-text">正在连接服务器...</cover-view>
					<cover-view class="status-sub">{{savedUrl}}</cover-view>
					<cover-view class="btn-mini" @click="reconfigure">重设地址</cover-view>
				</cover-view>

				<!-- Error -->
				<cover-view v-if="isLoadFailed" class="status-box error-box">
					<cover-image src="/static/wifi-off.png" class="status-icon-img"></cover-image>
					<cover-view class="status-title">连接失败</cover-view>
					<cover-view class="status-desc">无法访问: {{savedUrl}}</cover-view>
					<cover-view class="btn-row">
						<cover-view class="btn-main btn-retry" @click="retryConnection">重试</cover-view>
						<cover-view class="btn-main btn-reset" @click="reconfigure">设置</cover-view>
					</cover-view>
				</cover-view>
			</cover-view>
			
			<!-- 4. 悬浮设置按钮 -->
			<cover-view v-if="!isLoadFailed && !isLoading" class="float-btn" @click="openMenu">
				<cover-view class="float-icon">⚙️</cover-view>
			</cover-view>
		</block>
	</view>
</template>

<script>
	// [可选] 硬编码地址
	const DEFAULT_SERVER_URL = ''; 

	export default {
		data() {
			return {
				isConfigured: false,
				deviceId: '',
				inputUrl: 'http://',
				savedUrl: '',
				webviewVisible: true,
				isLoading: true,
				isLoadFailed: false,
				loadingTimer: null,
				hasLoadedOnce: false
			}
		},
		computed: {
			fullUrl() {
				if (!this.savedUrl) return '';
				const base = this.savedUrl.replace(/\/+$/, '');
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
		onBackPress(e) {
			// 1. 如果正在大屏播放状态，按返回键打开系统菜单
			if (this.isConfigured) {
				this.openMenu();
				return true; // 拦截默认退出
			}
			
			// 2. 如果在配置界面，允许退出应用
			return false;
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
				
				if (this.loadingTimer) clearTimeout(this.loadingTimer);
				this.loadingTimer = setTimeout(() => {
					// 30秒超时逻辑 (Fail-Open)
					if (this.isLoading && !this.hasLoadedOnce) {
						console.log("Loading Timeout - Hiding spinner");
						this.isLoading = false; 
					}
				}, 30000);
			},

			handleWebLoad() {
				console.log("WebView Loaded (Success)");
				this.isLoading = false;
				this.isLoadFailed = false;
				this.hasLoadedOnce = true;
				if (this.loadingTimer) clearTimeout(this.loadingTimer);
			},

            handleMessage(e) {
                if (e.detail && e.detail.data) {
                    this.handleWebLoad();
                }
            },

			handleWebError(e) {
				console.warn("WebView Error:", e);
                if (this.hasLoadedOnce) return;

                const errorUrl = e.detail?.url || '';
                const mainUrlBase = this.savedUrl.replace(/\/+$/, '');
                
                if (errorUrl.match(/\.(css|js|ico|png|jpg|jpeg|woff2?)$/i)) {
                    console.log("Ignoring resource error:", errorUrl);
                    return;
                }

                if (errorUrl.includes(mainUrlBase) || !errorUrl) {
                    console.error("Main Frame Load Failed:", errorUrl);
                    this.isLoadFailed = true;
                    this.isLoading = false;
                    if (this.loadingTimer) clearTimeout(this.loadingTimer);
                }
			},

			retryConnection() {
				this.webviewVisible = false;
				this.isLoading = true;
				this.isLoadFailed = false;
				this.$nextTick(() => {
					setTimeout(() => {
						this.webviewVisible = true;
						this.startLoading();
					}, 300);
				});
			},

			reconfigure() {
				try { uni.removeStorageSync('pqms_server_url'); } catch(e) {}
				this.isConfigured = false;
				this.isLoading = false;
				this.isLoadFailed = false;
				this.inputUrl = this.savedUrl || 'http://';
			},
			
			saveConfig() {
				let url = this.inputUrl.trim();
				if (!url) return uni.showToast({ title: '请输入地址', icon: 'none' });
				if (!url.startsWith('http://') && !url.startsWith('https://')) {
					url = 'http://' + url;
				}
				if (url.length < 8) return uni.showToast({ title: '地址过短', icon: 'none' });

				try {
					uni.setStorageSync('pqms_server_url', url);
					this.savedUrl = url;
					this.startLoading();
				} catch(e) {
					uni.showToast({ title: '保存失败', icon: 'none' });
				}
			},

			// 打开原生系统菜单
			openMenu() {
				uni.showActionSheet({
					itemList: ['重置配置 (Reset)', '退出应用 (Exit)'],
					success: (res) => {
						if (res.tapIndex === 0) {
							// 重置配置
							this.reconfigure();
						} else if (res.tapIndex === 1) {
							// 退出应用
							this.quitApp();
						}
					},
					fail: (res) => {
						console.log(res.errMsg);
					}
				});
			},

			// 退出应用
			quitApp() {
				// #ifdef APP-PLUS
				plus.runtime.quit();
				// #endif
			}
		}
	}
</script>

<style>
	.container {
		width: 100%;
		height: 100vh;
		background-color: #111;
		color: #fff;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* --- Setup Panel (TV Optimized) --- */
	.setup-panel {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background-image: linear-gradient(135deg, #1f2937 0%, #111827 100%);
	}

	.content-wrapper {
		width: 600rpx; /* Width relative to screen */
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 30rpx;
	}

	.header-section {
		display: flex;
		align-items: center;
		gap: 20rpx;
		margin-bottom: 20rpx;
	}

	.logo-icon {
		font-size: 80rpx;
	}

	.text-group {
		display: flex;
		flex-direction: column;
	}

	.app-title {
		font-size: 40rpx;
		font-weight: bold;
		color: #fff;
	}

	.app-subtitle {
		font-size: 24rpx;
		color: #9ca3af;
	}

	.card {
		width: 100%;
		background-color: rgba(255,255,255,0.05);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 16rpx;
		padding: 24rpx;
		display: flex;
		flex-direction: column;
	}

	.card-label {
		font-size: 24rpx;
		color: #9ca3af;
		margin-bottom: 10rpx;
	}

	.device-id {
		font-size: 48rpx;
		font-weight: bold;
		color: #4ade80; /* Green */
		font-family: monospace;
		text-align: center;
		margin: 10rpx 0;
		letter-spacing: 2rpx;
	}

	.card-tip {
		font-size: 20rpx;
		color: #6b7280;
		text-align: center;
	}

	.url-input {
		background-color: rgba(0,0,0,0.3);
		border: 1px solid rgba(255,255,255,0.2);
		color: #fff;
		height: 80rpx;
		line-height: 80rpx;
		border-radius: 10rpx;
		padding: 0 20rpx;
		font-size: 28rpx;
	}

	.btn-start {
		width: 100%;
		height: 88rpx;
		line-height: 88rpx;
		background-color: #2563eb;
		color: white;
		font-size: 32rpx;
		font-weight: bold;
		border-radius: 12rpx;
		margin-top: 10rpx;
		border: none;
	}
	
	.btn-hover {
		opacity: 0.9;
		transform: scale(0.98);
	}

	/* --- WebView --- */
	.webview {
		flex: 1;
		width: 100%;
		height: 100%;
	}

	/* --- Status Overlay (Pure CSS for CoverView) --- */
	.status-overlay {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background-color: #111;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
	}

	.status-box {
		width: 500rpx;
		background-color: #1f2937;
		border-radius: 20rpx;
		padding: 40rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.error-box {
		background-color: #2a1215;
		border: 1px solid #7f1d1d;
	}

	.loading-spinner {
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		border: 6rpx solid #374151;
		border-top-color: #3b82f6;
		margin-bottom: 30rpx;
	}

	.status-icon-img {
		width: 100rpx;
		height: 100rpx;
		margin-bottom: 20rpx;
	}

	.status-title {
		font-size: 36rpx;
		color: #ef4444;
		font-weight: bold;
		margin-bottom: 10rpx;
	}

	.status-text {
		font-size: 30rpx;
		color: #f3f4f6;
		margin-bottom: 10rpx;
	}

	.status-sub {
		font-size: 24rpx;
		color: #9ca3af;
		margin-bottom: 40rpx;
		text-align: center;
		word-break: break-all;
	}
	
	.status-desc {
		font-size: 24rpx;
		color: #9ca3af;
		margin-bottom: 30rpx;
		text-align: center;
	}

	.btn-row {
		display: flex;
		flex-direction: row;
		width: 100%;
		gap: 20rpx;
	}

	.btn-main {
		flex: 1;
		height: 80rpx;
		line-height: 80rpx;
		text-align: center;
		border-radius: 10rpx;
		font-size: 28rpx;
		color: #fff;
	}

	.btn-retry { background-color: #2563eb; }
	.btn-reset { background-color: #4b5563; }

	.btn-mini {
		padding: 10rpx 30rpx;
		border: 1px solid #4b5563;
		border-radius: 8rpx;
		color: #9ca3af;
		font-size: 22rpx;
	}

	.float-btn {
		position: fixed;
		top: 30rpx;
		left: 30rpx;
		width: 60rpx;
		height: 60rpx;
		background-color: rgba(0,0,0,0.4);
		border-radius: 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}
	
	.float-icon {
		color: #fff;
		font-size: 30rpx;
		line-height: 60rpx;
		text-align: center;
		width: 60rpx;
	}
</style>