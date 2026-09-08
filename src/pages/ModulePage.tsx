import { Navigate, useParams } from 'react-router-dom'
import { createElement, useMemo } from 'react'
import { useUniverseModel } from '@/app/useUniverseModel'
import { createSemanticIndex } from '@/utils/semantic-index'
import { isCanonicalModule } from '@/utils/canon-policy'
import { getRenderer } from '@/renderer/registry'

export function ModulePage() {
  const { moduleId } = useParams()
  const { universe } = useUniverseModel()
  const module = universe?.modules.find((candidate) => candidate.id === moduleId)
  const index = useMemo(() => (universe ? createSemanticIndex(universe) : undefined), [universe])
  if (!universe || !module || !isCanonicalModule(universe, module))
    return <Navigate to="/" replace />
  return createElement(getRenderer(module.renderer), { module, universe, index: index! })
}
