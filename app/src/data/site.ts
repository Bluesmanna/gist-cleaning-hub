// Public-site content, carried over from gistcleaning.com (Wix) so the new site has
// everything the old one had: services, pricing, add-ons, about, cancellation policy,
// updates, testimonials and the organization before/after story.
import type { AddOnKey, ServiceKey } from '../lib/types'

export const COMPANY = {
  name: 'GIST Cleaning',
  tagline: 'Getting Into Stuff Together',
  email: 'gistcleaning@gmail.com',
  phone: '208-310-0809',
  city: 'Moscow, ID',
  owner: 'Dustin Sipes',
  ownerTitle: 'Owner / Manager',
  facebook: 'https://www.facebook.com/profile.php?id=100088570125384',
  website: 'https://www.gistcleaning.com',
  payments: ['Venmo', 'Zelle', 'Square'],
}

export interface Service {
  key: ServiceKey
  name: string
  short: string
  rate: number
  rateLabel: string
  includes: string[]
  onRequest?: string[]
  body: string
}

export const SERVICES: Service[] = [
  {
    key: 'basic',
    name: 'Basic Cleaning Package',
    short: "From the usual spit-n'-shine, to that bathroom you don't talk about — and anything in between.",
    rate: 37,
    rateLabel: '$37/hour',
    includes: [
      'Floor care: sweeping, vacuuming, mopping, everyday messes and staining.',
      'Hard surfaces: dusting, sanitizing wipe-down, wood surface care.',
      'Furniture: surface cleaning, vacuuming, everyday messes, light upholstery care.',
      'Bathrooms: everyday upkeep, including toilets and baths/showers.',
      'Basic miscellany: windows, taking out trash, sweeping off steps/porches, cobweb removal, etc.',
      "Deep scrubbing: lime/hard water/gunk, kitchen grease buildup, children's wall graffiti, etc.",
    ],
    onRequest: [
      'Low-use/low-visibility surfaces: walls, baseboards, decorative shelves, cabinet shelves, etc.',
      'Pet messes: changing litter boxes, cleaning and deodorizing everyday or chronic "potty areas".',
      'High-detail miscellany: dusting window blinds, trophy shelves, sanitizing movie cases, etc.',
    ],
    body: 'Cleaning services are available on a regular or semi-regular basis that works for you, with options for as-needed or one-time/emergency cleaning.',
  },
  {
    key: 'white-glove',
    name: '"White Glove" & Move-Out Cleaning',
    short: 'Inspection-level clean for move-outs, landlords, buyers — or the CEO coming to dinner.',
    rate: 50,
    rateLabel: 'from $50/hour',
    includes: [
      'Cleaning inside and under major appliances: ovens, refrigerators, washers & dryers, etc.',
      'Scrubbing walls, cabinets and baseboards.',
      'Dusting & vacuuming out heating & air vents.',
      'Minor mold or mildew elimination.',
    ],
    body: "Cleaning everything in your home to landlord or buyer standards is one of the worst parts of moving. If you'd like to not have to worry about hours and hours of painstaking cleaning, let GIST take over for you. Rates start at $50/hour, depending on the home and workload.",
  },
  {
    key: 'rescue',
    name: '"Rescue Cleaning"',
    short: 'For when the mess is too big and it’s time for some help — zero shame.',
    rate: 40,
    rateLabel: 'from $40/hour',
    includes: [
      'Assess the mess — what causes the most daily stress, what is most urgent, and the root causes.',
      'Make a plan — budget, schedule and where to start making a sustainable difference.',
      'Get you to where you want to be — regain a sense of control, peace and confidence.',
      'Get you organized — can be price-packaged with organization services.',
    ],
    body: 'Most of us have gone through times where the mess grows beyond our control. With an individualized approach and our zero-shame Inclusivity & Understanding policy, you’re in safe hands. Rates start at $40/hour and may vary with individual needs, severity, and the final cleanliness you’re looking for.',
  },
  {
    key: 'organization',
    name: 'Residential Organization',
    short: 'Create a space — for work, for play, or for life at large — that looks and feels good.',
    rate: 45,
    rateLabel: 'from $45/hour',
    includes: [
      'A more space-efficient layout for your kitchen, bathroom, office, game room, etc.',
      'Tackling that one cabinet, or those pesky "doom drawers".',
      'Assessing your clutter and finding ways to reduce or avoid it.',
      'Replacing day-to-day systems and habits that sabotage keeping things organized.',
      'A complete emergency overhaul: organization consulting + "rescue cleaning".',
    ],
    body: 'Basic cleaning of the project space — dusting, sweeping, trash removal and wipe-down — is included in the starting rate. Rates start at $45/hour and vary with needs, severity and project length.',
  },
  {
    key: 'commercial',
    name: 'Commercial Cleaning & Organization',
    short: 'Keep your workplace customer-ready, and let GIST for Business untangle the mess a janitor can’t.',
    rate: 37,
    rateLabel: 'small-business rates, quoted',
    includes: [
      'Improved performance — no more repetitive cleaning on your hourly overhead.',
      'Quality & focus — cleaning is our only job.',
      'Individualized approach — a checklist unique to each client.',
      'Small business rates — adjusted case by case.',
      'GIST for Business: purge old files, obsolete equipment, duplicate inventory and "that one shelf".',
      'Digital clutter & SOPs: scattered file systems, outdated SOPs, systems that no longer serve you.',
    ],
    body: 'With our individualized approach, we consult with you from step one to learn the ins and outs of your business — what you do, how you do it, your space, goals, routine, crew & culture — then determine what we can do to help you get there using Root Cause Analysis.',
  },
]

