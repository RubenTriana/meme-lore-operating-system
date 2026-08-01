import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnalysisEngines } from '@/types/universe'

export type AnalysisPreset = 'quick' | 'full' | 'continuity' | 'connections'

export const ANALYSIS_PRESETS: Record<AnalysisPreset, AnalysisEngines> = {
  quick: { continuity: true, causality: true, knowledge: false, connections: false, plausibility: false },
  full: { continuity: true, causality: true, knowledge: true, connections: true, plausibility: true },
  continuity: { continuity: true, causality: false, knowledge: false, connections: false, plausibility: false },
  connections: { continuity: false, causality: false, knowledge: false, connections: true, plausibility: false },
}

interface StudioState {
  sidebarCollapsed: boolean
  developerMode: boolean
  searchOpen: boolean
  selectedEntityId?: string
  dashboardLayout: 'comfort' | 'compact'
  aiExtractionEnabled: boolean
  analysisEngines: AnalysisEngines
  analysisLastRunAt?: string
  toggleSidebar: () => void
  setDeveloperMode: (enabled: boolean) => void
  setSearchOpen: (open: boolean) => void
  setSelectedEntity: (id?: string) => void
  setDashboardLayout: (layout: 'comfort' | 'compact') => void
  setAiExtractionEnabled: (enabled: boolean) => void
  setAnalysisEngine: (engine: keyof AnalysisEngines, enabled: boolean) => void
  applyAnalysisPreset: (preset: AnalysisPreset) => void
  setAnalysisLastRunAt: (value?: string) => void
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      developerMode: false,
      searchOpen: false,
      selectedEntityId: undefined,
      dashboardLayout: 'comfort',
      aiExtractionEnabled: false,
      analysisEngines: { continuity: false, causality: false, knowledge: false, connections: false, plausibility: false },
      analysisLastRunAt: undefined,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setDeveloperMode: (developerMode) => set({ developerMode }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setSelectedEntity: (selectedEntityId) => set({ selectedEntityId }),
      setDashboardLayout: (dashboardLayout) => set({ dashboardLayout }),
      setAiExtractionEnabled: (aiExtractionEnabled) => set({ aiExtractionEnabled }),
      setAnalysisEngine: (engine, enabled) => set((state) => ({ analysisEngines: { ...state.analysisEngines, [engine]: enabled } })),
      applyAnalysisPreset: (preset) => set({ analysisEngines: { ...ANALYSIS_PRESETS[preset] } }),
      setAnalysisLastRunAt: (analysisLastRunAt) => set({ analysisLastRunAt }),
    }),
    { name: 'meme-los-preferences', partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, developerMode: state.developerMode, dashboardLayout: state.dashboardLayout, aiExtractionEnabled: state.aiExtractionEnabled, analysisEngines: state.analysisEngines, analysisLastRunAt: state.analysisLastRunAt }) },
  ),
)
