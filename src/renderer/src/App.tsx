import { useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import SetupPage from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import './styles.css'

function AppRoutes(): JSX.Element {
  const navigate = useNavigate()

  const handleStopInterview = useCallback(async () => {
    await window.api.stopInterview()
    navigate('/report')
  }, [navigate])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Hi-Offer</div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            新面试
          </NavLink>
          <NavLink to="/interview" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            面试中
          </NavLink>
          <NavLink to="/report" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            报告
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            设置
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<SetupPage />} />
          <Route path="/interview" element={<InterviewPage onStop={handleStopInterview} />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
