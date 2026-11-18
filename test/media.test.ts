import { describe, expect, it } from 'vitest'
import { mediaRefs, replaceMediaSource } from '../client/md/media'

describe('replacing the file an image shows', () => {
  it('swaps the path of an image in a sized wrapper and keeps the wrapper', () => {
    const block = '    <div class="h-[190px] flex items-center"><img src="/shared/intro/drone.png" alt="Nano-drone" class="max-h-[160px] w-auto" /></div>'
    expect(replaceMediaSource(block, '/shared/intro/cube.png', '/shared/intro/drone.png')).toBe(
      '    <div class="h-[190px] flex items-center"><img src="/shared/intro/cube.png" alt="Nano-drone" class="max-h-[160px] w-auto" /></div>',
    )
  })

  it('swaps the target of a Markdown image and keeps its alt text', () => {
    expect(replaceMediaSource('![A drone in flight](/drone.png)', '/cube.png', '/drone.png'))
      .toBe('![A drone in flight](/cube.png)')
  })

  it('swaps a component src prop, written across lines', () => {
    const block = '<MediaFigure\n  src="/shared/intro/tank.jpg"\n  alt="Tank"\n/>'
    expect(replaceMediaSource(block, '/shared/intro/pipes.jpg', '/shared/intro/tank.jpg'))
      .toBe('<MediaFigure\n  src="/shared/intro/pipes.jpg"\n  alt="Tank"\n/>')
  })

  it('matches the rendered URL to the written one by file name', () => {
    const block = '<img src="./assets/My%20Photo.png" />'
    expect(replaceMediaSource(block, '/new.png', 'http://localhost:3030/@fs/deck/assets/My Photo.png'))
      .toBe('<img src="/new.png" />')
  })

  it('picks the selected image when the block holds two', () => {
    const block = '<img src="/a.png" /> <img src="/b.png" />'
    expect(replaceMediaSource(block, '/c.png', '/b.png')).toBe('<img src="/a.png" /> <img src="/c.png" />')
  })

  it('refuses when two images share the selected file name', () => {
    const block = '<img src="/one/x.png" /> <img src="/two/x.png" />'
    expect(replaceMediaSource(block, '/c.png', '/x.png')).toBeNull()
  })

  it('refuses when nothing matches and the block holds more than one image', () => {
    expect(replaceMediaSource('<img src="/a.png" /> <img src="/b.png" />', '/c.png', '/z.png')).toBeNull()
  })

  it('replaces the only image of the block when the rendered URL cannot be matched', () => {
    expect(replaceMediaSource('<img src="/a.png" />', '/c.png', '/assets/a-3f9c1b.png')).toBe('<img src="/c.png" />')
  })

  it('returns null for a block without media', () => {
    expect(replaceMediaSource('Just text.', '/c.png', '/a.png')).toBeNull()
  })

  it('does not treat a non-media src as an image', () => {
    expect(mediaRefs('<iframe src="https://example.com/embed"></iframe><img src="/a.webp" />').map(r => r.url))
      .toEqual(['/a.webp'])
  })
})
