import type { ResolvedSlidevOptions } from '@slidev/types'
import { Buffer } from 'node:buffer'
import { mkdir, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/**
 * The asset drawer is backed by the deck's own `public/` directory, so an
 * image dropped onto a slide becomes a normal file the user can commit, and
 * the slide references it with a plain `/file.png` URL.
 */

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024
/** Enough for any real deck, and a bound when a symlink points at a large media library. */
const MAX_LISTED_ASSETS = 5000

export interface AssetEntry {
  /** URL to use inside a slide. */
  url: string
  name: string
  size: number
  kind: 'image' | 'video'
}

/** Where `public/` resolves to, which is the deck's directory, not the repo root. */
export function assetRoot(options: ResolvedSlidevOptions) {
  return join(options.userRoot, 'public')
}

export async function listAssets(options: ResolvedSlidevOptions): Promise<AssetEntry[]> {
  const root = assetRoot(options)
  const assets: AssetEntry[] = []
  await walk(root, '', assets, new Set())
  return assets.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Lists the media files under `dir`, following symbolic links.
 *
 * `readdir(..., { recursive: true })` does not enter a symlinked directory and
 * reports the link itself as neither a file nor a directory, so a deck that
 * shares assets through `public/shared -> ../../shared/assets` showed none of
 * them. `stat` follows the link, and the real path of every visited directory
 * is remembered so a link that points back up the tree cannot loop. The URL
 * keeps the path as seen from `public/`, which is what the browser requests.
 */
async function walk(dir: string, rel: string, assets: AssetEntry[], seen: Set<string>): Promise<void> {
  let real: string
  try {
    real = await realpath(dir)
  }
  catch {
    return
  }
  if (seen.has(real))
    return
  seen.add(real)

  let names: string[]
  try {
    names = await readdir(dir)
  }
  catch {
    return
  }

  for (const name of names.sort()) {
    if (assets.length >= MAX_LISTED_ASSETS)
      return
    const full = join(dir, name)
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(full)
    }
    catch {
      // A dangling link: skip it rather than failing the whole listing.
      continue
    }
    const path = rel ? `${rel}/${name}` : name
    if (info.isDirectory()) {
      await walk(full, path, assets, seen)
      continue
    }
    if (!info.isFile())
      continue
    const ext = extname(name).toLowerCase()
    const kind = IMAGE_EXTENSIONS.has(ext) ? 'image' : VIDEO_EXTENSIONS.has(ext) ? 'video' : null
    if (!kind)
      continue
    assets.push({ url: `/${path}`, name, size: info.size, kind })
  }
}

export interface UploadPayload {
  name: string
  /** Base64 payload, with or without a `data:` prefix. */
  data: string
  /** Optional sub-directory inside `public/`. */
  dir?: string
}

export async function saveAsset(options: ResolvedSlidevOptions, payload: UploadPayload): Promise<AssetEntry> {
  const ext = extname(payload.name).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext))
    throw new Error(`Unsupported file type "${ext || payload.name}"`)

  const base64 = payload.data.includes(',') ? payload.data.slice(payload.data.indexOf(',') + 1) : payload.data
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength > MAX_UPLOAD_BYTES)
    throw new Error(`File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`)

  const publicRoot = assetRoot(options)
  const dir = sanitizeSegment(payload.dir ?? '')
  const targetDir = dir ? join(publicRoot, dir) : publicRoot
  await mkdir(targetDir, { recursive: true })

  const name = await uniqueName(targetDir, sanitizeFileName(payload.name))
  await writeFile(join(targetDir, name), buffer)

  return {
    url: `/${[dir, name].filter(Boolean).join('/')}`,
    name,
    size: buffer.byteLength,
    kind: IMAGE_EXTENSIONS.has(ext) ? 'image' : 'video',
  }
}

function sanitizeFileName(name: string) {
  return basename(name)
    .replace(/[^\w.\-]+/g, '-')
    .replace(/^[-.]+/, '')
    .toLowerCase() || 'asset'
}

function sanitizeSegment(dir: string) {
  return dir
    .split(/[\\/]/)
    .map(part => part.replace(/[^\w\-]+/g, ''))
    .filter(part => part && part !== '.' && part !== '..')
    .join('/')
}

async function uniqueName(dir: string, name: string) {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = name
  let counter = 1
  while (await exists(join(dir, candidate))) {
    candidate = `${stem}-${counter}${ext}`
    counter += 1
  }
  return candidate
}

async function exists(path: string) {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}
