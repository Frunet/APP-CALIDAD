import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { Layout, RequireAdmin, RequireReviewer } from './components/Layout'
import { HistoryPage } from './features/receptions/HistoryPage'
import { ReceptionEditor } from './features/receptions/ReceptionEditor'
import { ReportPage } from './features/receptions/ReportPage'
import { SavedPage } from './features/receptions/SavedPage'
import { AgreementsPage } from './features/agreements/AgreementsPage'
import { MastersPage } from './features/admin/MastersPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route
          index
          element={
            <RequireReviewer>
              <HistoryPage />
            </RequireReviewer>
          }
        />
        <Route path="receptions/new" element={<ReceptionEditor />} />
        <Route path="saved" element={<SavedPage />} />
        <Route
          path="receptions/:id"
          element={
            <RequireReviewer>
              <ReceptionEditor />
            </RequireReviewer>
          }
        />
        <Route
          path="receptions/:id/report"
          element={
            <RequireReviewer>
              <ReportPage />
            </RequireReviewer>
          }
        />
        <Route path="specifications" element={<AgreementsPage />} />
        <Route
          path="masters"
          element={
            <RequireAdmin>
              <MastersPage />
            </RequireAdmin>
          }
        />
        <Route path="users" element={<Navigate to="/masters" replace />} />
        <Route path="*" element={<div className="card">Página no encontrada.</div>} />
      </Route>
    </Routes>
  )
}
