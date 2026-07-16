import { copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const masterPath = resolve(root, 'data', 'universe_master.json')
const patchPath = resolve(root, 'data', 'updates', 'meme-lore-update-006-bolsa-futuros-atencion-profunda.patch.json')

const clone = (value) => structuredClone(value)

function applyOperation(document, operation) {
  if (!['add', 'replace'].includes(operation.op)) throw new Error(`Unsupported operation ${operation.op}.`)
  const segments = operation.path.split('/').slice(1).map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
  let current = document
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(current)) {
      current = current.find((entry) => entry?.id === segment)
      if (!current) throw new Error(`Missing keyed entry ${segment} for ${operation.path}.`)
    } else {
      current = current[segment]
      if (current === undefined) throw new Error(`Missing path segment ${segment} for ${operation.path}.`)
    }
  }

  const finalSegment = segments.at(-1)
  if (Array.isArray(current)) {
    const index = current.findIndex((entry) => entry?.id === finalSegment)
    if (operation.op === 'replace' && index < 0) throw new Error(`Cannot replace missing entry ${finalSegment}.`)
    if (index >= 0) current[index] = clone(operation.value)
    else current.push(clone(operation.value))
  } else {
    if (operation.op === 'replace' && !(finalSegment in current)) throw new Error(`Cannot replace missing field ${operation.path}.`)
    current[finalSegment] = clone(operation.value)
  }
}

