import type {
  IEventListenerId,
  IFourNumber,
  ILeaferCanvas,
  IPaint,
  IPointData,
  IRenderOptions,
  IStrokePaint,
  IText,
  ITextInputData,
  ITextStyleAttrData,
  ITextStyleComputedData,
  IUI,
  IUIData,
  IUIInputData,
} from '@leafer-ui/interface'
import {
  boundsType,
  dataProcessor,
  dataType,
  Debug,
  FourNumberHelper,
  isArray,
  isNull,
  isString,
  Plugin,
  PropertyEvent,
  registerUI,
  Text,
  TextData,
  tryToNumber,
} from '@leafer-ui/core'

// ==================== 类型定义 ====================

/**
 * 可启用/禁用的类型包装器
 * 为任意类型添加 visible 属性来控制显示/隐藏
 */
export type IEnable<T> = T & {
  visible?: boolean
}

/**
 * 文本特效配置
 * 定义单个文本特效层的样式，包括偏移、描边、填充和滤镜
 */
export type ITextEffect = IEnable<{
  offset?: IEnable<IPointData> // 特效层相对主文本的偏移位置
  stroke?: IEnable<IStrokePaint> // 特效层的描边样式
  fill?: IEnable<IPaint> // 特效层的填充样式
  filter?: IEnable<any> // 特效层的滤镜效果（如模糊、阴影、色彩调整等）
}>

/**
 * 特效文本属性数据接口
 */
export interface IEffectTextAttrData {
  textEffects?: ITextEffect[] // 特效层数组，支持多层特效叠加
}

/**
 * 特效比例数据
 * 用于存储特效属性相对于字体大小的比例，实现响应式缩放
 */
export type IEffectRatio = Partial<{
  offsetXRatio: number // X 轴偏移比例
  offsetYRatio: number // Y 轴偏移比例
  strokeWidthRatio: number // 描边宽度比例
  dashPatternRatios: number[] // 虚线模式比例数组
}>

/**
 * 特效文本内部数据接口
 * 包含特效文本的所有内部状态和方法
 */
export interface IEffectTextData extends ITextStyleComputedData, IUIData {
  _textEffects?: ITextEffect[] // 内部存储的特效配置
  __effectTextGroup?: IText[] // 特效文本实例组
  __effectRatios?: IEffectRatio[] // 特效比例数据组
  __ratiosInitialized?: boolean // 比例是否已初始化
  updateEffectPositions: () => void // 更新特效位置的方法
}

/**
 * 特效文本接口
 * 对外暴露的特效文本完整接口
 */
export interface IEffectText extends IEffectTextAttrData, ITextStyleAttrData, IUI {
  __: IEffectTextData // 内部数据
  textEffects?: ITextEffect[] // 特效配置
  __effectTextGroup?: IText[] // 特效文本组
}

/**
 * 特效文本输入数据接口
 * 用于创建特效文本时的初始化数据
 */
export interface IEffectTextInputData extends IEffectTextAttrData, ITextInputData {
  textEffects?: ITextEffect[]
  strokeWidth?: number
}

/**
 * 描边比例项
 * 存储描边相关属性的比例
 */
interface StrokeRatioItem {
  width?: number // 描边宽度比例
  dashPattern?: number[] // 虚线模式比例
}

/**
 * 阴影比例项
 * 存储阴影相关属性的比例
 */
interface ShadowRatioItem {
  x?: number // X 轴偏移比例
  y?: number // Y 轴偏移比例
  blur?: number // 模糊半径比例
  spread?: number // 扩散半径比例
}

/**
 * 文本比例数据
 * 存储主文本的描边和阴影比例，用于响应式缩放
 */
export type ITextRatio = Partial<{
  stroke: Array<StrokeRatioItem> // 描边比例数组
  shadow: Array<ShadowRatioItem> // 外阴影比例数组
  innerShadow: Array<ShadowRatioItem> // 内阴影比例数组
}>

// ==================== 常量定义 ====================

/**
 * 默认字体大小
 * 当未指定 fontSize 时使用此值作为基准
 */
