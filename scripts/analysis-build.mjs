import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultInputPath = resolve(projectRoot, 'data/universe_master.json')
const defaultOutputDirectory = resolve(projectRoot, 'data/derived')

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
