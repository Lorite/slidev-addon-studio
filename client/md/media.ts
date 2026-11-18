/**
 * Swapping the file an image points at, without touching anything else.
 *
 * Replacing a picture used to mean inserting the new one and deleting the old
 * one. The insert arrived as a bare `![name](url)` after the block, and the
 * delete took the old image's wrapper with it, so a sized box such as
 * `<div class="h-[190px]"><img … class="max-h-[160px]"></div>` lost its size and
 * the cards beside it no longer lined up. Changing the path where it is written
 * keeps the wrapper, the classes and the alt text exactly as they were.
 */

/** One place in a block where a media path is written. */
interface MediaRef {
  /** Where the path itself starts and ends in the block. */
  from: number
  to: number
  url: string
}

const MEDIA_EXTENSION = /\.(?:png|jpe?g|gif|svg|webp|avif|mp4|webm|mov)(?:[?#].*)?$/i

/**
 * Every media path written in a block: the `src` of an HTML or component tag,
 * and the target of a Markdown image. A `src` that does not end in a media
 * extension is left out, so an iframe or a script is never offered.
 */
export function mediaRefs(block: string): MediaRef[] {
  const refs: MediaRef[] = []
  for (const m of block.matchAll(/\ssrc=(["'])([^"']+)\1/g)) {
    const url = m[2]
    if (!MEDIA_EXTENSION.test(url))
      continue
    const from = m.index! + m[0].indexOf(m[1]) + 1
    refs.push({ from, to: from + url.length, url })
  }
  for (const m of block.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) {
    const url = m[1]
    const from = m.index! + m[0].lastIndexOf(url)
    refs.push({ from, to: from + url.length, url })
  }
  return refs.sort((a, b) => a.from - b.from)
}

/** The file name a URL ends in, decoded, so a rendered URL can be matched to the written one. */
function fileName(url: string): string {
  const path = url.replace(/[?#].*$/, '')
  const name = path.slice(path.lastIndexOf('/') + 1)
  try {
    return decodeURIComponent(name)
  }
  catch {
    return name
  }
}

/**
 * Writes `next` in place of one media path in `block`.
 *
 * `current` is the path the selected element renders, which may have been
 * rewritten by the dev server, so it is matched by file name. When it matches
 * exactly one path, that one is replaced. Without a match, a block holding a
 * single media path has that one replaced. Anything else returns null, and the
 * caller inserts instead of guessing.
 */
export function replaceMediaSource(block: string, next: string, current?: string | null): string | null {
  const refs = mediaRefs(block)
  if (!refs.length)
    return null

  let target: MediaRef | undefined
  if (current) {
    const name = fileName(current)
    const same = refs.filter(ref => fileName(ref.url) === name)
    if (same.length === 1)
      target = same[0]
    else if (same.length > 1)
      return null
  }
  if (!target && refs.length === 1)
    target = refs[0]
  if (!target)
    return null

  return block.slice(0, target.from) + next + block.slice(target.to)
}

/**
 * The media path the selected element renders: its own `src` when it is an
 * image or a video, or the one image or video it holds when it is a wrapper.
 * Null when the selection is not about a single picture.
 */
export function selectedMediaUrl(el: Element | null | undefined): string | null {
  if (!el)
    return null
  const tag = el.tagName.toLowerCase()
  if (tag === 'img' || tag === 'video' || tag === 'source')
    return el.getAttribute('src') || (el.querySelector('source')?.getAttribute('src') ?? null)
  const inner = el.querySelectorAll('img, video')
  if (inner.length !== 1)
    return null
  const media = inner[0]
  return media.getAttribute('src') || (media.querySelector('source')?.getAttribute('src') ?? null)
}
