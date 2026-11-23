// Domain model for GIST Cleaning Hub. Everything lives in one JSON state object
// (see store.tsx) so the demo works offline; the same shapes map 1:1 to tables in
// the Supabase schema described in docs/BACKEND.md.

export type Role = 'owner' | 'manager' | 'employee' | 'client'

export interface Onboarding {
  profile: boolean
  w4: boolean
  i9: boolean
  directDeposit: boolean
  handbookSigned: boolean
  agreementSigned: boolean
}

export interface W4 {
  filingStatus: 'single' | 'married' | 'head'
  multipleJobs: boolean
  dependentsAmount: number
  otherIncome: number
  deductions: number
  extraWithholding: number
}

export interface User {
  id: string
  name: string
  role: Role
  title: string
  email: string
  phone: string
  color: string
  // employees
  employmentType?: 'regular' | 'substitute'
  payRate?: number
  startDate?: string
  department?: string
  managerId?: string
  payMethod?: 'direct_deposit' | 'check'
  bankLast4?: string
  ptoStartBalance?: number
  onboarding?: Onboarding
  w4?: W4
  // clients
  clientId?: string
  active?: boolean
}

export interface Client {
  id: string
  household: string
  contactName: string
  phone: string
  email: string
  address: string
  lat: number
  lng: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'as-needed' | 'project'
  durationHours: number
  sopSlug?: string
  service: ServiceKey
  addOns: AddOnKey[]
  notes: string
  pets: string
  since: string
  preferredEmployeeId?: string
  photos: { id: string; caption: string; dataUrl: string }[]
  active: boolean
}

export type ServiceKey = 'basic' | 'white-glove' | 'rescue' | 'organization' | 'commercial'
export type AddOnKey = 'tidying' | 'washing' | 'pet-care' | 'pet-poop'

export interface Shift {
  id: string
  employeeId: string | null // null = open shift
  clientId: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string
  jobTitle: string
  note: string
  published: boolean
  checklist?: Record<string, boolean> // SOP checklist progress, keyed by item id
}

export interface TimeEdit {
  at: string
  byId: string
  change: string
  note: string
}

export interface TimeEntry {
  id: string
  employeeId: string
  shiftId?: string
  clientId?: string
  clockIn: string // ISO
  clockOut?: string // ISO
  breakMinutes: number
  source: 'clock' | 'manual'
  onSite: boolean
  distanceM?: number
  status: 'open' | 'submitted' | 'approved' | 'rejected'
  note: string
  history: TimeEdit[]
}

export interface Availability {
  employeeId: string
  weekly: { day: number; kind: 'all' | 'none' | 'custom'; from?: string; to?: string }[]
  notes: string
  updatedAt: string
}

export interface TimeOff {
  id: string
  employeeId: string
  start: string
  end: string
  hours: number
  type: 'pto' | 'unpaid' | 'sick'
  reason: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
}

export interface Paystub {
  id: string
  payrollId: string
  employeeId: string
  periodStart: string
  periodEnd: string
  payDate: string
  rate: number
  regularHours: number
  overtimeHours: number
  ptoHours: number
  regularPay: number
  overtimePay: number
  ptoPay: number
  tips: number
  gross: number
  taxes: { federal: number; socialSecurity: number; medicare: number; state: number }
  reimbursements: { label: string; amount: number }[]
  cards: { supply: number; gas: number }
  net: number
  ptoAccrued: number
  method: 'direct_deposit' | 'check'
}

export interface Payroll {
  id: string
  periodStart: string
  periodEnd: string
  payDate: string
  status: 'draft' | 'processed'
  processedAt?: string
  stubIds: string[]
}

export interface Expense {
  id: string
  employeeId: string
  date: string
  category: 'mileage' | 'laundry' | 'supplies' | 'other'
  amount: number
  miles?: number
  description: string
  receipt?: string // data URL
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  payrollId?: string
}

export interface CardTxn {
  id: string
  employeeId: string
  card: 'supply' | 'gas'
  date: string
  amount: number // + load, - spend
  description: string
}

export interface Task {
  id: string
  userId: string
  title: string
  detail: string
  due: string
  done: boolean
  link?: string
  kind: 'onboarding' | 'availability' | 'timesheet' | 'document' | 'general'
}

export interface Notice {
  id: string
  userId: string
  text: string
  at: string
  read: boolean
  link?: string
}

export interface Booking {
  id: string
  createdAt: string
  name: string
  email: string
  phone: string
  address: string
  service: ServiceKey
  addOns: AddOnKey[]
  frequency: Client['frequency'] | 'one-time'
  homeSize: string
  preferredDate: string
  preferredTime: string
  notes: string
  status: 'new' | 'contacted' | 'scheduled' | 'declined'
  clientId?: string
}

export interface InvoiceLine {
  description: string
  hours: number
  rate: number
  amount: number
}

export interface Invoice {
  id: string
  number: number
  clientId: string
  date: string
  due: string
  lines: InvoiceLine[]
  total: number
  status: 'draft' | 'sent' | 'paid' | 'void'
  method?: 'venmo' | 'zelle' | 'square'
  paidAt?: string
  shiftIds: string[]
}

export interface Message {
  id: string
  threadId: string // client id or employee id
  fromId: string
  text: string
  at: string
}

export interface UploadedDoc {
  id: string
  title: string
  category: string
  md?: string
  file?: { name: string; type: string; dataUrl: string }
  createdAt: string
  byId: string
  employeeId?: string // personal doc (W-2, signed agreement…)
}

export interface Signature {
  docSlug: string
  userId: string
  name: string
  at: string
}

export type AiProviderId = 'live' | 'offline' | 'bridge' | 'anthropic'

export interface Settings {
  geofenceMeters: number
  simulateOnSite: boolean
  aiProvider: AiProviderId
  aiLive?: number // 1 once a saved demo has been moved onto the live assistant (soft migration)
  bridgeUrl: string
  bridgeToken: string
  anthropicKey: string
  anthropicModel: string
}

export interface State {
  version: number
  seededAt: string
  currentUserId: string | null
  users: User[]
  clients: Client[]
  shifts: Shift[]
  time: TimeEntry[]
  availability: Availability[]
  timeOff: TimeOff[]
  payrolls: Payroll[]
  stubs: Paystub[]
  expenses: Expense[]
  cardTxns: CardTxn[]
  tasks: Task[]
  notices: Notice[]
  bookings: Booking[]
  invoices: Invoice[]
  messages: Message[]
  uploads: UploadedDoc[]
  signatures: Signature[]
  settings: Settings
}