export interface AddOn {
  key: AddOnKey
  name: string
  price: string
  perHour?: number
  flat?: number
  body: string
}

export const ADDONS: AddOn[] = [
  { key: 'tidying', name: 'Tidying', price: '+$2/hour', perHour: 2, body: 'Pick-up of dishes, toys, clothes, everyday pet chaos, movies, books, papers and other clutter (labelled put-away bins on request). Comes with a 100% "I’m not your mother"-free guarantee!' },
  { key: 'washing', name: 'Washing', price: '+$3/hour ($2 with Tidying)', perHour: 3, body: 'Washing dishes and/or laundry to your specifications and preferences.' },
  { key: 'pet-care', name: 'Pet Care', price: '$15/check-in ($20 non-clients)', flat: 15, body: 'Feed, walk, clean up after and/or play with your fur/scale/water babies while you’re busy or out of town.' },
  { key: 'pet-poop', name: 'Pet Poop Cleanup', price: '$30/occurrence', flat: 30, body: 'Got a yard? Got a dog (or two or three)? Then this is a service you probably need.' },
]

export const CANCELLATION = {
  intro: 'We get it: stuff happens. We all fall victim to unforeseen events, run into daily difficulties, and have sickness enter our lives and homes. Just let us know!',
  tiers: [
    { label: '48+ hours in advance', fee: 'No fee', hours: 48 },
    { label: '24+ hours in advance', fee: '$20 fee*', hours: 24 },
    { label: 'Same-day (under 24 hours)', fee: 'Half of your scheduled cleaning time*', hours: 0 },
  ],
  footnote: '*We are happy to make exceptions in emergency situations, or in case of sickness. Please remain in communication with us if you or your household need cancellation accommodations, and we will work with you.',
  reschedule: 'If you have cancelled following the guidelines above and would like to reschedule before your next regular cleaning, we will always do our very best to find you a spot — but our schedule is often full and it may be a minimum of a week before we can find you another opening.',
}

/** Fee for cancelling a booking `hoursAhead` before it starts. */
export function cancellationFee(hoursAhead: number, scheduledHours: number, rate: number): number {
  if (hoursAhead >= 48) return 0
  if (hoursAhead >= 24) return 20
  return Math.round(scheduledHours * rate * 0.5 * 100) / 100
}

