// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { initDev } from './dev'
import {
  type CompilerError,
  type CompilerOptions,
  compile,
} from '@vue/compiler-dom'
import {
  type RenderFunction,
  registerRuntimeCompiler,
  warn,
} from '@vue/runtime-dom'
import * as runtimeDom from '@vue/runtime-dom'
import {
  EMPTY_OBJ,
  NOOP,
  extend,
  generateCodeFrame,
  isString,
} from '@vue/shared'
import type { InternalRenderFunction } from 'packages/runtime-core/src/component'

// 执行 Dev 环境需要的相关的初始化逻辑
if (__DEV__) {
  initDev()
}

// 使用 WeakMap 设置缓存编译结果的弱映射，
// 其中键是编译选项对象，值是渲染函数的记录(Record)对象，
// 使用WeakMap的好处是，当键所引用的对象被垃圾回收器回收时，
// WeakMap中的键也会自动被清除，这样可以避免内存泄漏的问题。
const compileCache = new WeakMap<
  CompilerOptions,
  Record<string, RenderFunction>
>()

// 获取一个编译缓存对象
function getCache(options?: CompilerOptions) {
  let c = compileCache.get(options ?? EMPTY_OBJ)
  // 如果 compileCache 中不存在对应 options 的缓存对象，
  // 则创建一个新的空对象并将其存入 compileCache中
  if (!c) {
    c = Object.create(null) as Record<string, RenderFunction>
    compileCache.set(options ?? EMPTY_OBJ, c)
  }
  // 返回缓存对象
  return c
}

// 将模板字符串或HTML元素编译为渲染函数
// 接受一个模板和可选的编译选项作为参数，并返回一个渲染函数
function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions,
): RenderFunction {
  // 如果模版不是字符串，则判断template.nodeType是否存在
  // 如果存在则获取template.innerHTML
  // 否则发出警告并返回一个空函数
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML
    } else {
      __DEV__ && warn(`invalid template option: `, template)
      return NOOP
    }
  }

  // 以 template 为 key 获取缓存对象
  // 如果存在缓存对象则返回缓存对象
  const key = template
  const cache = getCache(options)
  const cached = cache[key]
  if (cached) {
    return cached
  }

  // 如果 template 的首字符是 #
  // 则通过 document.querySelector 判断
  // 这个模版是否是一个 css 选择器
  // 如果 el 存在则表示这个 template 是一个 css 选择器
  // 之后将 el.innerHTML 赋值给 template
  if (template[0] === '#') {
    const el = document.querySelector(template)
    if (__DEV__ && !el) {
      warn(`Template element not found or is empty: ${template}`)
    }
    // __UNSAFE__
    // Reason: potential execution of JS expressions in in-DOM template.
    // The user must make sure the in-DOM template is trusted. If it's rendered
    // by the server, the template should not contain any user data.
    template = el ? el.innerHTML : ``
  }

  // 此处的 extend 是对 Object.assign 再封装
  // 目的是将默认的配置与用户提供的 options 进行合并
  const opts = extend(
    {
      hoistStatic: true,
      onError: __DEV__ ? onError : undefined,
      onWarn: __DEV__ ? e => onError(e, true) : NOOP,
    } as CompilerOptions,
    options,
  )

  // 如果新的配置中不存在 isCustomElement 属性
  // 且 customElements 这个api存在
  // 则给新的配置增加 isCustomElement 属性
  // 其中 isCustomElement 的作用是用于判断传入的标签名是否是自定义元素
  if (!opts.isCustomElement && typeof customElements !== 'undefined') {
    // customElements 是一个全局浏览器API，
    // 它属于Web Components（Web组件）的一部分，
    // 允许开发者创建自定义的HTML元素，
    // 自定义元素有自己的功能和样式，
    // 且可以像原生HTML元素一样在网页中使用
    opts.isCustomElement = tag => !!customElements.get(tag)
  }

  const { code } = compile(template, opts)

  function onError(err: CompilerError, asWarning = false) {
    const message = asWarning
      ? err.message
      : `Template compilation error: ${err.message}`
    const codeFrame =
      err.loc &&
      generateCodeFrame(
        template as string,
        err.loc.start.offset,
        err.loc.end.offset,
      )
    warn(codeFrame ? `${message}\n${codeFrame}` : message)
  }

  // The wildcard import results in a huge object with every export
  // with keys that cannot be mangled, and can be quite heavy size-wise.
  // In the global build we know `Vue` is available globally so we can avoid
  // the wildcard object.
  const render = (
    __GLOBAL__ ? new Function(code)() : new Function('Vue', code)(runtimeDom)
  ) as RenderFunction

  // mark the function as runtime compiled
  ;(render as InternalRenderFunction)._rc = true

  return (cache[key] = render)
}

// 在 runtime-dom 中注册一个编译器
registerRuntimeCompiler(compileToFunction)

// 导出模版函数
export { compileToFunction as compile }
// 导出 runtime-dom
export * from '@vue/runtime-dom'