export const DEFAULT_FONT_SIZE = 12

/**
 * 同步时需要忽略的属性键
 * 这些属性不应该从主文本同步到特效文本层
 * 因为它们是特效层独有的或会导致冲突
 */
export const IGNORE_SYNC_KEYS = [
  'tag', // 标签名
  'textEffects', // 特效配置本身
  'fill', // 填充（特效层有自己的填充）
  'stroke', // 描边（特效层有自己的描边）
  'x', // X 坐标（特效层有偏移）
  'y', // Y 坐标（特效层有偏移）
  'skew', // 倾斜
  'scale', // 缩放
  'scaleX', // X 轴缩放
  'scaleY', // Y 轴缩放
  'rotation', // 旋转
  'textEditing', // 编辑状态
  'editable', // 可编辑性
  'id', // ID
  'states', // 状态
  'data', // 数据
  'shadow', // 外阴影
  'innerShadow', // 内阴影
  'visible', // 可见性
  'boxStyle', // 盒子样式
]

// ==================== 辅助函数 ====================

/**
 * 判断元素是否可见
 * @param item - 待检查的元素
 * @returns 如果 visible 不为 false 或 0，则返回 true
 */
function isVisible(item?: any): boolean {
  return item?.visible !== false && item?.visible !== 0
}

/**
 * 获取偏移值
 * @param offset - 偏移配置对象
 * @returns 返回 x 和 y 坐标，如果不可见或未定义则返回 {x: 0, y: 0}
 */
function getOffsetValue(offset?: IEnable<IPointData>): { x: number, y: number } {
  if (!offset || !isVisible(offset)) {
    return { x: 0, y: 0 }
  }
  return { x: offset.x || 0, y: offset.y || 0 }
}

/**
 * 获取描边宽度
 * @param stroke - 描边配置对象
 * @returns 返回描边宽度，如果不可见或未定义则返回 0
 */
function getStrokeWidth(stroke?: IEnable<IStrokePaint>): number {
  if (!stroke || !isVisible(stroke)) {
    return 0
  }
  return (stroke as any).style?.strokeWidth || 0
}

/**
 * 获取虚线模式
 * @param stroke - 描边配置对象
 * @returns 返回虚线模式数组，如果不存在或为空则返回 undefined
 */
function getDashPattern(stroke?: IEnable<IStrokePaint>): number[] | undefined {
  if (!stroke || !isVisible(stroke)) {
    return undefined
  }
  const dashPattern = (stroke as any).style?.dashPattern
  return dashPattern && Array.isArray(dashPattern) && dashPattern.length > 0 ? dashPattern : undefined
}

/**
 * 计算方向上的扩散范围
 * 根据偏移量和描边扩散计算正负方向的扩散值
 * @param offset - 偏移量（可正可负）
 * @param strokeSpread - 描边扩散值
 * @returns 返回正方向和负方向的扩散值
 */
function calculateDirectionSpread(offset: number, strokeSpread: number): { positive: number, negative: number } {
  if (offset < 0) {
    // 负偏移：负方向扩散 = |偏移| + 描边扩散
    return { positive: 0, negative: Math.abs(offset) + strokeSpread }
  }
  else if (offset > 0) {
    // 正偏移：正方向扩散 = 偏移 + 描边扩散
    return { positive: offset + strokeSpread, negative: 0 }
  }
  else {
    // 无偏移：两个方向都扩散描边宽度
    return { positive: strokeSpread, negative: strokeSpread }
  }
}

/**
 * 从对象中排除指定的键
 * @param obj - 源对象
 * @param keys - 要排除的键数组
 * @returns 返回新对象，不包含指定的键
 */
function omitKeys(obj: any, keys: string[]) {
  const newObj: any = {}
  for (const key in obj) {
    if (!keys.includes(key)) {
      newObj[key] = obj[key]
    }
  }
  return newObj
}

/**
 * 将数据转换为数组
 * @param data - 任意类型的数据
 * @returns 返回数组形式的数据
 */
