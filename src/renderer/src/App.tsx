import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import SetupPage from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import ReportPage from './pages/ReportPage'
import './styles.css'

function App(): JSX.Element {
  return (
    <BrowserRouter>
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
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SetupPage />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
