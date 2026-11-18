/**
 * Editing the text inside raw HTML, without disturbing the HTML.
 *
 * A deck written by hand is full of markup Markdown has no syntax for: a
 * paragraph carrying utility classes, a grid of divs, a span holding one styled
 * word. Studio refused all of it, because writing such a block back through the
 * Markdown serialiser would return the text and drop the tag and its attributes
 * with it. That is the right instinct and the wrong conclusion: the words can be
 * replaced where they sit, and everything around them left exactly as it was.
 *
 * The element is found by the text it currently holds rather than by counting
 * tags, because that is the one thing the rendered page and the source agree on
 * without a parser. If the same words appear in two separate elements of the
 * block there is no way to tell which was meant, so nothing is written.
 */

/** Whitespace differs between source and DOM; meaning does not. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The words an element shows, with the markup between them taken out.
 *
 * The element is found by its text because that is what the source and the
 * rendered page agree on: the source may say `Helt <b>vanlig</b> tekst`, the
 * page reports `Helt vanlig tekst`, and comparing the two as written would
 * never match anything containing inline markup.
 */
function textOf(html: string): string {
  return collapse(stripStudioAttrs(html).replace(/<[^>]*>/g, ''))
}

/** The annotations Studio adds to the rendered page are not part of the deck. */
export function stripStudioAttrs(html: string): string {
  return html.replace(/\s+data-studio-[\w-]+="[^"]*"/g, '')
}

interface Span {
  /** Where the element's inner content starts and ends in the block. */
  from: number
  to: number
}

/**
 * Every `<tag …>…</tag>` in a block, nested ones included.
 *
 * Opening and closing tags are paired with a stack, the way the browser pairs
 * them, so a `<div>` inside a `<div>` is read rather than refused: a hand-made
 * card is a `<div>` of `<div>` lines inside a grid `<div>`, and refusing every
 * such block sent its edits to a path that rewrites the whole container.
 * Self-closing tags (`<tag />`) hold no text and are skipped. A block whose
 * tags do not pair up is refused.
 */
function spansOf(block: string, tag: string): Span[] | null {
  const tokens = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi')
  const stack: number[] = []
  const spans: Span[] = []
  for (const m of block.matchAll(tokens)) {
    const [whole, closing, selfClosing] = m
    if (closing) {
      const from = stack.pop()
      if (from === undefined)
        return null
      spans.push({ from, to: m.index! })
    }
    else if (!selfClosing) {
      stack.push(m.index! + whole.length)
    }
  }
  if (stack.length || !spans.length)
    return null
  return spans
}

/** Whether `outer` holds `inner` inside it. */
function contains(outer: Span, inner: Span): boolean {
  return outer !== inner && outer.from <= inner.from && inner.to <= outer.to
}

/**
 * Replaces the words inside one element of a block.
 *
 * `current` is what the element holds now, used to find it. `next` is HTML,
 * not Markdown: the block is raw HTML, and Markdown written inside one is not
 * processed, so what goes back in has to be what the browser will render.
 *
 * Returns null when the element cannot be found exactly once, which leaves the
 * caller to fall back to editing the block as text.
 */
export function replaceInnerHtml(
  block: string,
  tag: string,
  current: string,
  next: string,
): string | null {
  const spans = spansOf(block, tag.toLowerCase())
  if (!spans)
    return null

  const wanted = collapse(current)
  const matching = spans.filter(span => textOf(block.slice(span.from, span.to)) === wanted)
  // A wrapper whose only words are those of the element inside it matches too.
  // The innermost one is the element the page reported, and replacing its
  // content keeps every wrapper and its attributes. Two separate elements with
  // the same words are still refused: either could be meant.
  const found = matching.filter(span => !matching.some(other => contains(span, other)))
  if (found.length !== 1)
    return null

  const { from, to } = found[0]
  return block.slice(0, from) + next + block.slice(to)
}
