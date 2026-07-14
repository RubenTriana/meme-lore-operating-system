import { Braces, ChevronLeft, Command, GitCompareArrows, Menu, ScanSearch, Settings2, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { NavLink, Outlet } from 'react-router-dom'
import { useUniverseModel } from '@/app/useUniverseModel'
import { DynamicIcon } from '@/components/icon'
import { useStudioStore } from '@/store/useStudioStore'
import { SearchPalette } from '@/components/SearchPalette'
import { analysisRoute } from '@/app/routes'

export function AppShell() {
  const { universe, validation } = useUniverseModel()
  const { sidebarCollapsed, toggleSidebar, setSearchOpen, developerMode } = useStudioStore()
  if (!validation.valid || !universe) return null
  const modules = universe.modules.filter((module) => module.visibility === 'navigation').sort((a, b) => a.order - b.order)
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}><aside className="sidebar"><div className="brand"><div className="brand-mark">M</div>{!sidebarCollapsed && <div><strong>MEME</strong><span>Lore Operating System</span></div>}<button onClick={toggleSidebar} aria-label="Collapse navigation">{sidebarCollapsed ? <Menu size={17} /> : <ChevronLeft size={17} />}</button></div><nav><NavLink end to="/" className="nav-item"><Sparkles size={17} /><span>Overview</span></NavLink><p className="nav-label">Universe</p>{modules.map((module) => <NavLink key={module.id} to={`/module/${module.id}`} className="nav-item"><DynamicIcon name={module.icon} size={17} /><span>{module.title}</span></NavLink>)}<p className="nav-label">System</p><NavLink to="/insights" className="nav-item"><Sparkles size={17} /><span>AI Insights</span></NavLink><NavLink to={analysisRoute} className="nav-item"><ScanSearch size={17} /><span>Analysis</span></NavLink><NavLink to="/changelog" className="nav-item"><GitCompareArrows size={17} /><span>Changelog</span></NavLink><NavLink to="/settings" className="nav-item"><Settings2 size={17} /><span>Settings</span></NavLink>{developerMode && <NavLink to="/developer" className="nav-item"><Braces size={17} /><span>Developer</span></NavLink>}</nav><div className="sidebar-version">{!sidebarCollapsed && <><span>CANON VERSION</span><strong>v{universe.metadata.version}</strong></>}</div></aside><main className="workspace"><header className="topbar"><button className="mobile-menu" onClick={toggleSidebar}><Menu size={18} /></button><button className="global-search" onClick={() => setSearchOpen(true)}><Command size={15} /><span>Search the universe</span><kbd>⌘ K</kbd></button><div className="topbar-meta"><span>Schema {universe.metadata.schemaVersion}</span><i /><span className="status-dot" /> Canon valid</div></header><motion.div className="page-content" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}><Outlet /></motion.div></main><SearchPalette /></div>
}
