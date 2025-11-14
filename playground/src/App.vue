<script setup lang="ts">
import {onMounted} from 'vue'
import '@leafer-in/editor'
import '@lx/effect-text-editor'
import {App, UICreator} from "leafer-ui";
import {EffectText} from "@lx/effect-text";

let leaferApp: App
// Debug.showBounds = 'hit'
console.log(UICreator.list);

function initLeafer() {

  leaferApp = new App({
    view: 'leafer-app',
    width: 1200,
    height: 600,
    editor: {},
  })

  const baseFill = {
    type: 'linear',
    color: '#000000',
    visible: true,
    from: { x: 0, y: 0.5, type: 'percent' },
    to: { x: 1, y: 0.5, type: 'percent' },
    stops: [
      { offset: 0, color: 'rgb(248, 54, 0)' },
      { offset: 1, color: 'rgb(250, 204, 34)' },
    ],
  }

  const tX = new EffectText({
    text: 'mode: x',
    fontSize: 36,
    x: 100,
    y: 120,
    fill: baseFill,
    writingMode: 'x',
    editable: true,
  })

  const tXr = new EffectText({
    text: 'mode: x-reverse',
    fontSize: 36,
    x: 100,
    y: 200,
    fill: baseFill,
    writingMode: 'x-reverse',
    editable: true,
  })

  const tY = new EffectText({
    text: 'mode: y',
    fontSize: 36,
    x: 500,
    y: 120,
    fill: baseFill,
    writingMode: 'y',
    editable: true,
  })

  const tYr = new EffectText({
    text: 'mode: y-reverse',
    fontSize: 36,
    x: 800,
    y: 120,
    fill: baseFill,
    writingMode: 'y-reverse',
    editable: true,
  })

  leaferApp.tree.add(tX)
  leaferApp.tree.add(tXr)
  leaferApp.tree.add(tY)
  leaferApp.tree.add(tYr)
  console.log(tX.toJSON(), tXr.toJSON(), tY.toJSON(), tYr.toJSON())

  ;(window as any).app = leaferApp
}

onMounted(() => {
  initLeafer()
})
</script>

<template>
  <NFlex justify="start">
    <div id="leafer-app" style="background: antiquewhite;"></div>
    <div>
      <NButton>xxx</NButton>
    </div>
  </NFlex>
</template>