function toArr(data: any) {
  if (isNull(data)) {
    return []
  }
  if (isArray(data)) {
    return data
  }
  if (isString(data)) {
    return data.split(' ')
  }
  return [data]
}

/**
 * 标准化文本特效配置
 * 将特效配置从一个 fontSize 基准标准化到另一个 fontSize 基准
 * 用于创建固定尺寸的预览文字，保持特效比例一致
 *
 * @param effects - 源特效配置数组
 * @param sourceFontSize - 源文字的 fontSize
 * @param targetFontSize - 目标文字的 fontSize
 * @returns 标准化后的特效配置（深拷贝）
 *
 * @example
 * // 将 24px 字体的特效缩放到 12px
 * const scaled = normalizeTextEffects(effects, 24, 12)
 */
export function normalizeTextEffects(
  effects: ITextEffect[] | undefined,
  sourceFontSize: number,
  targetFontSize: number,
): ITextEffect[] | undefined {
  // 如果没有特效或字体大小相同，直接返回
  if (!effects?.length)
    return effects
  if (sourceFontSize === targetFontSize)
    return effects

  // 计算缩放比例
  const scale = targetFontSize / sourceFontSize

  // 深拷贝特效配置，避免修改原始数据
  const clonedEffects: ITextEffect[] = JSON.parse(JSON.stringify(effects))
  return clonedEffects.map((effect) => {
    // 缩放偏移量
    if (effect.offset && isVisible(effect.offset)) {
      effect.offset = {
        x: (effect.offset.x || 0) * scale,
        y: (effect.offset.y || 0) * scale,
      }
    }

    // 缩放描边相关属性
    if (effect.stroke?.style) {
      // 缩放描边宽度
      if (effect.stroke.style.strokeWidth) {
        ; (effect.stroke.style.strokeWidth as any) *= scale
      }

      // 缩放虚线模式
      if (effect.stroke.style.dashPattern && Array.isArray(effect.stroke.style.dashPattern)) {
        effect.stroke.style.dashPattern = effect.stroke.style.dashPattern.map((value: number) => value * scale)
      }
    }

    return effect
  })
}

/**
 * 标准化文本数据
 * 按指定 fontSize 标准化输出新比例的阴影、描边和特效文字数据
 *
 * @param data - 特效文字数据
 * @param fontSize - 目标文字的 fontSize
 * @returns 标准化后的文字配置
 *
 * @example
 * // 将文本数据缩放到 16px
 * const normalized = normalizeTextData(textData, 16)
 */
