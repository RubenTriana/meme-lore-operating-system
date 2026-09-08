import { describe, expect, it } from 'vitest'
import { queryTantaloContext, TantaloContextError } from '../vite-tantalo-context-plugin'

const fixture = {
  metadata: { title: 'Saga', version: '0.9.0', schemaVersion: '3.5.0', build: 'test' },
  modules: [
    {
      id: 'characters',
      title: 'Personajes',
      content: {
        items: [
          {
            id: 'ruth',
            type: 'character',
            title: 'Ruth',
            summary: 'Guarda información sobre Amaranta.',
            tags: ['personaje'],
            desire: 'Proteger la información.',
            need: 'Recuperar agencia.',
            wound: 'Pérdida previa.',
            refs: ['amaranta'],
            analysis: { psychology: 'Evita entregar control.' },
          },
          {
            id: 'vicente',
            type: 'character',
            title: 'Vicente',
            summary: 'Director local oculto.',
            tags: ['personaje'],
            desire: 'Estudiar a Clay.',
            refs: ['clay'],
          },
        ],
      },
    },
    {
      id: 'relationships',
      title: 'Relaciones',
      content: {
        items: [
          {
            id: 'ruth-amaranta',
            type: 'relationship',
            title: 'Ruth y Amaranta',
            summary: 'Relación informativa.',
            fromRef: 'ruth',
            toRef: 'amaranta',
            refs: ['ruth', 'amaranta'],
          },
        ],
      },
    },
    {
      id: 'lore',
      title: 'Lore',
      content: {
        items: [
          {
            id: 'nuevo-caguan',
            type: 'place',
            title: 'Nuevo Caguán',
            summary: 'Lugar de la operación.',
            refs: ['ruth', 'vicente'],
          },
        ],
      },
    },
    {
      id: 'timeline',
      title: 'Cronología',
      content: {
        items: [
          {
            id: 'arrival',
            type: 'event',
            title: 'Llegada de Clay',
            summary: 'Vicente conduce a Clay.',
            sequence: 1,
            refs: ['clay', 'vicente'],
          },
        ],
      },
    },
    {
      id: 'rio',
      title: 'Modificadores de probabilidades — RÍO',
      content: {
        items: [
          {
            id: 'rio-system-overview',
            type: 'rio-approved-category',
            title: 'Modificadores de probabilidades — RÍO',
            summary: 'Categoría aprobada.',
            status: 'approved_scope_only',
            canonLevel: 'CATEGORY_APPROVED_DETAILS_PROPOSED',
            aliases: ['RIO', 'Reserva de Indeterminación Orgánica'],
          },
          {
            id: 'rio-causa-tardia',
            type: 'rio-ability-proposal',
            title: 'La Causa Tardía',
            summary: 'Facultad causal propuesta.',
            status: 'proposed',
            canonLevel: 'NO_CANON_HASTA_APROBACION',
            hardLimits: 'No modifica hechos causalmente completos.',
          },
        ],
      },
    },
  ],
  changelog: [
    {
      id: 'change-016',
      version: '0.9.0',
      date: '2026-07-31',
      changes: ['Añade a Ruth y Vicente.'],
      modules: ['characters'],
    },
  ],
}

