import type {
  ILeaferCanvas,
  IPaint,
  IPointData,
  IRenderOptions,
  IStrokePaint,
  IText,
  ITextStyleAttrData,
  ITextStyleComputedData,
  ITextStyleInputData,
  IUI,
  IUIBaseInputData,
  IUIData,
} from '@leafer-ui/interface'
import { boundsType, dataProcessor, registerUI, Text, TextData, UICreator } from '@leafer-ui/core'

type IEnable<T> = T & {
  visible: boolean
}

type ITextEffect = IEnable<{
  enable?: boolean
  offset?: IEnable<IPointData>
  stroke?: IEnable<IStrokePaint>
  fill?: IEnable<IPaint>
}>

interface IEffectTextAttrData {
  textEffects?: ITextEffect[]
}

interface IEffectTextData extends ITextStyleComputedData, IUIData {
  _textEffects?: ITextEffect[]

  __effectTextGroup?: IText[]
}

interface IEffectText extends IEffectTextAttrData, ITextStyleAttrData, IUI {
  __: IEffectTextData
  textEffects?: ITextEffect[]
  __effectTextGroup?: IText[]
}

interface IEffectTextInputData extends IEffectTextAttrData, ITextStyleInputData, IUIBaseInputData {
  textEffects?: ITextEffect[]
}

class EffectTextData extends TextData implements IEffectTextData {
  _textEffects?: ITextEffect[]

  __effectTextGroup: IText[]

  setTextEffects(value: ITextEffect[]) {
    const ui = this.__leaf as IEffectText
    const prev = this.__effectTextGroup
    if (prev && prev.length) {
      prev.forEach(t => t.destroy())
      this.__effectTextGroup = ui.__effectTextGroup = null
    }

    if (value && value.length) {
      const base = ui.toJSON() as IEffectText
      delete base.textEffects

      const group = value.map((v) => {
        const pos = (v.offset && v.offset.visible !== false)
          ? {
              x: base.x + (v.offset.x || 0),
              y: base.y + (v.offset.y || 0),
            }
          : {
              x: base.x,
              y: base.y,
            }

        const props: any = { ...base, ...pos, visible: v.visible }
        if (v.fill && v.fill.visible !== false)
          props.fill = v.fill
        if (v.stroke && v.stroke.visible !== false)
          props.stroke = v.stroke

        return UICreator.get('Text', props) as IText
      })

      ui.__effectTextGroup = this.__effectTextGroup = group
    }

    this._textEffects = value
  }
}

@registerUI()
export class EffectText<TConstructorData = IEffectTextInputData> extends Text<TConstructorData> implements IEffectText {
  get __tag() {
    return 'EffectText'
  }

  @dataProcessor(EffectTextData)
  public __: IEffectTextData

  @boundsType()
  textEffects?: ITextEffect[]

  public __effectTextGroup?: Text[]

  constructor(data?: TConstructorData) {
    super(data)
  }

  // 让每个特效元素都执行某函数
  protected _runEffectGroupAction(fun: (text: Text) => void): void {
    const group = this.__effectTextGroup || []
    if (group && group.length) {
      group.forEach(fun)
    }
  }

  override __updateChange(): void {
    super.__updateChange()
    this._runEffectGroupAction((text) => {
      text.__onUpdateSize()
      text.__updateChange()
    })
  }

  override __draw(canvas: ILeaferCanvas, options: IRenderOptions, originCanvas?: ILeaferCanvas): void {
    this._runEffectGroupAction((text) => {
      options = { ...options, shape: true }
      text.__nowWorld = this.__nowWorld
      text.__draw(canvas, options, originCanvas)
    })
    super.__draw(canvas, options, originCanvas)
  }

  override __drawShape(canvas: ILeaferCanvas, options: IRenderOptions): void {
    if (options.shape) {
      this._runEffectGroupAction((text) => {
        text.__drawShape(canvas, options)
      })
    }
    super.__drawShape(canvas, options)
  }

  override destroy(): void {
    this._runEffectGroupAction((text) => {
      text.destroy()
    })
    this.textEffects = this.__effectTextGroup = null
    super.destroy()
  }
}
