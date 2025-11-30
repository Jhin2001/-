<template>
	<view class="content">
		<!-- 
		  URL 配置说明:
		  1. 将 'http://192.168.1.100:3000' 替换为您 React 网页部署的实际局域网/公网地址。
		  2. mode=tv: 告诉网页进入纯净显示模式。
		  3. deviceId: 可选，如果您希望这台电视绑定特定配置（如窗口1），请修改此ID。
		-->
		<web-view 
			:src="url"
			:fullscreen="true"
			@message="handleMessage"
		></web-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				// 请修改此处的 IP 地址为您部署电脑的 IP
				baseUrl: 'http://192.168.1.100:3000', 
				deviceId: 'TV-01' 
			}
		},
		computed: {
			url() {
				// 拼接参数：进入 TV 模式，并传递设备 ID
				return `${this.baseUrl}/?mode=tv&deviceId=${this.deviceId}`;
			}
		},
		onLoad() {
			// 强制横屏 (双重保障)
			// #ifdef APP-PLUS
			plus.screen.lockOrientation('landscape-primary');
			// 保持屏幕常亮
			plus.device.setWakelock(true);
			// #endif
		},
		methods: {
			handleMessage(evt) {
				console.log('Message from React:', evt.detail.data);
			}
		}
	}
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: #000;
		height: 100vh;
		width: 100vw;
	}
</style>