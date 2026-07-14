import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultInputPath = resolve(projectRoot, 'data/universe_master.json')
const defaultOutputDirectory = resolve(projectRoot, 'data/derived')
const expectedArtifactFiles = ['entity-index.json', 'relation-graph.json', 'timeline-index.json', 'knowledge-index.json', 'dependency-index.json', 'manifest.json']

function formatValidationErrors(errors) {
  return errors.map((error) => `${error.path}: ${error.message}`).join('\n')
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, filePath)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export async function writeDerivedArtifacts(outputDirectory, compilation, derivedArtifacts) {
  const artifacts = derivedArtifacts(compilation)
  await mkdir(outputDirectory, { recursive: true })
  const entries = Object.entries(artifacts).sort(([left], [right]) => {
    if (left === 'manifest.json') return 1
    if (right === 'manifest.json') return -1
    return left.localeCompare(right)
  })
  for (const [fileName, artifact] of entries) {
    await writeJsonAtomic(resolve(outputDirectory, fileName), artifact)
  }
  return entries.map(([fileName]) => fileName)
}

export async function verifyDerivedArtifactSet(outputDirectory) {
  const artifacts = new Map()
  const errors = []
  for (const fileName of expectedArtifactFiles) {
    try { artifacts.set(fileName, JSON.parse(await readFile(resolve(outputDirectory, fileName), 'utf8'))) }
    catch (error) { errors.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  const manifestMetadata = artifacts.get('manifest.json')?.metadata
  if (!manifestMetadata?.sourceHash || !manifestMetadata?.schemaVersion || !manifestMetadata?.engineVersion) errors.push('manifest.json: missing derived identity metadata')
  artifacts.forEach((artifact, fileName) => {
    if (fileName === 'manifest.json' || !manifestMetadata) return
    const metadata = artifact?.metadata
    if (metadata?.sourceHash !== manifestMetadata.sourceHash || metadata?.schemaVersion !== manifestMetadata.schemaVersion || metadata?.engineVersion !== manifestMetadata.engineVersion) errors.push(`${fileName}: metadata does not match manifest.json`)
  })
  return { valid: errors.length === 0, errors }
}

export async function runAnalysisBuild({ inputPath = defaultInputPath, outputDirectory = defaultOutputDirectory, generatedAt } = {}) {
  const rawCanon = JSON.parse(await readFile(inputPath, 'utf8'))
  const vite = await createServer({
    root: projectRoot,
    configFile: false,
    appType: 'custom',
    logLevel: 'error',
    resolve: { alias: { '@': resolve(projectRoot, 'src') } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
  })
  try {
    const { migrateUniverse } = await vite.ssrLoadModule('/src/services/migrations/index.ts')
    const { validateUniverse } = await vite.ssrLoadModule('/src/schemas/universe.ts')
    const { compileDerived, derivedArtifacts } = await vite.ssrLoadModule('/src/analysis/derived.ts')
    const migrated = migrateUniverse(rawCanon)
    const validation = validateUniverse(migrated.data)
    if (!validation.valid || !validation.data) throw new Error(`Canon validation failed.\n${formatValidationErrors(validation.errors)}`)
    const compilation = compileDerived(validation.data, generatedAt ? { generatedAt } : undefined)
    const files = await writeDerivedArtifacts(outputDirectory, compilation, derivedArtifacts)
    const verification = await verifyDerivedArtifactSet(outputDirectory)
    if (!verification.valid) throw new Error(`Derived artifact verification failed.\n${verification.errors.join('\n')}`)
    return { ...compilation.metadata, files, outputDirectory, migrations: migrated.applied.map((migration) => migration.id) }
  } finally {
    await vite.close()
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const inputPath = resolve(projectRoot, argumentValue('--input') ?? 'data/universe_master.json')
  const outputDirectory = resolve(projectRoot, argumentValue('--output') ?? 'data/derived')
  runAnalysisBuild({ inputPath, outputDirectory, generatedAt: argumentValue('--generated-at') })
    .then((result) => console.log(`Derived analysis built: ${result.sourceHash} (${result.files.length} files)`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
