import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { UniverseProvider } from './UniverseProvider'
import { useUniverseModel } from './useUniverseModel'
import { AppShell } from '@/layouts/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ValidationScreen } from '@/components/ValidationScreen'
import { HomePage } from '@/pages/HomePage'
import { analysisRoute, codexRoute, connectionsRoute, extractionRoute, plausibilityRoute, proposalsRoute } from './routes'

const ModulePage = lazy(() => import('@/pages/ModulePage').then((module) => ({ default: module.ModulePage })))
const InsightsPage = lazy(() => import('@/pages/InsightsPage').then((module) => ({ default: module.InsightsPage })))
const ChangelogPage = lazy(() => import('@/pages/ChangelogPage').then((module) => ({ default: module.ChangelogPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const DeveloperPage = lazy(() => import('@/pages/DeveloperPage').then((module) => ({ default: module.DeveloperPage })))
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage').then((module) => ({ default: module.AnalysisPage })))
const ConnectionsPage = lazy(() => import('@/pages/ConnectionsPage').then((module) => ({ default: module.ConnectionsPage })))
const PlausibilityPage = lazy(() => import('@/pages/PlausibilityPage').then((module) => ({ default: module.PlausibilityPage })))
const ExtractionPage = lazy(() => import('@/pages/ExtractionPage').then((module) => ({ default: module.ExtractionPage })))
const ProposalListPage = lazy(() => import('@/pages/ProposalListPage').then((module) => ({ default: module.ProposalListPage })))
const ProposalDetailPage = lazy(() => import('@/pages/ProposalDetailPage').then((module) => ({ default: module.ProposalDetailPage })))
const CodexReaderPage = lazy(() => import('@/pages/CodexReaderPage').then((module) => ({ default: module.CodexReaderPage })))
const CodexTypographySpecimen = lazy(() => import('@/pages/CodexTypographySpecimen').then((module) => ({ default: module.CodexTypographySpecimen })))
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

function Loading() { return <main className="app-loading"><span className="loading-mark">M</span><p>Loading canonical universe…</p></main> }

function AppRoutes() {
  const { isLoading, validation } = useUniverseModel()
  if (isLoading) return <Loading />
  if (!validation.valid) return <ValidationScreen />
  return <BrowserRouter><Suspense fallback={<Loading />}><Routes><Route path={codexRoute.slice(1)} element={<CodexReaderPage />} /><Route path={`${codexRoute.slice(1)}/tipografia`} element={<CodexTypographySpecimen />} /><Route element={<AppShell />}><Route index element={<HomePage />} /><Route path="module/:moduleId" element={<ModulePage />} /><Route path="insights" element={<InsightsPage />} /><Route path={analysisRoute.slice(1)} element={<AnalysisPage />} /><Route path={connectionsRoute.slice(1)} element={<ConnectionsPage />} /><Route path={plausibilityRoute.slice(1)} element={<PlausibilityPage />} /><Route path={extractionRoute.slice(1)} element={<ExtractionPage />} /><Route path={proposalsRoute.slice(1)} element={<ProposalListPage />} /><Route path={`${proposalsRoute.slice(1)}/:proposalId`} element={<ProposalDetailPage />} /><Route path="changelog" element={<ChangelogPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="developer" element={<DeveloperPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></Suspense></BrowserRouter>
}

export function App() {
  return <QueryClientProvider client={queryClient}><UniverseProvider><ErrorBoundary><AppRoutes /></ErrorBoundary></UniverseProvider></QueryClientProvider>
}