export const TESTIMONIALS = [
  { quote: "I'm one of Dustin's clients and I legit look forward to cleaning day so much", who: 'Jericho', what: 'cleaning & tidying client' },
  { quote: "I have four dogs and three cats, so maintaining the cleanliness of my home requires significant effort. With Dustin's help, I've been able to keep my house up to my exacting standards each week. Dustin is thorough in his work and is a kind and thoughtful person — always receptive to feedback or requests for additional work hours or projects. I'm very grateful to him for his efforts!", who: 'Sarah', what: 'cleaning client' },
  { quote: 'Do you want help with your cleaning or organizing projects? Dustin does amazing work! One time jobs or scheduled ongoing work. Highly recommend!', who: 'Jessica', what: 'organization & outdoor work client' },
]

export const ABOUT = {
  definition: 'gist (jĭst) (n): the main or essential part of a matter.',
  intro: 'The GIST in GIST Cleaning stands for "Getting Into Stuff Together". It may sound sentimental, but it encapsulates our approach, in both acronym and definition: we approach your needs collaboratively to distill the essence of what we can provide for you or your business.',
  factors: [
    { title: 'Quality Work', body: 'Quality work is the only way to give us both what we’re looking for: the clean and organized space you want, the business we need, and a good mutual client relationship that works for both of us. You can always expect our best work.' },
    { title: 'Individual Needs', body: 'Every house, project room, garage or business space is uniquely structured and purposed — and so are the people who live, work, or store their stuff there. Whether personal or functional, GIST works with and around those needs.' },
    { title: 'Comprehensive Approach', body: 'When tackling any mess, look at it from all angles. GIST uses intuitive thinking and the business practice of Root Cause Analysis to look at your unique mess — and your unique goals — and figure out how to get you where you want to be.' },
  ],
  started: [
    'It all started with a dream. (And a nightmare.)',
    'The nightmare was my house. The dream was keeping it clean, organized, and less likely to make me lose all motivation when I walked through the door. It’s not that I didn’t clean — in fact, it felt like I was always cleaning, to the point where it felt like I didn’t have room to take care of the rest of my life.',
    'I know how it feels to be stressed and depleted by the never-ending daily mess, and to be drowning in it. Most importantly, I know the sense of relief, control, and ease that it brings to have that mess off of your mind, and off of your shoulders.',
    'Self-started and self-run, GIST is a small cleaning and consultation service with a goal driven by that understanding: to help you feel that same sense of relief, control, and ease.',
  ],
  inclusivity: [
    'One of GIST’s core functional principles is individual needs. The key word in that sentence is individual.',
    'GIST is queer-friendly, disability-friendly, and mental health-inclusive.',
    'GIST is also a no-shame space. We understand that we all have unique circumstances, both external and internal, that affect how we handle our spaces — and the depth or nature of the help we may need to handle them like we want to.',
  ],
  proprietor: [
    'My name is Dustin Sipes, and I am the owner/manager of GIST Cleaning.',
    'I started this business because I know what it feels like to be on the other end of the services I want to provide: never quite able to keep up, surrounded by mess, with a busy life and busier brain that made it hard to form effective habits around cleaning or organizing.',
    'I have always loved organizing, rearranging, and freshening things up. There are few sights that make me sigh in satisfaction more than a clean, well-arranged room — and I’m excited to bring all that knowledge and experience to bear for you!',
    'I currently reside in Moscow, ID with my four children.',
  ],
}

