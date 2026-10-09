import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { Layout, RequireAdmin } from './components/Layout'
import { HistoryPage } from './features/receptions/HistoryPage'
import { ReceptionEditor } from './features/receptions/ReceptionEditor'
import { ReportPage } from './features/receptions/ReportPage'
import { AgreementsPage } from './features/agreements/AgreementsPage'
import { UsersPage } from './features/admin/UsersPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<HistoryPage />} />
        <Route path="receptions/new" element={<ReceptionEditor />} />
        <Route path="receptions/:id" element={<ReceptionEditor />} />
        <Route path="receptions/:id/report" element={<ReportPage />} />
        <Route path="agreements" element={<AgreementsPage />} />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<div className="card">Página no encontrada.</div>} />
      </Route>
    </Routes>
  )
}