export function normalizeTextData(data: IEffectTextInputData, fontSize: number) {
  const sourceFontSize = data.fontSize || DEFAULT_FONT_SIZE

  // 如果字体大小相同，直接返回
  if (sourceFontSize === fontSize) {
    return data
  }

  // 计算缩放比例
  const scale = fontSize / sourceFontSize

  // 标准化 textEffects（特效层）
  if (data.textEffects) {
    data.textEffects = normalizeTextEffects(data.textEffects, sourceFontSize, fontSize)
  }

  // 标准化描边
  if (data.stroke) {
    const strokeList = toArr(data.stroke)
    data.stroke = strokeList.map((stroke: any) => {
      // 如果是字符串（颜色），直接返回
      if (isString(stroke)) {
        return stroke
      }
      // 克隆描边对象并缩放相关属性
      const clonedStroke = { ...stroke }
      if (clonedStroke.style) {
        clonedStroke.style = { ...clonedStroke.style }
        // 缩放描边宽度
        if (clonedStroke.style.strokeWidth) {
          clonedStroke.style.strokeWidth *= scale
        }
        // 缩放虚线模式
        if (clonedStroke.style.dashPattern && Array.isArray(clonedStroke.style.dashPattern)) {
          clonedStroke.style.dashPattern = clonedStroke.style.dashPattern.map((v: number) => v * scale)
        }
      }
      return clonedStroke
    })
    // 如果只有一个描边，解包数组
    if (strokeList.length === 1) {
      data.stroke = data.stroke[0]
    }
  }

  // 标准化 strokeWidth（描边宽度）
  if (data.strokeWidth) {
    data.strokeWidth *= scale
  }

  // 标准化 dashPattern（虚线模式）
  if (data.dashPattern && Array.isArray(data.dashPattern)) {
    data.dashPattern = data.dashPattern.map((v: number) => v * scale)
  }

  // 标准化 shadow（外阴影）
  if (data.shadow) {
    const shadowList = toArr(data.shadow)
    data.shadow = shadowList.map((shadow: any) => {
      const clonedShadow = { ...shadow }
      if (clonedShadow.x)
        clonedShadow.x *= scale
      if (clonedShadow.y)
        clonedShadow.y *= scale
      if (clonedShadow.blur)
        clonedShadow.blur *= scale
      if (clonedShadow.spread)
        clonedShadow.spread *= scale
      return clonedShadow
    })
    if (shadowList.length === 1) {
      data.shadow = data.shadow[0]
    }
  }

  // 标准化 innerShadow（内阴影）
  if (data.innerShadow) {
    const innerShadowList = toArr(data.innerShadow)
    data.innerShadow = innerShadowList.map((shadow: any) => {
      const clonedShadow = { ...shadow }
      if (clonedShadow.x)
        clonedShadow.x *= scale
      if (clonedShadow.y)
        clonedShadow.y *= scale
      if (clonedShadow.blur)
        clonedShadow.blur *= scale
      if (clonedShadow.spread)
        clonedShadow.spread *= scale
      return clonedShadow
    })
    if (innerShadowList.length === 1) {
      data.innerShadow = data.innerShadow[0]
    }
  }

  return data
}

// ==================== 数据类 ====================

/**
 * 特效文本数据类
 * 继承自 TextData，负责管理特效文本的内部数据和状态
 *
 * 核心功能：
 * 1. 管理特效层的创建、更新和销毁
 * 2. 记录和维护特效属性的比例关系
 * 3. 响应字体大小变化，动态调整特效位置和样式
 */
export class EffectTextData extends TextData implements IEffectTextData {
  _textEffects?: ITextEffect[] // 特效配置数组
  __effectTextGroup: IText[] // 特效文本实例数组
  __effectRatios?: IEffectRatio[] // 特效比例数据数组
  __ratiosInitialized?: boolean // 比例是否已初始化标志

  /**
   * 设置文本特效
   * 当特效配置改变时调用，负责创建或更新特效文本层
   * @param value - 新的特效配置数组
   */
  setTextEffects(value: ITextEffect[]) {
    const mainText = this.__leaf as IEffectText

    if (value?.length) {
      // 记录特效的绝对值（后续会转换为比例）
      this.recordAbsoluteValues(value)
      // 更新或创建特效文本实例
      this.updateOrCreateEffectTexts(mainText, value)
    }
    else {
      // 清除所有特效
      this.clearAllEffects(mainText)
    }

    this._textEffects = value
  }

  /**
   * 记录特效的绝对值
   * 首次设置时记录偏移、描边等属性的绝对值
   * 后续会转换为相对于字体大小的比例
   * @param effects - 特效配置数组
   */
  recordAbsoluteValues(effects: ITextEffect[]) {
    // 先记录绝对值，存储在 ratio 字段中（此时还不是比例）
    this.__effectRatios = effects.map((effect) => {
      const offset = getOffsetValue(effect.offset)
      const strokeWidth = getStrokeWidth(effect.stroke)
      const dashPattern = getDashPattern(effect.stroke)
      return {
        offsetXRatio: offset.x,
        offsetYRatio: offset.y,
        strokeWidthRatio: strokeWidth,
        dashPatternRatios: dashPattern ? [...dashPattern] : undefined,
      }
    })
    this.__ratiosInitialized = false
  }

