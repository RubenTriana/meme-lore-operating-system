import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const queues = new Map<string, Promise<unknown>>()

export class EditorialError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

export function jsonRevision(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

export async function readJsonDocument<T>(path: string) {
  const text = await readFile(path, 'utf8')
  return { document: JSON.parse(text) as T, revision: jsonRevision(text) }
}

// All local canon writers share this queue, including the existing beat editor.
export async function updateJsonDocument<T>(
  path: string,
  transform: (document: unknown, revision: string) => T,
) {
  const persist = async () => {
    const { document, revision } = await readJsonDocument<unknown>(path)
    const next = transform(document, revision)
    const text = `${JSON.stringify(next, null, 2)}\n`
    const backupDirectory = join(dirname(path), 'editorial-backups')
    const suffix = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
    const backupPath = join(backupDirectory, `${basename(path, '.json')}-${suffix}.json`)
    const temporaryPath = `${path}.${randomUUID()}.tmp`
    await mkdir(backupDirectory, { recursive: true })
    try {
      await writeFile(temporaryPath, text, { encoding: 'utf8', flag: 'wx' })
      await copyFile(path, backupPath)
      if (jsonRevision(await readFile(path, 'utf8')) !== revision) {
        throw new EditorialError(
          'El archivo cambió durante el guardado. Recarga y vuelve a intentarlo.',
          409,
        )
      }
      await rename(temporaryPath, path)
    } finally {
      await rm(temporaryPath, { force: true })
    }
    return { document: next, revision: jsonRevision(text), backup: basename(backupPath) }
  }
  const queued = (queues.get(path) ?? Promise.resolve()).then(persist, persist)
  queues.set(
    path,
    queued.then(
      () => undefined,
      () => undefined,
    ),
  )
  return queued
}