describe('API selectiva de contexto Tántalo', () => {
  it('devuelve solo personajes y relaciones solicitados para psicología', () => {
    const result = queryTantaloContext(
      fixture,
      {
        query: 'psicología de Ruth',
        domains: ['psychology'],
        terms: ['Ruth'],
        depth: 3,
        mode: 'Revisión de Capítulo',
        workflowId: 'revisar-personajes',
        maxItems: 5,
      },
      '2026-07-31T20:00:00.000Z',
    )

    expect(result.audit.fullContext).toBe(false)
    expect(result.audit.resolvedModules).toEqual(['characters', 'relationships'])
    expect(result.audit.recordsConsidered).toBe(3)
    expect(result.context).not.toHaveProperty('fullDocument')
    const modules = result.context.modules as Array<{
      id: string
      items: Array<Record<string, unknown>>
    }>
    expect(modules.flatMap((module) => module.items).some((item) => item.id === 'ruth')).toBe(true)
    expect(
      modules.flatMap((module) => module.items).find((item) => item.id === 'ruth'),
    ).toHaveProperty('desire')
  })

  it('limita continuidad a sus módulos y al máximo de profundidad', () => {
    const result = queryTantaloContext(fixture, {
      query: 'compatibilidad de Vicente con la llegada',
      domains: ['continuity'],
      terms: ['Vicente', 'llegada'],
      depth: 2,
      mode: 'Revisión de Capítulo',
      workflowId: 'continuidad',
      maxItems: 1,
    })

    expect(result.audit.fullContext).toBe(false)
    expect(result.audit.recordsReturned).toBe(1)
    expect(result.audit.resolvedModules).not.toContain('characters')
  })

  it('rechaza consultas sin un dominio concreto', () => {
    expect(() =>
      queryTantaloContext(fixture, { query: 'Busca cualquier cosa', domains: [], depth: 2 }),
    ).toThrowError(TantaloContextError)
    try {
      queryTantaloContext(fixture, { query: 'Busca cualquier cosa', domains: [], depth: 2 })
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 400, code: 'DOMAIN_REQUIRED' })
    }
  })

  it('bloquea contexto integral fuera de profundidad 5 y workflows autorizados', () => {
    expect(() =>
      queryTantaloContext(fixture, {
        query: 'Auditoría completa',
        domains: ['canon'],
        depth: 4,
        mode: 'Profundo',
        workflowId: 'torneo-versiones',
        allowFullContext: true,
      }),
    ).toThrowError(/profundidad 5/i)

    expect(() =>
      queryTantaloContext(fixture, {
        query: 'Auditoría completa',
        domains: ['canon'],
        depth: 5,
        mode: 'Profundo',
        workflowId: 'continuar-escribiendo',
        allowFullContext: true,
      }),
    ).toThrowError(/skill autorizada/i)
  })

  it('permite el documento integral solo al torneo profundo de nivel 5', () => {
    const result = queryTantaloContext(fixture, {
      query: 'Torneo de versiones con auditoría integral',
      domains: ['canon'],
      depth: 5,
      mode: 'Profundo',
      workflowId: 'torneo-versiones',
      allowFullContext: true,
    })

    expect(result.audit.fullContext).toBe(true)
    expect(result.audit.resolvedModules).toEqual(['*'])
    expect(result.context.fullDocument).toEqual(fixture)
  })

  it('consulta versiones sin exponer el resto del documento', () => {
    const result = queryTantaloContext(fixture, {
      query: 'versión 0.9.0 Ruth',
      domains: ['versions'],
      terms: ['0.9.0', 'Ruth'],
      depth: 2,
      mode: 'Revisión de Capítulo',
      workflowId: 'comprobar-continuidad',
    })
    expect(result.audit.recordsReturned).toBe(1)
    expect(result.context).not.toHaveProperty('fullDocument')
    expect(JSON.stringify(result.context)).toContain('change-016')
  })

  it('recupera RÍO y conserva el estado editorial de cada ficha', () => {
    const result = queryTantaloContext(fixture, {
      query: '¿Está aprobada La Causa Tardía?',
      domains: ['RÍO'],
      terms: ['Causa Tardía'],
      depth: 3,
      mode: 'Tutor Ligero',
      workflowId: 'consultar-rio',
    })
    const modules = result.context.modules as Array<{
      id: string
      items: Array<Record<string, unknown>>
    }>
    const item = modules
      .flatMap((module) => module.items)
      .find((entry) => entry.id === 'rio-causa-tardia')
    expect(result.audit.resolvedModules).toEqual(['rio'])
    expect(item).toMatchObject({ status: 'proposed', canonLevel: 'NO_CANON_HASTA_APROBACION' })
  })

  it('aplica canonPolicy al contexto ordinario y preserva el contexto integral de auditoría', () => {
    const governed = structuredClone(fixture) as typeof fixture & {
      settings: Record<string, unknown>
    }
    governed.settings = {
      canonPolicy: {
        defaultIncludeCanonStatuses: ['CANON'],
        defaultExcludeCanonStatuses: ['PROPOSAL'],
        excludeModulesByDefault: ['plottr-import'],
        proposedNestedFieldsMustRemainExcluded: ['rioLayer'],
      },
    }
    const governedCharacters = governed.modules[0].content.items as Array<Record<string, unknown>>
    governedCharacters[0] = {
      ...governedCharacters[0],
      canonStatus: 'CANON',
      rioLayer: { status: 'PROPOSAL' },
    }
    governedCharacters[1] = {
      ...governedCharacters[1],
      canonStatus: 'PROPOSAL',
    }

    const result = queryTantaloContext(governed, {
      query: 'Ruth Vicente',
      domains: ['psychology'],
      terms: ['Ruth', 'Vicente'],
      depth: 4,
      mode: 'Revisión de Capítulo',
      workflowId: 'revisar-personajes',
      maxItems: 5,
    })
    const serialized = JSON.stringify(result.context)

    expect(serialized).toContain('Ruth')
    expect(serialized).not.toContain('Vicente')
    expect(serialized).not.toContain('rioLayer')
  })
})