  /**
   * 更新或创建特效文本实例
   * 复用已存在的文本实例，或创建新的实例
   * @param mainText - 主文本实例
   * @param effects - 特效配置数组
   */
  updateOrCreateEffectTexts(mainText: IEffectText, effects: ITextEffect[]) {
    const existingGroup = this.__effectTextGroup || []

    const newGroup: IText[] = effects.map((effect, index) => {
      const offset = getOffsetValue(effect.offset)
      const { fill, stroke, filter } = effect
      const inputData: IUIInputData = {
        fill,
        stroke,
        ...offset,
        visible: isVisible(effect),
      }

      // 添加 filter 属性处理
      if (filter !== undefined && isVisible(filter)) {
        inputData.filter = filter
      }

      // 复用现有元素或创建新元素
      let text = existingGroup[index]
      if (text) {
        text.set(inputData)
      }
      else {
        text = new Text(inputData) as IText
      }
      return text
    })

    // 隐藏多余的元素（当特效数量减少时）
    for (let i = effects.length; i < existingGroup.length; i++) {
      existingGroup[i].visible = 0
    }

    mainText.__effectTextGroup = this.__effectTextGroup = newGroup
  }

  /**
   * 清除所有特效
   * 隐藏所有特效文本实例并清空数组
   * @param mainText - 主文本实例
   */
  clearAllEffects(mainText: IEffectText) {
    if (this.__effectTextGroup?.length) {
      this.__effectTextGroup.forEach(t => (t.visible = 0))
      this.__effectTextGroup = mainText.__effectTextGroup = []
    }
  }

  /**
   * 更新特效位置
   * 根据当前字体大小和记录的比例，动态计算特效的实际位置和样式
   * 这是实现响应式缩放的核心方法
   */
  updateEffectPositions() {
    const mainText = this.__leaf as IEffectText
    const { __effectTextGroup: group, __effectRatios, __ratiosInitialized, _textEffects } = this

    if (!group || !__effectRatios)
      return

    const currentFontSize = mainText.fontSize || DEFAULT_FONT_SIZE

    // 第一次调用时，将绝对值转换为比例
    if (!__ratiosInitialized) {
      __effectRatios.forEach((ratio) => {
        ratio.offsetXRatio = ratio.offsetXRatio / currentFontSize
        ratio.offsetYRatio = ratio.offsetYRatio / currentFontSize
        ratio.strokeWidthRatio = ratio.strokeWidthRatio / currentFontSize
        if (ratio.dashPatternRatios) {
          ratio.dashPatternRatios = ratio.dashPatternRatios.map(value => value / currentFontSize)
        }
      })
      this.__ratiosInitialized = true
    }

    // 根据当前字体大小和比例计算实际值
    __effectRatios.forEach((ratio, index) => {
      const text = group[index]
      const effect = _textEffects[index]
      if (!text)
        return

      // 计算实际的偏移量和描边宽度
      const actualX = ratio.offsetXRatio * currentFontSize
      const actualY = ratio.offsetYRatio * currentFontSize
      const actualStrokeWidth = ratio.strokeWidthRatio * currentFontSize

      // 更新特效文本实例的位置
      text.x = actualX
      text.y = actualY
      effect.offset = {
        ...(effect.offset || {}),
        x: actualX,
        y: actualY,
      }

      // 更新描边宽度和虚线模式
      if (text.stroke && (text.stroke as any).style) {
        ; (text.stroke as any).style.strokeWidth = actualStrokeWidth
        effect.stroke.style.strokeWidth = actualStrokeWidth

        // 更新虚线模式
        if (ratio.dashPatternRatios) {
          const actualDashPattern = ratio.dashPatternRatios.map(value => value * currentFontSize)
            ; (text.stroke as any).style.dashPattern = actualDashPattern
          effect.stroke.style.dashPattern = actualDashPattern
        }
      }

      // 更新变换矩阵和边界
      text.__updateLocalMatrix()
      text.__updateWorldMatrix()
    })
  }
}

// ==================== 主类 ====================
const console = Debug.get('leafer-x-effect-text')

