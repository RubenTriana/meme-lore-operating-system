import type { LucideIcon } from 'lucide-react'
import { BookOpen, BrainCircuit, Box, Building2, CircleHelp, Clapperboard, Clock3, Cpu, Flag, Gem, Landmark, LibraryBig, RadioTower, Share2, UsersRound } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  BookOpen,
  BrainCircuit,
  Building2,
  CircleHelp,
  Clapperboard,
  Clock3,
  Cpu,
  Flag,
  Gem,
  Landmark,
  LibraryBig,
  RadioTower,
  Share2,
  UsersRound,
}

export function DynamicIcon({ name, size = 18, strokeWidth = 1.8 }: { name?: string; size?: number; strokeWidth?: number }) {
  const Icon = (name && icons[name]) || Box
  return <Icon size={size} strokeWidth={strokeWidth} />
}
