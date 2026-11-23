// Routes. HashRouter so the same build works on GitHub Pages, a custom domain and inside
// the Android app (file-based WebView) without server rewrites.
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { AppLayout, PublicLayout } from './components/Layouts'
import { About, AboutApp, Book, Business, Careers, Contact, Home, Login, Organization, Policies, Pricing, Services, Updates } from './pages/Public'
import { DocView, DocsList } from './pages/Docs'
import { AvailabilityPage, CardsPage, EmployeeDashboard, EmployeeSchedule, ExpensesPage, OnboardingPage, PayPage, ProfilePage, ShiftDetail, Tasks, TimeOffPage, TimePage } from './pages/Employee'
import { Approvals, Bookings, ClientDetail, Clients, Invoices, OwnerDashboard, OwnerSchedule, PayrollPage, Reports, SettingsPage, Team, TeamMember } from './pages/Owner'
import { ClientHome, Preferences, RequestCleaning, Visits } from './pages/Client'
import { Assistant, Messages } from './pages/Shared'

function Guard({ children }: { children: ReactNode }) {
  const { me } = useStore()
  return me ? <>{children}</> : <Navigate to="/login" replace />
}

/** Pick the screen for the signed-in role; anything not allowed falls back to the dashboard. */
function ByRole({ owner, employee, client }: { owner?: ReactNode; employee?: ReactNode; client?: ReactNode }) {
  const { role } = useStore()
  const el = role === 'owner' || role === 'manager' ? owner : role === 'employee' ? employee : role === 'client' ? client : undefined
  return el ? <>{el}</> : <Navigate to="/app" replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="services" element={<Services />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="organization" element={<Organization />} />
          <Route path="business" element={<Business />} />
          <Route path="contact" element={<Contact />} />
          <Route path="policies" element={<Policies />} />
          <Route path="updates" element={<Updates />} />
          <Route path="careers" element={<Careers />} />
          <Route path="book" element={<Book />} />
          <Route path="login" element={<Login />} />
          <Route path="docs" element={<DocsList />} />
          <Route path="docs/:slug" element={<DocView />} />
          <Route path="about-this-app" element={<AboutApp />} />
        </Route>
        <Route path="app" element={<Guard><AppLayout /></Guard>}>
          <Route index element={<ByRole owner={<OwnerDashboard />} employee={<EmployeeDashboard />} client={<ClientHome />} />} />
          <Route path="schedule" element={<ByRole owner={<OwnerSchedule />} employee={<EmployeeSchedule />} />} />
          <Route path="shift/:id" element={<ByRole owner={<ShiftDetail />} employee={<ShiftDetail />} />} />
          <Route path="time" element={<ByRole employee={<TimePage />} />} />
          <Route path="pay" element={<ByRole employee={<PayPage />} />} />
          <Route path="time-off" element={<ByRole employee={<TimeOffPage />} />} />
          <Route path="availability" element={<ByRole employee={<AvailabilityPage />} />} />
          <Route path="expenses" element={<ByRole employee={<ExpensesPage />} />} />
          <Route path="cards" element={<ByRole employee={<CardsPage />} />} />
          <Route path="tasks" element={<ByRole employee={<Tasks />} owner={<Tasks />} />} />
          <Route path="onboarding" element={<ByRole employee={<OnboardingPage />} />} />
          <Route path="profile" element={<ByRole employee={<ProfilePage />} owner={<ProfilePage />} client={<ProfilePage />} />} />
          <Route path="approvals" element={<ByRole owner={<Approvals />} />} />
          <Route path="payroll" element={<ByRole owner={<PayrollPage />} />} />
          <Route path="team" element={<ByRole owner={<Team />} />} />
          <Route path="team/:id" element={<ByRole owner={<TeamMember />} />} />
          <Route path="clients" element={<ByRole owner={<Clients />} />} />
          <Route path="clients/:id" element={<ByRole owner={<ClientDetail />} />} />
          <Route path="bookings" element={<ByRole owner={<Bookings />} />} />
          <Route path="reports" element={<ByRole owner={<Reports />} />} />
          <Route path="settings" element={<ByRole owner={<SettingsPage />} />} />
          <Route path="invoices" element={<ByRole owner={<Invoices />} client={<Invoices />} />} />
          <Route path="visits" element={<ByRole client={<Visits />} />} />
          <Route path="request" element={<ByRole client={<RequestCleaning />} />} />
          <Route path="preferences" element={<ByRole client={<Preferences />} />} />
          <Route path="messages" element={<Messages />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="docs" element={<ByRole owner={<DocsList base="/app/docs" />} employee={<DocsList base="/app/docs" />} />} />
          <Route path="docs/:slug" element={<ByRole owner={<DocView base="/app/docs" />} employee={<DocView base="/app/docs" />} />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