export const UPDATES = [
  {
    date: '2026-11-23',
    title: 'New: the GIST Cleaning Hub (concept)',
    body: 'A prototype of one app for everything GIST: book and manage cleanings, pay invoices, and — for our team — schedules, time tracking, pay and every SOP in one place.',
    points: ['Clients: request a cleaning, see upcoming visits, cancel with the fee shown up-front, pay invoices.', 'Team: geofenced clock-in, your schedule, availability, paystubs, PTO, documents and each home’s checklist.'],
  },
  {
    date: '2025-12-31',
    title: 'Hiring our first employee, new rate, payment methods',
    body: 'Season’s Greetings! Thank you for another year of trust and collaboration. Three important updates as we head into 2026:',
    points: [
      'Hiring our first employee — personal training (Dustin shadows the first one or two cleanings at no charge), home-specific SOP notes and checklists, careful hiring with background checks, and strong incentives: competitive starting wage, full tips, mileage and laundry reimbursement, accrued PTO, merit-based raises and all supplies.',
      'Rate adjustment effective January 12, 2026: $37/hour (e.g. 2 hours $60 → $74; 2.5 hours $75 → $92.50; 3 hours $90 → $111). It covers a starting wage of $18/hour, supplies & benefits, payroll & taxes, and keeping GIST a licensed and insured LLC.',
      'Payment methods: once our employee starts, all clients pay via Venmo, Zelle, or Square, due within 24 hours of receiving an invoice.',
    ],
  },
]

export const ORG_GALLERY = {
  title: 'Before & After: Game & Hobby Room',
  intro: 'A spare bedroom meant to be a game & hobby room had become a catch-all. Over 12 hours, shelves were re-sorted by category with almost no new supplies, files sorted into labelled folders, office supplies condensed into one drawer, and the craft desk uncovered — every usable item stored neatly in its place.',
  steps: [
    { phase: 'Before', text: 'Closet with some shelving; Warhammer 40k collection scattered and spatially inefficient.' },
    { phase: 'Before', text: 'Bookcases mixing game rulebooks, RPG guides, novels, cookbooks, crafting books and binders.' },
    { phase: 'Before', text: 'A desk buried under hobby, craft and writing miscellany; a disjointed three-shelf supply unit.' },
    { phase: 'Before', text: 'Filing cabinet chock-full of documents, old schoolwork, electronics and office supplies.' },
    { phase: 'After', text: 'Computer desk cleared, with labelled bins for headphones and electronics.' },
    { phase: 'After', text: 'Papers sorted by category into labelled folders — one drawer for vital documents, one for personal/storage.' },
    { phase: 'After', text: 'Shelves labelled by category, most-used items placed most ergonomically — reorganized almost entirely with existing storage.' },
    { phase: 'After', text: 'The whole model collection visible in one place; books findable in seconds. Total time: 12 hours.' },
  ],
  before: './img/org-before.jpg',
  photos: Array.from({ length: 14 }, (_, i) => `./img/org-${String(i + 1).padStart(2, '0')}.jpg`),
}

// Logo and photos come from gistcleaning.com (used with the owner's blessing — this hub is built for GIST).
export const IMAGES = {
  logo: './gist-logo.svg',
  hero: './img/hero-shelves.jpg',
  owner: './img/dustin.jpg',
  yarn: './img/yarn.jpg',
  cleaning: './img/svc-cleaning.jpg',
  surface: './img/svc-surface.jpg',
  organization: './img/svc-organization.jpg',
  business: './img/svc-business.jpg',
  commercial: './img/svc-commercial.jpg',
  balance: './img/svc-balance.jpg',
}

export const HIRING = {
  title: 'GIST Cleaning is hiring!',
  body: 'We’re looking for reliable, detail-minded House Cleaners (regular and project/substitute). $18/hour starting, full tips, mileage + laundry reimbursement, $75 supply card and $50 gas card each pay period, PTO that accrues from day one, and merit-based raises with reviews every 6 months.',
  perks: ['$18/hr starting wage', 'Full tips', 'Mileage & laundry reimbursement', '$75 supply card + $50 gas card per pay period', 'PTO: 1 hour per 25 worked', 'Reviews & raises every 6 months', 'Schedules published a week ahead', 'Every home has a written SOP + checklist'],
}