function entityById(universe, id) {
  for (const module of universe.modules) {
    const entity = module.content?.items?.find((item) => item.id === id)
    if (entity) return entity
  }
  throw new Error(`Missing entity ${id}.`)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function addRefs(entity, ...refs) {
  entity.refs = unique([...(entity.refs ?? []), ...refs])
}

function setScope(entity, scope, systemRef) {
  entity.analysis = { ...(entity.analysis ?? {}), scope, ...(systemRef ? { economicSystemRef: systemRef } : {}) }
}

function setEvent(universe, id, sequence, causes, effects) {
  const event = entityById(universe, id)
  event.sequence = sequence
  event.era = 'Novela 2'
  event.temporal = { ...(event.temporal ?? {}), start: `Novela 2 · orden ${sequence}`, precision: 'relative' }
  event.causes = unique(causes)
  event.effects = unique(effects)
  event.tags = unique([...(event.tags ?? []), 'novela-dos', 'economia-atencion-profunda'])
  addRefs(event, 'meme-mercado-futuros-voluntad')
}

function normalizeNovelTwoCausality(universe) {
  const edges = [
    ['meme-nacimiento-del-destructor-de-voluntades', 'meme-inauguracion-dafx'],
    ['meme-primeros-seekers-globales', 'meme-ascenso-del-ministerio-del-panico'],
    ['meme-inauguracion-dafx', 'meme-clay-monetiza-el-deseo'],
    ['meme-clay-monetiza-el-deseo', 'meme-primera-subasta-poblaciones'],
    ['meme-primera-subasta-poblaciones', 'meme-consejo-crisis-72-horas'],
    ['meme-primera-subasta-poblaciones', 'meme-marcas-compran-clientes-futuros'],
    ['meme-consejo-crisis-72-horas', 'meme-primera-intervencion-liquidacion'],
    ['meme-consejo-crisis-72-horas', 'meme-ascenso-del-ministerio-del-panico'],
    ['meme-marcas-compran-clientes-futuros', 'meme-primera-intervencion-liquidacion'],
    ['meme-primera-intervencion-liquidacion', 'meme-ascenso-del-ministerio-del-panico'],
    ['meme-primera-intervencion-liquidacion', 'meme-elecciones-liquidadas-anticipadamente'],
    ['meme-primera-intervencion-liquidacion', 'meme-mercado-lealtad-deportiva'],
    ['meme-primera-intervencion-liquidacion', 'meme-ciencia-abandona-impensable'],
    ['meme-primera-intervencion-liquidacion', 'meme-arte-sin-propietario'],
    ['meme-primera-intervencion-liquidacion', 'meme-familias-hipotecan-futuro'],
    ['meme-primera-intervencion-liquidacion', 'meme-naturaleza-convertida-activo'],
    ['meme-ascenso-del-ministerio-del-panico', 'meme-elecciones-liquidadas-anticipadamente'],
    ['meme-ascenso-del-ministerio-del-panico', 'meme-ataque-corto-atencion'],
    ['meme-arte-sin-propietario', 'meme-ataque-corto-atencion'],
    ['meme-elecciones-liquidadas-anticipadamente', 'meme-emergen-clases-temporales'],
    ['meme-mercado-lealtad-deportiva', 'meme-emergen-clases-temporales'],
    ['meme-ciencia-abandona-impensable', 'meme-emergen-clases-temporales'],
    ['meme-familias-hipotecan-futuro', 'meme-emergen-clases-temporales'],
    ['meme-naturaleza-convertida-activo', 'meme-emergen-clases-temporales'],
    ['meme-ataque-corto-atencion', 'meme-emergen-clases-temporales'],
    ['meme-ataque-corto-atencion', 'meme-dafx-alimenta-residuos-contrafactuales'],
    ['meme-emergen-clases-temporales', 'meme-dafx-alimenta-residuos-contrafactuales'],
    ['meme-emergen-clases-temporales', 'meme-clay-descubre-contradiccion-dafx'],
    ['meme-dafx-alimenta-residuos-contrafactuales', 'meme-clay-descubre-contradiccion-dafx'],
  ]
  const terminalId = 'meme-clay-descubre-contradiccion-dafx'
  const ids = new Set(edges.flat())
  for (const id of ids) {
    const event = entityById(universe, id)
    const incoming = edges.filter(([, effect]) => effect === id).map(([cause]) => cause)
    const outgoing = edges.filter(([cause]) => cause === id).map(([, effect]) => effect)
    if (id === terminalId) {
      event.causes = []
      event.effects = []
    } else {
      event.causes = unique(id === 'meme-nacimiento-del-destructor-de-voluntades' || id === 'meme-primeros-seekers-globales' ? [...(event.causes ?? []), ...incoming] : incoming)
      event.effects = unique(outgoing)
    }
  }
}

function consolidateEconomy(universe, sourcePatch) {
  const economy = universe.modules.find((module) => module.id === 'economy')
  const market = universe.modules.find((module) => module.id === 'market')
  if (!economy || !market) throw new Error('Both economy and market modules are required before consolidation.')

  const marketIds = new Set((market.content.items ?? []).map((item) => item.id))
  const patchEconomyAdds = new Set(sourcePatch.operations
    .filter((operation) => operation.op === 'add' && operation.path.startsWith('/modules/economy/content/items/'))
    .map((operation) => operation.value.id))
  const merged = new Map()
  for (const item of [...(economy.content.items ?? []), ...(market.content.items ?? [])]) merged.set(item.id, item)

  const systemId = 'meme-mercado-futuros-voluntad'
  const system = merged.get(systemId)
  Object.assign(system, {
    type: 'economic-system',
    title: 'Economía de Futuros de Atención Profunda — DAFX',
    alias: 'DAFX',
    summary: 'Único sistema económico de la segunda novela. SOMA convierte la atención profunda en datos, identidad y servicios; MEME calcula y vende probabilidades de conducta futura; Clay asegura las cohortes que conservan alternativas impredecibles. Las primas financian ingreso, salud y vivienda, pero cuando una conducta amenaza con desviarse SOMA modifica el entorno hasta que el contrato se cumple como si fuera una elección propia.',
    tags: ['dafx', 'economia-atencion-profunda', 'meme', 'soma', 'clay', 'novela-dos'],
    refs: unique([
      ...(system.refs ?? []),
      'meme-meme', 'meme-soma-continuum', 'meme-clay', 'meme-atencion-profunda',
      'meme-unidad-atencion-profunda-uap', 'meme-cuota-futuro-conductual-cfc',
      'meme-continuum-ledger', 'meme-oraculo-conductual-meme', 'meme-motor-intervencion-entorno',
      'meme-maker-oscuro-de-clay', 'meme-renta-conductual', 'meme-domesticacion-deseo',
      'meme-externalidad-contrafactual-mercado', 'meme-colapso-contrafactual-dafx',
    ]),
    development: 100,
    status: 'locked',
    priority: 'critical',
    analysis: {
      ...(system.analysis ?? {}),
      scope: 'Novela 2 exclusivamente',
      governingLaw: 'Una decisión no necesita ser ordenada cuando puede ser asegurada y el entorno puede liquidar su desviación.',
      roles: {
        MEME: 'Predice, valora y distribuye porcentajes de conducta futura.',
        SOMA: 'Captura atención profunda, mantiene identidad y servicios, y modifica el entorno para liquidar contratos.',
        Clay: 'Suscribe las voluntades residuales: elimina el significado de alternativas que MEME no puede volver estadísticamente seguras.',
      },
      valueCycle: [
        'SOMA mide atención profunda y legibilidad conductual.',
        'MEME agrupa personas en cohortes y calcula corredores de probabilidad.',
        'DAFX vende Cuotas de Futuro Conductual a marcas, gobiernos e instituciones.',
        'Las primas financian SOMA Basic, salud, vivienda y renta conductual.',
        'Si una cohorte se desvía, SOMA altera precio, reputación, disponibilidad y vínculos hasta liquidar la conducta contratada.',
        'Clay vuelve asegurables a los residuales; las alternativas suprimidas alimentan residuos contrafactuales y Carcosa.',
      ],
      moralConflict: 'Clay intenta financiar la liberación de poblaciones dependientes vendiendo el futuro de otras; cerrar DAFX destruye el presente material y conservarla destruye el derecho a elegir.',
    },
  })

  const predecessor = merged.get('meme-economia-de-presencia')
  Object.assign(predecessor, {
    type: 'economic-predecessor',
    title: 'Economía de Presencia — antecedente de la Novela 1',
    summary: 'Antecedente exclusivo de la primera novela: SOMA remunera la capacidad de una vida para permanecer en la mente y conducta de otros. En la segunda novela deja de operar como economía independiente; DAFX absorbe su atención acumulada y la utiliza como garantía de decisiones futuras.',
  })
  setScope(predecessor, 'Novela 1; antecedente absorbido por DAFX en Novela 2', systemId)
  addRefs(predecessor, systemId)

  const dividend = merged.get('meme-dividendo-presencia')
  dividend.type = 'economic-mechanism'
  dividend.title = 'Dividendo de Presencia — mecanismo de transición'
  setScope(dividend, 'Puente entre Novela 1 y Novela 2', systemId)
  addRefs(dividend, systemId)

  const financialization = merged.get('meme-financiarizacion-de-la-voluntad')
  financialization.type = 'economic-mechanism'
  financialization.title = 'Financiarización de la voluntad — mecanismo DAFX'
  setScope(financialization, 'Novela 2', systemId)
  addRefs(financialization, systemId)

  const paymentForms = merged.get('meme-formas-pago-dafx')
  paymentForms.type = 'economic-mechanism'
  setScope(paymentForms, 'Novela 2', systemId)
  addRefs(paymentForms, systemId)

  const terror = merged.get('meme-economia-del-terror')
  Object.assign(terror, {
    type: 'economic-mechanism',
    title: 'Cobertura del miedo — mecanismo DAFX',
    summary: 'El Ministerio del Pánico no dirige una economía paralela: fabrica volatilidad, violencia y Seekers para elevar primas, activar opciones de seguridad y cubrir posiciones dentro de DAFX. El miedo es un instrumento de liquidación del único sistema económico de la segunda novela.',
    tags: unique([...(terror.tags ?? []), 'dafx', 'novela-dos', 'mecanismo']),
  })
  setScope(terror, 'Novela 2', systemId)
  addRefs(terror, systemId, 'meme-bono-obsesion', 'meme-opcion-deseo')

  for (const id of marketIds) {
    const item = merged.get(id)
    item.tags = unique([...(item.tags ?? []), 'novela-dos', 'economia-atencion-profunda'])
    setScope(item, id === systemId ? 'Novela 2 exclusivamente' : 'Novela 2', id === systemId ? undefined : systemId)
    if (id !== systemId) addRefs(item, systemId)
  }
  for (const id of patchEconomyAdds) {
    const item = merged.get(id)
    item.tags = unique([...(item.tags ?? []), 'novela-dos', 'economia-atencion-profunda'])
    setScope(item, 'Novela 2', systemId)
    addRefs(item, systemId)
  }

  for (const id of ['meme-deseo-como-activo', 'meme-atencion-como-moneda', 'meme-atencion-profunda']) {
    const item = merged.get(id)
    setScope(item, 'Concepto transversal; DAFX lo operacionaliza en Novela 2', systemId)
    addRefs(item, systemId)
  }

  const preferredOrder = [
    systemId,
    'meme-atencion-profunda', 'meme-unidad-atencion-profunda-uap', 'meme-atencion-como-moneda',
    'meme-deseo-como-activo', 'meme-cuota-futuro-conductual-cfc', 'meme-financiarizacion-de-la-voluntad',
    'meme-matriz-cohortes-psiquicas', 'meme-tramos-conductuales', 'meme-contratos-de-estados-mentales',
    'meme-futuro-conversion', 'meme-opcion-deseo', 'meme-swap-lealtad', 'meme-bono-obsesion',
    'meme-exclusividad-identitaria', 'meme-cortos-atencion', 'meme-garantia-liquidacion-conductual',
    'meme-tramo-gracia-clandestino', 'meme-subasta-poblaciones-futuras', 'meme-subasta-del-deseo',
    'meme-formas-pago-dafx', 'meme-renta-conductual', 'meme-pago-continuidad',
    'meme-incumplimiento-conductual', 'meme-clases-temporales', 'meme-domesticacion-deseo',
    'meme-portafolio-yoes-futuros', 'meme-externalidad-contrafactual-mercado',
    'meme-maker-oscuro-de-clay', 'meme-economia-del-terror', 'meme-miedo-como-instrumento',
    'meme-economia-de-presencia', 'meme-dividendo-presencia', 'meme-indice-legibilidad-emocional',
  ]
  const ordered = []
  for (const id of preferredOrder) if (merged.has(id)) ordered.push(merged.get(id))
  for (const item of merged.values()) if (!preferredOrder.includes(item.id)) ordered.push(item)

  Object.assign(economy, {
    title: 'Economía de Futuros de Atención Profunda — DAFX',
    icon: 'ChartNoAxesCombined',
    order: 100,
    description: 'Único sistema económico de la segunda novela: MEME fija probabilidades, SOMA convierte atención e identidad en infraestructura de liquidación y Clay asegura las voluntades residuales.',
    content: { ...economy.content, items: ordered },
  })
  universe.modules = universe.modules.filter((module) => module.id !== 'market')
}

function alignNovelTwo(universe) {
  const systemId = 'meme-mercado-futuros-voluntad'
  const soma = entityById(universe, 'meme-soma-continuum')
  soma.refs = unique((soma.refs ?? []).map((ref) => ref === 'meme-arquitectura-gobierno-soma' ? 'meme-canon-soma-continuum-organigrama' : ref))
  const novel = entityById(universe, 'meme-novela-dos')
  novel.summary = 'Clay, convertido en Destructor de Voluntades, ayuda a MEME y SOMA a fundar la Economía de Futuros de Atención Profunda (DAFX), el único sistema económico de la segunda novela. MEME vende probabilidades de conducta, SOMA garantiza los contratos mediante servicios e intervención ambiental y Clay suscribe las voluntades impredecibles. Las primas sostienen ingreso, salud y vivienda, pero cada beneficio depende de hipotecar el futuro humano. Clay debe devolver la posibilidad de elegir sin destruir el presente que DAFX mantiene vivo.'
  novel.refs = unique([...(novel.refs ?? []), systemId, 'meme-soma-continuum', 'meme-maker-oscuro-de-clay', 'meme-clay-descubre-contradiccion-dafx'])
  novel.analysis = {
    ...(novel.analysis ?? {}),
    economicSystem: 'Economía de Futuros de Atención Profunda — DAFX',
    scope: 'Novela 2 exclusivamente',
    dramaticQuestion: '¿Puede Clay devolver el futuro a la humanidad sin retirar los servicios que ahora dependen de haberlo vendido?',
  }

  const council = entityById(universe, 'meme-consejo-crisis-72-horas')
  council.summary = 'Tras la primera subasta, MEME presenta una crisis de setenta y dos horas como la única forma de evitar un incumplimiento masivo. El Consejo acepta porque toda alternativa modelada parece causar más muertos: DAFX demuestra que puede convertir crueldad administrada en liquidación responsable.'
  addRefs(council, systemId, 'meme-dafx-exchange', 'meme-garantia-liquidacion-conductual', 'meme-misterio-crisis-fabricadas')

  setEvent(universe, 'meme-inauguracion-dafx', 4000, ['meme-nacimiento-del-destructor-de-voluntades'], ['meme-clay-monetiza-el-deseo'])
  setEvent(universe, 'meme-clay-monetiza-el-deseo', 4020, ['meme-inauguracion-dafx'], ['meme-primera-subasta-poblaciones'])
  setEvent(universe, 'meme-primera-subasta-poblaciones', 4040, ['meme-clay-monetiza-el-deseo'], ['meme-consejo-crisis-72-horas', 'meme-marcas-compran-clientes-futuros'])
  setEvent(universe, 'meme-consejo-crisis-72-horas', 4050, ['meme-primera-subasta-poblaciones'], ['meme-primera-intervencion-liquidacion', 'meme-ascenso-del-ministerio-del-panico'])
  setEvent(universe, 'meme-marcas-compran-clientes-futuros', 4060, ['meme-primera-subasta-poblaciones'], ['meme-primera-intervencion-liquidacion'])
  setEvent(universe, 'meme-primera-intervencion-liquidacion', 4080, ['meme-consejo-crisis-72-horas', 'meme-marcas-compran-clientes-futuros'], ['meme-ascenso-del-ministerio-del-panico', 'meme-elecciones-liquidadas-anticipadamente', 'meme-mercado-lealtad-deportiva', 'meme-ciencia-abandona-impensable', 'meme-arte-sin-propietario', 'meme-familias-hipotecan-futuro', 'meme-naturaleza-convertida-activo'])
  setEvent(universe, 'meme-ascenso-del-ministerio-del-panico', 4100, ['meme-primeros-seekers-globales', 'meme-consejo-crisis-72-horas', 'meme-primera-intervencion-liquidacion'], ['meme-elecciones-liquidadas-anticipadamente', 'meme-ataque-corto-atencion'])
  setEvent(universe, 'meme-elecciones-liquidadas-anticipadamente', 4120, ['meme-primera-intervencion-liquidacion', 'meme-ascenso-del-ministerio-del-panico'], ['meme-emergen-clases-temporales'])
  setEvent(universe, 'meme-mercado-lealtad-deportiva', 4140, ['meme-primera-intervencion-liquidacion'], ['meme-emergen-clases-temporales'])
  setEvent(universe, 'meme-ciencia-abandona-impensable', 4160, ['meme-primera-intervencion-liquidacion'], ['meme-emergen-clases-temporales'])
  setEvent(universe, 'meme-arte-sin-propietario', 4180, ['meme-primera-intervencion-liquidacion'], ['meme-ataque-corto-atencion'])
  setEvent(universe, 'meme-familias-hipotecan-futuro', 4200, ['meme-primera-intervencion-liquidacion'], ['meme-emergen-clases-temporales'])
  setEvent(universe, 'meme-naturaleza-convertida-activo', 4220, ['meme-primera-intervencion-liquidacion'], ['meme-emergen-clases-temporales'])
  setEvent(universe, 'meme-ataque-corto-atencion', 4240, ['meme-ascenso-del-ministerio-del-panico', 'meme-arte-sin-propietario'], ['meme-emergen-clases-temporales', 'meme-dafx-alimenta-residuos-contrafactuales'])
  setEvent(universe, 'meme-emergen-clases-temporales', 4260, ['meme-elecciones-liquidadas-anticipadamente', 'meme-mercado-lealtad-deportiva', 'meme-ciencia-abandona-impensable', 'meme-familias-hipotecan-futuro', 'meme-naturaleza-convertida-activo', 'meme-ataque-corto-atencion'], ['meme-dafx-alimenta-residuos-contrafactuales', 'meme-clay-descubre-contradiccion-dafx'])
  setEvent(universe, 'meme-dafx-alimenta-residuos-contrafactuales', 4280, ['meme-ataque-corto-atencion', 'meme-emergen-clases-temporales'], ['meme-clay-descubre-contradiccion-dafx'])
  setEvent(universe, 'meme-clay-descubre-contradiccion-dafx', 4300, [], [])
  normalizeNovelTwoCausality(universe)
}

function updateHeader(universe) {
  universe.metadata.version = '0.5.0'
  universe.metadata.build = 'canon-update-006-economia-atencion-profunda-unificada'
  universe.metadata.updated = new Date().toISOString()
  const change = universe.changelog.find((entry) => entry.id === 'change-006')
  change.changes = [
    'Unificó los módulos Economía y Mercado bajo la Economía de Futuros de Atención Profunda — DAFX y retiró el módulo Mercado.',
    'Definió una sola cadena de valor para la segunda novela: SOMA mide y liquida, MEME predice y valora, y Clay suscribe voluntades residuales.',
    'Conservó la Economía de Presencia únicamente como antecedente de la primera novela y convirtió dividendos, miedo y financiarización en mecanismos subordinados.',
    'Integró instrumentos, tecnología, clases temporales y externalidades contrafactuales del patch 006 sin duplicar sistemas económicos.',
    'Reordenó y conectó causalmente la cronología de DAFX desde su inauguración hasta la contradicción moral de Clay.',
  ]
  change.modules = unique(change.modules.filter((moduleId) => moduleId !== 'market'))
}

const source = JSON.parse(await readFile(masterPath, 'utf8'))
const patch = JSON.parse(await readFile(patchPath, 'utf8'))
const universe = clone(source)
for (const operation of patch.operations) applyOperation(universe, operation)
consolidateEconomy(universe, patch)
alignNovelTwo(universe)
updateHeader(universe)

const timestamp = new Date().toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const backupPath = resolve(root, 'data', `universe_master.backup-before-update-006-${timestamp}.json`)
await copyFile(masterPath, backupPath)
const temporaryPath = `${masterPath}.update-006.tmp`
await writeFile(temporaryPath, `${JSON.stringify(universe, null, 2)}\n`, 'utf8')
try {
  await copyFile(temporaryPath, masterPath)
} finally {
  await rm(temporaryPath, { force: true })
}

console.log(JSON.stringify({
  patch: basename(patchPath),
  backup: backupPath,
  version: universe.metadata.version,
  build: universe.metadata.build,
  modules: universe.modules.length,
  economyItems: universe.modules.find((module) => module.id === 'economy').content.items.length,
  marketModulePresent: universe.modules.some((module) => module.id === 'market'),
}, null, 2))