/**
 * 特效文本类
 *
 * 这是一个增强的文本组件，支持多层文本特效叠加
 *
 * 核心特性：
 * 1. 多层特效：支持添加多个特效层，每层可独立配置偏移、描边、填充
 * 2. 响应式缩放：特效会随字体大小自动缩放，保持视觉比例一致
 * 3. 性能优化：复用文本实例，避免频繁创建销毁
 * 4. 编辑支持：在文本编辑时保持特效渲染
 *
 * 使用示例：
 * ```typescript
 * const text = new EffectText({
 *   text: 'Hello',
 *   fontSize: 24,
 *   textEffects: [
 *     {
 *       offset: { x: 2, y: 2 },
 *       fill: '#000000',
 *       stroke: { style: { strokeWidth: 1, color: '#ffffff' } }
 *     }
 *   ]
 * })
 * ```
 *
 * @template TConstructorData - 构造函数数据类型
 */
@registerUI()
export class EffectText<TConstructorData = IEffectTextInputData> extends Text<TConstructorData> implements IEffectText {
  /**
   * 获取组件标签名
   */
  get __tag() {
    return 'EffectText'
  }

  /**
   * 数据处理器装饰器
   * 使用 EffectTextData 类处理内部数据
   */
  @dataProcessor(EffectTextData)
  declare public __: IEffectTextData

  /**
   * 文本特效配置
   * 使用 @boundsType 装饰器标记为影响边界的属性
   */
  @boundsType()
  declare textEffects?: ITextEffect[]

  /**
   * 字体大小特效开关
   * 启用后，字体大小变化时会自动调整描边、阴影等属性的比例
   */
  @dataType(true)
  declare fontSizeEffect: boolean

  /**
   * 特效文本实例组
   */
  declare public __effectTextGroup?: Text[]

  /**
   * 是否有特效
   */
  get hasEffects(): boolean {
    return !!this.textEffects?.length
  }

  /**
   * 事件监听器 ID 列表
   */
  protected __eventIds: IEventListenerId[] = []

  /**
   * 文本比例数据
   * 存储主文本的描边、阴影等属性相对于字体大小的比例
   */
  protected __textRatio: ITextRatio

  /**
   * 构造函数
   * @param data - 初始化数据
   */
  constructor(data?: TConstructorData) {
    super(data)
    // 监听属性变化事件
    this.__eventIds = [this.on_(PropertyEvent.CHANGE, this._lisFontSizeEffects, this)]
  }

  /**
   * 监听字体大小特效
   * 当 fontSize 或相关属性变化时，动态更新元素描边、阴影到合适比例
   * 实现元素放大缩小后的展示效果一致
   *
   * @param e - 属性变化事件
   */
  protected _lisFontSizeEffects(e: PropertyEvent): void {
    // 如果未启用字体大小特效，直接返回
    if (!this.fontSizeEffect) {
      return
    }

    // 监听 fontSize 变化
    if (['fontSize'].includes(e.attrName)) {
      // 更新主文本的描边、阴影比例
      this._updateEffectAttr()
      // 更新特效层的位置和样式
      if (this.hasEffects) {
        this.__.updateEffectPositions()
      }
    }
    // 监听描边、阴影属性变化，重新收集比例
    else if (['strokeWidth', 'dashPattern', 'stroke', 'shadow', 'innerShadow'].includes(e.attrName)) {
      this._collectRatios()
    }
  }

