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