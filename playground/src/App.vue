<script setup lang="ts">
import {onMounted} from 'vue'
import '@leafer-in/editor'
import '@leafer-in/resize'
import '@leafer-in/view'
import '@leafer-in/viewport'
import '@lx/effect-text-editor'
import {App, UICreator} from "leafer-ui";
import {EffectText} from "@lx/effect-text";
import { Text } from "leafer-ui"

let leaferApp: App

function initLeafer() {
  leaferApp = new App({
    view: 'leafer-app',
    width: 1200,
    height: 600,
    editor: {},
  })

  const text = new EffectText({
    text: '233445',
    fontSize: 80,
    x: 200,
    y: 200,
    editable: true,
  })

  console.log(text)
  leaferApp.tree.add(text)
  leaferApp.tree.add(new Text({
    text: 'xxxxxx',
    fontSize: 80,
    editable: true,
  }))

  console.log(UICreator.list);

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