  /**
   * 更新特效属性
   * 根据当前字体大小和记录的比例，更新主文本的描边、阴影等属性
   */
  protected _updateEffectAttr() {
    const { stroke, fontSize, __textRatio } = this
    if (!__textRatio) {
      return
    }

    // 更新描边
    if (stroke) {
      this.__.stroke = toArr(stroke).map((v, i) => {
        const { width, dashPattern } = __textRatio.stroke[i]
        // 子描边独立控制
        if (v.style) {
          if ('strokeWidth' in v.style) {
            v.style.strokeWidth = width * fontSize
          }
          if ('dashPattern' in v.style) {
            const _dashPattern = v.style.dashPattern
            if (_dashPattern && _dashPattern.length) {
              v.style.dashPattern = dashPattern.map(v => v * fontSize)
            }
          }
        }
        // 整体描边控制
        if (this.strokeWidth) {
          this.__.strokeWidth = width * fontSize
        }
        if (this.dashPattern) {
          this.__.dashPattern = dashPattern.map(v => v * fontSize)
        }
        return v
      })
    }

    // 更新阴影和内阴影
    const shadowAttr = ['shadow', 'innerShadow']
    shadowAttr.forEach((attr) => {
      const attrItem = (this as any)[attr]
      if (attrItem) {
        ; (this.__ as any)[attr] = toArr(attrItem).map((v: any, i) => {
          const ratio: any = (__textRatio as any)[attr][i]
          Object.keys(ratio).forEach((key: string) => {
            if (key in v) {
              v[key] = ratio[key] * fontSize
            }
          })
          return v
        })
      }
    })
  }

  /**
   * 收集比例数据
   * 计算并存储主文本的描边、阴影等属性相对于字体大小的比例
   * 用于后续的响应式缩放
   */
  protected _collectRatios(): void {
    const { shadow, innerShadow, stroke, strokeWidth, dashPattern, fontSize } = this

    /**
     * 获取单个值的比例
     */
    function getRatio(num?: any): number {
      if (isNull(num))
        return 1
      if (isArray(num)) {
        return getRatio(num[0])
      }
      return tryToNumber(num) / fontSize
    }

    /**
     * 获取数组值的比例列表
     */
    function getListRatio(arr?: any): number[] {
      return toArr(arr).map(getRatio)
    }

    const strokeList = toArr(stroke)
    const shadowList = toArr(shadow)
    const innerShadowList = toArr(innerShadow)

    // 收集所有比例数据
    this.__textRatio = {
      // 描边比例
      stroke: strokeList.map((stroke) => {
        if (isString(stroke)) {
          return {
            width: getRatio(strokeWidth),
            dashPattern: getListRatio(dashPattern || []),
          } as StrokeRatioItem
        }
        if (stroke.style) {
          const { strokeWidth: itemWidth, dashPattern: itemDash } = stroke.style
          const width = getRatio(itemWidth || strokeWidth)
          const dash = getListRatio(itemDash || dashPattern)
          return {
            width,
            dashPattern: dash,
          } as StrokeRatioItem
        }
        return {
          width: getRatio(strokeWidth),
          dashPattern: getListRatio(dashPattern || []),
        } as StrokeRatioItem
      }),
      // 外阴影比例
      shadow: shadowList.map((shadow) => {
        return {
          x: getRatio(shadow.x),
          y: getRatio(shadow.y),
          blur: getRatio(shadow.blur),
          spread: getRatio(shadow.spread),
        } as ShadowRatioItem
      }),
      // 内阴影比例
      innerShadow: innerShadowList.map((shadow) => {
        return {
          x: getRatio(shadow.x),
          y: getRatio(shadow.y),
          blur: getRatio(shadow.blur),
          spread: getRatio(shadow.spread),
        } as ShadowRatioItem
      }),
    }
  }

  /**
   * 遍历所有特效文本
   * @param callback - 对每个特效文本执行的回调函数
   */
  protected _forEachEffect(callback: (text: Text) => void): void {
    this.__effectTextGroup?.forEach(callback)
  }

  /**
   * 更新特效文本的变换和边界
   * @param text - 特效文本实例
   */
  protected _updateEffectText(text: Text): void {
    text.__updateLocalMatrix() // 更新本地变换矩阵
    text.__updateWorldMatrix() // 更新世界变换矩阵
    text.__updateLocalBounds() // 更新本地边界
    text.__updateWorldBounds() // 更新世界边界
  }

