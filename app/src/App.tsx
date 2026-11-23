// Routes. HashRouter so the same build works on GitHub Pages, a custom domain and inside
// the Android app (file-based WebView) without server rewrites.
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { AppLayout, PublicLayout } from './components/Layouts'
import { About, AboutApp, Book, Business, Careers, Contact, Home, Login, Organization, Policies, Pricing, Services, Updates } from './pages/Public'

// The public site loads first; signed-in screens and the doc reader are split into their own
// chunks so a visitor on a phone downloads less up front.
// Lazy-load a named export so each area (employee, owner, client, docs) is its own chunk.
function lz<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as M[K] & ComponentType<any> }))
}
const loadDocs = () => import('./pages/Docs')
const DocView = lz(loadDocs, 'DocView')
const DocsList = lz(loadDocs, 'DocsList')
const loadEmployee = () => import('./pages/Employee')
const AvailabilityPage = lz(loadEmployee, 'AvailabilityPage')
const CardsPage = lz(loadEmployee, 'CardsPage')
const EmployeeDashboard = lz(loadEmployee, 'EmployeeDashboard')
const EmployeeSchedule = lz(loadEmployee, 'EmployeeSchedule')
const ExpensesPage = lz(loadEmployee, 'ExpensesPage')
const OnboardingPage = lz(loadEmployee, 'OnboardingPage')
const PayPage = lz(loadEmployee, 'PayPage')
const ProfilePage = lz(loadEmployee, 'ProfilePage')
const ShiftDetail = lz(loadEmployee, 'ShiftDetail')
const Tasks = lz(loadEmployee, 'Tasks')
const TimeOffPage = lz(loadEmployee, 'TimeOffPage')
const TimePage = lz(loadEmployee, 'TimePage')
const loadOwner = () => import('./pages/Owner')
const Approvals = lz(loadOwner, 'Approvals')
const Bookings = lz(loadOwner, 'Bookings')
const ClientDetail = lz(loadOwner, 'ClientDetail')
const Clients = lz(loadOwner, 'Clients')
const Invoices = lz(loadOwner, 'Invoices')
const OwnerDashboard = lz(loadOwner, 'OwnerDashboard')
const OwnerSchedule = lz(loadOwner, 'OwnerSchedule')
const PayrollPage = lz(loadOwner, 'PayrollPage')
const Reports = lz(loadOwner, 'Reports')
const SettingsPage = lz(loadOwner, 'SettingsPage')
const Team = lz(loadOwner, 'Team')
const TeamMember = lz(loadOwner, 'TeamMember')
const loadClient = () => import('./pages/Client')
const ClientHome = lz(loadClient, 'ClientHome')
const Preferences = lz(loadClient, 'Preferences')
const RequestCleaning = lz(loadClient, 'RequestCleaning')
const Visits = lz(loadClient, 'Visits')
const loadShared = () => import('./pages/Shared')
const Assistant = lz(loadShared, 'Assistant')
const Messages = lz(loadShared, 'Messages')

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
      <Suspense fallback={<div className="boot"><div className="spinner" /> Loading…</div>}>
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
      </Suspense>
    </HashRouter>
  )
}
