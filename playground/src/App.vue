<script setup lang="ts">
import {onMounted} from 'vue'
import '@leafer-in/editor'
import '@leafer-in/text-editor'
import '@leafer-in/export'
import  '@leafer-in/view'
import  '@leafer-in/viewport'
import {App, Debug} from "leafer-ui";
import {EffectText} from "@lx/effect-text"

let leaferApp: App
Debug.showBounds = 'hit'
Debug.filter = 'EffectText'
Debug.enable = true
// console.log(UICreator.list);

function initLeafer() {

  leaferApp = new App({
    view: 'leafer-app',
    width: 1200,
    height: 600,
    editor: {
      editSize: 'size',
      point: {
        editConfig: {editSize: 'font-size'},
      }
    },
  })

  const et = new EffectText({
    text: '特效文字',
    fontSize: 36,
    x: 400,
    y: 220,
    editable: true,
    textAlign: 'center',
    verticalAlign: 'middle',
    fill: "#f40",
    textEffects: [
      {
        visible: true,
        fill: {
          "type": "linear",
          "color": "#000000",
          "visible": true,
          "from": {
            "x": 0,
            "y": 0.5,
            "type": "percent"
          },
          "to": {
            "x": 1,
            "y": 0.5,
            "type": "percent"
          },
          "stops": [
            {
              "offset": 0,
              "color": "rgb(248, 54, 0)"
            },
            {
              "offset": 1,
              "color": "rgb(250, 204, 34)"
            }
          ],
          "offset": {
            "visible": true,
            "x": 0,
            "y": 10
          }
        },
        stroke: {
          "type": "solid",
          "color": "rgba(255, 255, 255, 1)",
          "visible": true,
          "style": {
            "strokeJoin": "round",
            "strokeWidth": 3
          }
        },
        offset: {
          visible: true,
          x: -20,
          y: 50
        }
      },
      {
        visible: true,
        fill: {
          "type": "solid",
          "color": "#000",
          "visible": true,
        },
        stroke: {
          "type": "solid",
          "color": "rgba(255, 255, 255, 1)",
          "visible": true,
          "style": {
            "strokeJoin": "round",
          }
        },
        offset: {
          visible: true,
          x: 50,
          y: -100
        }
      },
    ],
  })

  leaferApp.tree.add(et)
  console.log(et, et.toJSON())

  ;(window as any).app = leaferApp
}

onMounted(() => {
  initLeafer()
})

function handleExport() {
  leaferApp.tree.export("test.png")
}
function handleExport2() {
  const text = leaferApp.tree.children[0]
  console.log(text.toJSON())
}
function handleDebug() {
  Debug.enable = !Debug.enable
  Debug.showBounds = Debug.enable ? 'hit' : false
}
</script>

<template>
  <NFlex justify="start">
    <div id="leafer-app" style="background: antiquewhite;"></div>
    <NFlex vertical>
      <h3>操作</h3>
      <NFlex justify="start">
        <NButton @click="handleDebug"> Debug </NButton>
        <NButton @click="handleExport">导出图片</NButton>
        <NButton @click="handleExport2">导出JSON（见console）</NButton>
      </NFlex>
    </NFlex>
  </NFlex>
</template>
