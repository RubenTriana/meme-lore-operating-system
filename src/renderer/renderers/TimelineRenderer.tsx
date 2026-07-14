import { CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui'
import { Chronology } from '@/timeline/Chronology'
import type { RendererProps } from '../types'

export function TimelineRenderer({ module, index }: RendererProps) {
  const items = module.content.items ?? []
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Canonical chronology</p><h1>{module.title}</h1><p>{module.description}</p></div><CalendarDays size={30} /></header><Card className="timeline-card"><Chronology items={items} index={index} /></Card></div>
}
