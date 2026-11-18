import { describe, expect, it } from 'vitest'
import { replaceInnerHtml, stripStudioAttrs } from '../client/md/html'

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
