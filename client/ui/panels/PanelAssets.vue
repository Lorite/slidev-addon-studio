<script setup lang="ts">
import type { StudioAsset } from '../../types'
import { onMounted, ref } from 'vue'
import { assetApi, readAsBase64 } from '../../composables/useDeckApi'
import { useStudio } from '../../context'
import { assetSnippet, insertSnippet, positioned } from '../../md/insert'
import { getBlock, replaceBlock } from '../../md/lines'
import { replaceMediaSource, selectedMediaUrl } from '../../md/media'
import { selection } from '../../state'

/**
 * The asset drawer, backed by the deck's own `public/` directory. A dropped
 * image becomes a file in the repository and a plain `/name.png` reference in
 * the slide. Nothing here depends on Studio being installed later.
 */
const studio = useStudio()

const assets = ref<StudioAsset[]>([])
const root = ref('')
const over = ref(false)
const uploading = ref(false)

async function refresh() {
  const result = await assetApi.list()
  assets.value = result?.assets ?? []
  root.value = result?.root ?? ''
}

onMounted(refresh)

async function upload(files: FileList | null) {
  if (!files?.length)
    return
  uploading.value = true
  try {
    for (const file of files)
      await assetApi.upload(file.name, await readAsBase64(file))
    await refresh()
  }
  finally {
    uploading.value = false
  }
}

/**
 * With an image selected, a click swaps the file it shows and leaves the rest
 * of its markup as written: wrapper, size classes, alt text. Alt-click still
 * inserts after the selection, and with no image selected a click inserts.
 */
async function pick(asset: StudioAsset, event: MouseEvent) {
  if (event.shiftKey)
    return place(asset)
  if (!event.altKey && await replace(asset))
    return
  return insert(asset)
}

async function replace(asset: StudioAsset): Promise<boolean> {
  const target = selection.value
  const current = selectedMediaUrl(target?.el)
  if (!target?.range || !current)
    return false
  const content = studio.content()
  const block = getBlock(content, target.range)
  const next = replaceMediaSource(block, asset.url, current)
  if (next === null || next === block)
    return false
  await studio.commit(replaceBlock(content, target.range, next), `Replace image with ${asset.name}`)
  return true
}

async function insert(asset: StudioAsset) {
  const range = selection.value?.range
  await studio.commit(
    insertSnippet(studio.content(), assetSnippet(asset), range ? { mode: 'after', range } : { mode: 'append' }),
    `Insert ${asset.name}`,
  )
}

async function place(asset: StudioAsset) {
  const snippet = positioned(assetSnippet(asset), { x: 80, y: 80, w: 320, h: null, rotate: 0 })
  await studio.commit(insertSnippet(studio.content(), snippet, { mode: 'append' }), `Place ${asset.name}`)
}
</script>

<template>
  <label
    class="studio-dropzone"
    :class="{ 'studio-dropzone--over': over }"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="over = false; upload(($event.dataTransfer as DataTransfer).files)"
  >
    <input type="file" multiple accept="image/*,video/*" hidden @change="upload(($event.target as HTMLInputElement).files)">
    {{ uploading ? 'Uploading…' : 'Drop images here, or click to choose' }}
  </label>

  <div v-if="!assets.length" class="studio-empty">
    <p>Nothing here yet.</p>
    <p class="studio-hint">
      Assets live next to the deck, in <code>{{ root || 'public/' }}</code>.
      Dropping a file creates the directory.
    </p>
  </div>

  <div v-else class="studio-grid">
    <button
      v-for="asset in assets"
      :key="asset.url"
      class="studio-asset"
      :title="`${asset.url}. Click to replace the selected image or insert, alt-click to insert, shift-click to place freely`"
      @click="pick(asset, $event)"
    >
      <img v-if="asset.kind === 'image'" :src="asset.url" :alt="asset.name" loading="lazy">
      <span class="studio-asset__name">{{ asset.name }}</span>
    </button>
  </div>
</template>
