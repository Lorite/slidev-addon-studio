import type { ResolvedSlidevOptions } from '@slidev/types'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listAssets } from '../node/assets'

/**
 * Decks often share media through a symlinked folder inside `public/`, for
 * example `public/shared -> ../../shared/assets`. The drawer has to list those
 * files under the URL the browser requests, and survive the links it cannot
 * follow.
 */
describe('listAssets', () => {
  let base: string
  let deck: string
  const options = () => ({ userRoot: deck }) as unknown as ResolvedSlidevOptions

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'studio-assets-'))
    deck = join(base, 'deck')
    await mkdir(join(deck, 'public', 'own'), { recursive: true })
    await writeFile(join(deck, 'public', 'own', 'logo.png'), 'png')
    await writeFile(join(deck, 'public', 'notes.txt'), 'not media')

    await mkdir(join(base, 'shared', 'intro'), { recursive: true })
    await writeFile(join(base, 'shared', 'intro', 'drone.png'), 'png')
    await writeFile(join(base, 'shared', 'clip.mp4'), 'mp4')
  })

  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  it('lists files inside a symlinked folder under their public URL', async () => {
    await symlink(join(base, 'shared'), join(deck, 'public', 'shared'))
    const urls = (await listAssets(options())).map(a => a.url).sort()
    expect(urls).toEqual(['/own/logo.png', '/shared/clip.mp4', '/shared/intro/drone.png'])
  })

  it('lists a symlinked file', async () => {
    await symlink(join(base, 'shared', 'intro', 'drone.png'), join(deck, 'public', 'drone-link.png'))
    const urls = (await listAssets(options())).map(a => a.url)
    expect(urls).toContain('/drone-link.png')
  })

  it('skips a dangling link instead of failing', async () => {
    await symlink(join(base, 'missing'), join(deck, 'public', 'gone'))
    const urls = (await listAssets(options())).map(a => a.url)
    expect(urls).toEqual(['/own/logo.png'])
  })

  it('does not loop on a link back up the tree', async () => {
    await symlink(join(deck, 'public'), join(deck, 'public', 'own', 'loop'))
    const urls = (await listAssets(options())).map(a => a.url)
    expect(urls).toEqual(['/own/logo.png'])
  })

  it('returns nothing when the deck has no public folder', async () => {
    await rm(join(deck, 'public'), { recursive: true })
    expect(await listAssets(options())).toEqual([])
  })
})
