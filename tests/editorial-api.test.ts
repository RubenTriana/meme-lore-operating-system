// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createServer, type ViteDevServer } from 'vite'
import master from '../data/universe_master.json'
import progressSource from '../data/writing_progress.json'
import { editorialPlugin } from '../vite-editorial-plugin'
import { timelineDraft } from '../src/timeline/editing'
import { validateUniverse } from '../src/schemas/universe'
import type { Universe } from '../src/types/universe'

const source = master as Universe
const item = source.modules
  .find((module) => module.id === 'timeline')!
  .content.items!.find((entry) => entry.id === 'meme-n1-escena-08')!

describe('local editorial persistence', () => {
  let root: string
  let server: ViteDevServer
  let url: string
  const patch = (path: string, payload: unknown, origin?: string) =>
    fetch(`${url}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(payload),
    })
  const readMaster = async () =>
    JSON.parse(await readFile(join(root, 'data/universe_master.json'), 'utf8')) as Universe

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'meme-editorial-test-'))
    await mkdir(join(root, 'data'))
    await writeFile(join(root, 'data/universe_master.json'), JSON.stringify(source))
    await writeFile(
      join(root, 'data/writing_progress.json'),
      JSON.stringify({
        ...progressSource,
        snapshots: [{ date: '2000-01-01', words: 1000, label: 'Original' }],
      }),
    )
    server = await createServer({
      configFile: false,
      root,
      logLevel: 'silent',
      plugins: [editorialPlugin(root)],
      server: { host: '127.0.0.1', port: 0 },
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    await server.listen()
    url = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await server?.close()
    if (
      root &&
      dirname(resolve(root)) === resolve(tmpdir()) &&
      basename(root).startsWith('meme-editorial-test-')
    ) {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('persists an edit, preserves other fields and serves it again after a fresh read', async () => {
    const response = await patch('/api/canon/timeline-unit', {
      action: 'edit',
      id: item.id,
      expectedUpdated: source.metadata.updated,
      draft: {
        ...timelineDraft(item),
        title: '8 — Título editado',
        summary: 'Contenido revisado por el autor.',
      },
    })
    expect(response.status).toBe(200)
    const disk = await readMaster()
    const saved = disk.modules
      .find((module) => module.id === 'timeline')!
      .content.items!.find((entry) => entry.id === item.id)!
    expect(saved.title).toBe('8 — Título editado')
    expect(saved.summary).toBe('Contenido revisado por el autor.')
    expect(saved.refs).toEqual(item.refs)
    expect(saved.novelRef).toBe(item.novelRef)
    expect(saved.canonStatus).toBe(item.canonStatus)
    expect(saved.approvalRef).toBe(item.approvalRef)
    expect(disk.modules.find((module) => module.id === 'characters')).toEqual(
      source.modules.find((module) => module.id === 'characters'),
    )
    expect(validateUniverse(disk).valid).toBe(true)
    expect((await (await fetch(`${url}/api/canon/universe`)).json()).universe).toEqual(disk)
    const backups = await readdir(join(root, 'data/editorial-backups'))
    expect(backups).toHaveLength(1)
    expect(
      JSON.parse(await readFile(join(root, 'data/editorial-backups', backups[0]), 'utf8')),
    ).toEqual(source)
  })

  it('deletes a unit and its incoming links without breaking the universe', async () => {
    const response = await patch('/api/canon/timeline-unit', {
      action: 'delete',
      id: item.id,
      expectedUpdated: source.metadata.updated,
    })
    expect(response.status).toBe(200)
    const disk = await readMaster()
    const items = disk.modules.find((module) => module.id === 'timeline')!.content.items!
    expect(items.some((entry) => entry.id === item.id)).toBe(false)
    expect(items).toHaveLength(
      source.modules.find((module) => module.id === 'timeline')!.content.items!.length - 1,
    )
    expect(validateUniverse(disk).valid).toBe(true)
    for (const entry of disk.modules.flatMap((module) => module.content.items ?? [])) {
      for (const references of [entry.refs, entry.effects, entry.causedByRefs])
        expect(references ?? []).not.toContain(item.id)
    }
  })

  it('rejects invalid edits, foreign origins and stale saves without changing the original', async () => {
    const change = {
      action: 'edit',
      id: item.id,
      expectedUpdated: source.metadata.updated,
      draft: timelineDraft(item),
    }
    expect(
      (
        await patch('/api/canon/timeline-unit', {
          ...change,
          draft: { ...change.draft, title: ' ' },
        })
      ).status,
    ).toBe(400)
    expect(
      (await patch('/api/canon/timeline-unit', change, 'https://foreign.example')).status,
    ).toBe(403)
    expect(
      (
        await patch('/api/canon/timeline-unit', {
          ...change,
          expectedUpdated: '2000-01-01T00:00:00.000Z',
        })
      ).status,
    ).toBe(409)
    expect(await readMaster()).toEqual(source)
  })

  it('serializes concurrent saves so a stale editor cannot overwrite a successful one', async () => {
    const change = {
      action: 'edit',
      id: item.id,
      expectedUpdated: source.metadata.updated,
      draft: timelineDraft(item),
    }
    const responses = await Promise.all([
      patch('/api/canon/timeline-unit', {
        ...change,
        draft: { ...change.draft, summary: 'Versión A' },
      }),
      patch('/api/canon/timeline-unit', {
        ...change,
        draft: { ...change.draft, summary: 'Versión B' },
      }),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    expect(validateUniverse(await readMaster()).valid).toBe(true)
  })

  it('persists word totals and updates the same day once while detecting conflicts', async () => {
    const initial = await (await fetch(`${url}/api/writing-progress`)).json()
    const firstResponse = await patch('/api/writing-progress', {
      words: 11000,
      expectedRevision: initial.revision,
    })
    expect(firstResponse.status).toBe(200)
    const saved = await firstResponse.json()
    expect(saved.progress.forecast.editorialTargetWords).toBe(110000)
    expect(
      (await patch('/api/writing-progress', { words: 12000, expectedRevision: initial.revision }))
        .status,
    ).toBe(409)
    expect(
      (await patch('/api/writing-progress', { words: -1, expectedRevision: saved.revision }))
        .status,
    ).toBe(400)
    expect(
      (await patch('/api/writing-progress', { words: 12000, expectedRevision: saved.revision }))
        .status,
    ).toBe(200)
    const disk = JSON.parse(await readFile(join(root, 'data/writing_progress.json'), 'utf8'))
    expect(disk.snapshots).toHaveLength(2)
    expect(disk.snapshots.at(-1).words).toBe(12000)
    expect((await (await fetch(`${url}/api/writing-progress`)).json()).progress).toEqual(disk)
  })
})
