import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface StudioState {
  sidebarCollapsed: boolean
  developerMode: boolean
  searchOpen: boolean
  selectedEntityId?: string
  dashboardLayout: 'comfort' | 'compact'
  aiExtractionEnabled: boolean
  toggleSidebar: () => void
  setDeveloperMode: (enabled: boolean) => void
  setSearchOpen: (open: boolean) => void
  setSelectedEntity: (id?: string) => void
  setDashboardLayout: (layout: 'comfort' | 'compact') => void
  setAiExtractionEnabled: (enabled: boolean) => void
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
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setDeveloperMode: (developerMode) => set({ developerMode }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setSelectedEntity: (selectedEntityId) => set({ selectedEntityId }),
      setDashboardLayout: (dashboardLayout) => set({ dashboardLayout }),
      setAiExtractionEnabled: (aiExtractionEnabled) => set({ aiExtractionEnabled }),
    }),
    { name: 'meme-los-preferences', partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, developerMode: state.developerMode, dashboardLayout: state.dashboardLayout, aiExtractionEnabled: state.aiExtractionEnabled }) },
  ),
)