  /**
   * 更新变化
   * 当主文本属性变化时，同步更新所有特效文本
   * 这是 Leafer UI 生命周期方法的重写
   */
  override __updateChange(): void {
    console.log('__updateChange')
    // 如果还没有收集比例数据，先收集
    if (!this.__textRatio) {
      this._collectRatios()
    }
    // 获取需要同步的属性（排除特效层独有的属性）
    const syncProps = omitKeys(this.toJSON(), IGNORE_SYNC_KEYS)

    // 调用父类方法
    super.__updateChange()

    // 同步属性到所有特效文本
    this._forEachEffect((text) => {
      text.set(syncProps)
      text.parent = this as any
      this._updateEffectText(text)
    })
  }

  /**
   * 更新盒子边界
   * 同步更新所有特效文本的边界
   * 这是 Leafer UI 生命周期方法的重写
   */
  override __updateBoxBounds() {
    console.log('__updateBoxBounds')
    this._forEachEffect((text) => {
      text.__updateBoxBounds()
    })
    super.__updateBoxBounds()
  }

  /**
   * 绘制方法
   * 先绘制主文本，再依次绘制所有特效文本层
   * 这是 Leafer UI 渲染方法的重写
   *
   * @param canvas - 画布对象
   * @param options - 渲染选项
   * @param originCanvas - 原始画布（可选）
   */
  override __draw(canvas: ILeaferCanvas, options: IRenderOptions, originCanvas?: ILeaferCanvas): void {
    console.log('__draw')
    // 修复：期望主文本在编辑时继续渲染
    // 原则上应该修改 this.textEditing，但是 __draw 频繁调用不好直接操作
    // 于是退而求其次改变 exporting，从而跳过 super 内部的判断
    super.__draw(canvas, { ...options, exporting: true }, originCanvas)

    // 绘制所有特效文本层
    this._forEachEffect((text) => {
      this._updateEffectText(text)
      // 跳过不可见的特效层
      if (!isVisible(text)) {
        return
      }
      // 设置世界坐标系并绘制
      canvas.setWorld((text.__nowWorld = text.__getNowWorld(options)))
      text.__draw(canvas, options, originCanvas)
    })
  }

  /**
   * 更新渲染扩散范围
   * 计算包含所有特效层的总边界扩散
   * 确保特效不会被裁剪
   * 这是 Leafer UI 边界计算方法的重写
   *
   * @returns 返回 [上, 右, 下, 左] 四个方向的扩散值
   */
  override __updateRenderSpread(): IFourNumber {
    console.log('__updateRenderSpread')
    // 获取主文本的扩散范围
    const rootSpread = super.__updateRenderSpread()
    let [top, right, bottom, left] = FourNumberHelper.get(rootSpread)

    // 如果没有特效，直接返回主文本的扩散范围
    if (!this.textEffects?.length) {
      return [top, right, bottom, left]
    }

    // 遍历所有特效，计算最大扩散范围
    this.textEffects.forEach((effect) => {
      if (!isVisible(effect))
        return

      // 获取特效的偏移和描边宽度
      const { x: offsetX, y: offsetY } = getOffsetValue(effect.offset)
      const strokeWidth = getStrokeWidth(effect.stroke)
      const strokeSpread = strokeWidth / 2

      // 计算水平和垂直方向的扩散
      const horizontalSpread = calculateDirectionSpread(offsetX, strokeSpread)
      const verticalSpread = calculateDirectionSpread(offsetY, strokeSpread)

      // 取最大值作为最终扩散范围
      right = Math.max(right, horizontalSpread.positive)
      left = Math.max(left, horizontalSpread.negative)
      bottom = Math.max(bottom, verticalSpread.positive)
      top = Math.max(top, verticalSpread.negative)
    })

    return [top, right, bottom, left]
  }

  /**
   * 销毁方法
   * 清理所有事件监听器和特效文本实例
   * 这是 Leafer UI 生命周期方法的重写
   */
  override destroy(): void {
    // 移除事件监听器
    this.off_(this.__eventIds)
    // 销毁所有特效文本实例
    this._forEachEffect(text => text.destroy())
    // 清空引用
    this.textEffects = this.__effectTextGroup = null
    // 调用父类销毁方法
    super.destroy()
  }
}

// 注册插件到 Leafer UI
Plugin.add('leafer-x-effect-text')
