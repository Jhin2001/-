<script>
	export default {
		onLaunch: function() {
			console.log('App Launch');
			
			// #ifdef APP-PLUS
			// 1. 锁定屏幕方向为横屏
			plus.screen.lockOrientation('landscape-primary');
			
			// 2. 保持屏幕常亮 (防止 Android TV 休眠)
			plus.device.setWakelock(true);
			
			// 3. 全局未捕获异常处理 (防止闪退)
			uni.onError((err) => {
				console.error('全局异常捕获:', err);
				// 可以在这里记录日志到本地文件，方便排查
			});
			
			// 4. 关闭启动图 (防止卡死)
			setTimeout(() => {
				plus.navigator.closeSplashscreen();
			}, 2000);

			// 5. 安卓开机自启与保活插件集成
			if (plus.os.name === 'Android') {
				// 动态请求权限
				this.requestPermission();
				
				// 初始化开机自启插件
				try {
					const pwi = uni.requireNativePlugin('lich-PowerOnAutoStart');
					if (pwi) {
						pwi.isIgnoringBatteryOptimizations((d) => { // 判断忽略电池优化是否设置
							if (d) {
								pwi.canDrawOverlays((d1) => { // 判断是否允许悬浮窗
									if (!d1) {
										pwi.toastMakeText("请允许悬浮窗弹出以确保后台运行");
									}
									pwi.setCanDrawOverlays(); // 打开浮窗弹设置页面
								});
							} else {
								pwi.toastMakeText("请忽略电源管理优化以确保后台运行");
								pwi.setIgnoringBatteryOptimizations(); // 打开忽略电池优化设置页面
							}
						});
						pwi.setPowerOnAutoStart(true);
						
						pwi.isPowerOnAutoStart((isAutoStart) => {
							console.log("开机自启状态:", isAutoStart);
						});
					} else {
						console.log("未检测到 lich-PowerOnAutoStart 插件");
					}
				} catch (e) {
					console.error("加载开机自启插件失败", e);
				}
			}
			// #endif
		},
		onShow: function() {
			console.log('App Show');
			// #ifdef APP-PLUS
			plus.device.setWakelock(true); // 再次确认锁
			// #endif
		},
		onHide: function() {
			console.log('App Hide');
			// #ifdef APP-PLUS
			// 尝试从后台唤醒至前台
			if (plus.os.name === 'Android') {
				setTimeout(() => {
					console.log("Attempting to bring app to front...");
					try {
						const meaAppModule = uni.requireNativePlugin("MeaApp-System");
						if (meaAppModule) {
							meaAppModule.setTopApp();
							console.log("App brought to front");
						}
					} catch (e) {
						console.error("加载后台唤醒插件失败", e);
					}
				}, 1000);
			}
			// #endif
		},
		methods: {
			// Android 动态权限申请
			requestPermission() {
				// #ifdef APP-PLUS
				if (plus.os.name !== 'Android') return;

				return new Promise((resolve, reject) => {
					console.log("开始请求必要权限...");
					plus.android.requestPermissions(
						[
							"android.permission.RECEIVE_BOOT_COMPLETED", // 开机自启动服务
							"android.permission.SYSTEM_ALERT_WINDOW", // 悬浮窗
							"android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", // 忽略电池优化
							"android.permission.WAKE_LOCK", // 休眠唤醒
							"android.permission.DISABLE_KEYGUARD", // 禁用键盘锁
						],
						function(resultObj) {
							// 日志记录
							// for (var i = 0; i < resultObj.granted.length; i++) {
							// 	console.log('已获取的权限：' + resultObj.granted[i]);
							// }
							
							// 若所需权限被永久拒绝,则打开APP设置界面
							if (resultObj.deniedAlways.length > 0) {
								console.warn("部分权限被永久拒绝，尝试跳转系统设置");
								// reject("授权失败：" + JSON.stringify(resultObj.deniedAlways));
								var Intent = plus.android.importClass("android.content.Intent");
								var Settings = plus.android.importClass("android.provider.Settings");
								var Uri = plus.android.importClass("android.net.Uri");
								var mainActivity = plus.android.runtimeMainActivity();
								var intent = new Intent();
								intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
								var uri = Uri.fromParts("package", mainActivity.getPackageName(), null);
								intent.setData(uri);
								mainActivity.startActivity(intent);
							}
							resolve("授权流程结束");
						},
						function(error) {
							console.error('申请权限错误：' + error.code + " = " + error.message);
							resolve("权限申请异常"); // 即使失败也resolve，不阻塞流程
						}
					);
				});
				// #endif
			}
		}
	}
</script>

<style>
	/*每个页面公共css */
	page {
		background-color: #000;
		width: 100%;
		height: 100%;
		overflow: hidden; /* 防止 TV 端出现滚动条 */
	}
</style>