import { initCustomFormatter } from '@vue/runtime-dom'

export function initDev() {
  // 判断是否是浏览器环境
  if (__BROWSER__) {
    // 如果不是 ESM 打包器环境
    /* istanbul ignore if */
    if (!__ESM_BUNDLER__) {
      // 输出提示 `您正在运行 Vue 的开发版本。在部署生产时确保使用生产版本 (.prod.js)。`,
      console.info(
        `You are running a development build of Vue.\n` +
          `Make sure to use the production build (*.prod.js) when deploying for production.`,
      )
    }
    // 自定义格式器的初始化
    initCustomFormatter()
  }
}
