import { describe, expect, it } from 'vitest'
import { patchChangedLeaves, replaceInnerHtml, stripStudioAttrs, textLeaves } from '../client/md/html'

describe('replacing the words inside raw HTML', () => {
  it('keeps the tag and every attribute', () => {
    const block = '<p class="opacity-80 mb-3">Pentester på jobb.</p>'
    expect(replaceInnerHtml(block, 'p', 'Pentester på jobb.', 'Noe helt annet.')).toBe(
      '<p class="opacity-80 mb-3">Noe helt annet.</p>',
    )
  })

  it('finds the one element inside a larger block and leaves the rest alone', () => {
    const block = [
      '<div class="h-full grid grid-cols-2 gap-8">',
      '  <h2 class="text-2xl">Overskrift</h2>',
      '  <p class="opacity-80 mb-3">Pentester på jobb.</p>',
      '</div>',
    ].join('\n')
    const next = replaceInnerHtml(block, 'p', 'Pentester på jobb.', 'Ny tekst.')
    expect(next).toBe([
      '<div class="h-full grid grid-cols-2 gap-8">',
      '  <h2 class="text-2xl">Overskrift</h2>',
      '  <p class="opacity-80 mb-3">Ny tekst.</p>',
      '</div>',
    ].join('\n'))
  })

  it('keeps inline markup that was written as HTML', () => {
    const block = '<p>Helt <b>vanlig</b> tekst.</p>'
    expect(replaceInnerHtml(block, 'p', 'Helt vanlig tekst.', 'Helt <b>uvanlig</b> tekst.')).toBe(
      '<p>Helt <b>uvanlig</b> tekst.</p>',
    )
  })

  it('matches across the line breaks the source happens to have', () => {
    const block = '<p class="x">Om betalingsterminaler bak disken,\n   heiser på vei opp.</p>'
    expect(replaceInnerHtml(block, 'p', 'Om betalingsterminaler bak disken, heiser på vei opp.', 'Kort.'))
      .toBe('<p class="x">Kort.</p>')
  })

  it('refuses when the same words appear twice, because either could be meant', () => {
    const block = '<div><p>Samme</p><p>Samme</p></div>'
    expect(replaceInnerHtml(block, 'p', 'Samme', 'Ulik')).toBeNull()
  })

  it('edits the innermost element when a wrapper of the same tag holds the same words', () => {
    const block = '<div><div>Indre</div></div>'
    expect(replaceInnerHtml(block, 'div', 'Indre', 'Noe')).toBe('<div><div>Noe</div></div>')
  })

  it('edits one line of a hand-made card nested in a grid, byte for byte elsewhere', () => {
    const block = [
      '<div class="grid grid-cols-2 gap-6">',
      '  <div class="flex flex-col items-center">',
      '    <div class="h-[190px]"><img src="/a.png" alt="A" /></div>',
      '    <div class="text-lg font-bold mt-1">Quadruped with an arm</div>',
      '    <div class="text-sm opacity-70">Sensors, computer, map</div>',
      '  </div>',
      '  <div class="flex flex-col items-center">',
      '    <div class="text-lg font-bold mt-1">Nano-drone</div>',
      '    <div class="text-sm opacity-70">Small, safe, IMU only</div>',
      '  </div>',
      '</div>',
    ].join('\n')
    const next = replaceInnerHtml(block, 'div', 'Small, safe, IMU only', 'Small, safe, only an IMU')
    expect(next).toBe(block.replace('Small, safe, IMU only', 'Small, safe, only an IMU'))
  })

  it('still refuses two separate nested elements with the same words', () => {
    const block = '<div><div><div>Samme</div></div><div><div>Samme</div></div></div>'
    expect(replaceInnerHtml(block, 'div', 'Samme', 'Ulik')).toBeNull()
  })

  it('refuses a block whose tags do not pair up', () => {
    expect(replaceInnerHtml('<div><div>Halv</div>', 'div', 'Halv', 'Hel')).toBeNull()
    expect(replaceInnerHtml('<div>Halv</div></div>', 'div', 'Halv', 'Hel')).toBeNull()
  })

  it('skips a self-closing tag of the same name', () => {
    const block = '<div class="spacer" /><div class="x">Tekst</div>'
    expect(replaceInnerHtml(block, 'div', 'Tekst', 'Ny')).toBe('<div class="spacer" /><div class="x">Ny</div>')
  })

  it('ignores the annotations Studio puts on the page', () => {
    expect(stripStudioAttrs('<p data-studio-src="1,2" class="x" data-studio-kind="html">Hei</p>'))
      .toBe('<p class="x">Hei</p>')
  })
})

describe('writing back only the lines that changed', () => {
  // A DOM-shaped node: enough for the walk, without a browser.
  const node = (tagName: string, children: any[] = [], text = ''): any => ({
    tagName: tagName.toUpperCase(),
    children,
    get textContent() {
      return children.length ? children.map((c: any) => c.textContent).join(' ') : text
    },
    get innerHTML() {
      return children.length ? children.map((c: any) => `<${c.tagName.toLowerCase()}>${c.innerHTML}</${c.tagName.toLowerCase()}>`).join('') : text
    },
  })

  const block = [
    '  <div class="flex flex-col items-center">',
    '    <div class="h-[190px]"><img src="/drone.png" alt="Drone" /></div>',
    '    <div class="text-lg font-bold mt-1">Nano-drone</div>',
    '    <div class="text-sm opacity-70">Small, safe, IMU only</div>',
    '  </div>',
  ].join('\n')

  const card = (subtitle: string) => node('div', [
    node('div', [node('img')]),
    node('div', [], 'Nano-drone'),
    node('div', [], subtitle),
  ])

  it('finds one leaf per line of text and skips the image box', () => {
    expect(textLeaves(card('Small, safe, IMU only')).map(l => l.text)).toEqual(['Nano-drone', 'Small, safe, IMU only'])
  })

  it('patches only the changed line and keeps the card byte for byte', () => {
    const before = textLeaves(card('Small, safe, IMU only'))
    const after = textLeaves(card('Small, safe, only an IMU'))
    expect(patchChangedLeaves(block, before, after)).toBe(block.replace('Small, safe, IMU only', 'Small, safe, only an IMU'))
  })

  it('keeps inline markup typed into a line', () => {
    const before = textLeaves(card('Small, safe, IMU only'))
    const after = textLeaves(node('div', [node('div', [node('img')]), node('div', [], 'Nano-drone'), node('div', [node('b', [], 'Small')])]))
    expect(patchChangedLeaves(block, before, after)).toContain('<div class="text-sm opacity-70"><b>Small</b></div>')
  })

  it('gives up when a line was added, so the caller writes the element whole', () => {
    const before = textLeaves(card('Small, safe, IMU only'))
    const after = textLeaves(node('div', [node('div', [node('img')]), node('div', [], 'Nano-drone'), node('div', [], 'Small'), node('div', [], 'New line')]))
    expect(patchChangedLeaves(block, before, after)).toBeNull()
  })
})

