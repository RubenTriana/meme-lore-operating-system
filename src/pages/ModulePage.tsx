import { Navigate, useParams } from 'react-router-dom'
import { useUniverseModel } from '@/app/useUniverseModel'
import { createSemanticIndex } from '@/utils/semantic-index'
import { getRenderer } from '@/renderer/registry'

export function ModulePage() {
  const { moduleId } = useParams()
  const { universe } = useUniverseModel()
  const module = universe?.modules.find((candidate) => candidate.id === moduleId)
  if (!universe || !module) return <Navigate to="/" replace />
  const Renderer = getRenderer(module.renderer)
  return <Renderer module={module} universe={universe} index={createSemanticIndex(universe)} />
}
