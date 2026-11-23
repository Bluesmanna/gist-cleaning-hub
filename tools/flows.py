"""End-to-end workflow test of the demo in headless Chrome. Each step prints OK / ERR / FAIL.
Usage: python tools/flows.py [base_url] [screenshot_dir]"""
import os
import re
import subprocess
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '.'
os.makedirs(SHOTS, exist_ok=True)
results = []
errs = []


def shot(pg, name):
    pg.screenshot(path=os.path.join(SHOTS, name + '.png'))


def run(name, fn, pg):
    errs.clear()
    try:
        fn(pg)
        results.append(('OK' if not errs else 'ERR', name, errs[:2]))
    except Exception as e:  # noqa: BLE001 - report and continue
        results.append(('FAIL', name, [str(e).splitlines()[0][:300]] + errs[:2]))
        shot(pg, 'fail-' + name)


# A real answer: the greeting is gone and the typing dots have been replaced (the live
# assistant takes a few seconds).
ANSWER = '.ai-msgs .bubble.assistant:not(:has(.typing))'


def wait_answer(pg):
    pg.wait_for_selector('.ai-msgs .bubble.user', timeout=5000)
    pg.wait_for_selector(ANSWER, timeout=90000)


def go(pg, path):
    pg.goto(BASE + '#/' + path)
    pg.wait_for_timeout(400)


def login(pg, who):
    go(pg, 'login')
    pg.reload()
    pg.wait_for_timeout(500)
    # the demo panel shows one kind of account at a time: pick the role tab first
    tab = {'Dustin': 'Owner', 'Aspen': 'Client'}.get(who, 'Cleaning team')
    pg.get_by_role('tab', name=tab).click()
    pg.locator('.demo-card button.btn.block', has_text=who).first.click()
    pg.wait_for_timeout(500)


def click(pg, text, scope=None, exact=False):
    (scope or pg).get_by_role('button', name=text, exact=exact).first.click()
    pg.wait_for_timeout(350)


def toast_has(pg, text):
    pg.wait_for_selector(f'.toast:has-text("{text}")', timeout=4000)


def public_booking(pg):
    go(pg, 'book')
    form = pg.locator('form').last
    for inp in form.locator('input[required], textarea[required]').all():
        t = inp.get_attribute('type') or 'text'
        if t == 'date':
            continue
        inp.fill('test@example.com' if t == 'email' else '208-555-0100' if t == 'tel' else 'Flow Test Person')
    click(pg, 'Send request')
    pg.wait_for_selector('text=/thank|received|got it|request sent/i', timeout=4000)
    shot(pg, 'public-booked')


def emp_clock(pg):
    login(pg, 'Jamie')
    go(pg, 'app')
    if pg.get_by_role('button', name='Clock in').count():
        click(pg, 'Clock in')
        pg.wait_for_timeout(1500)
        click(pg, 'Clock out')
        pg.wait_for_timeout(1500)
    shot(pg, 'emp-dashboard')


def emp_submit(pg):
    go(pg, 'app/time')
    b = pg.get_by_role('button', name='Submit hours')
    if b.count() and b.first.is_enabled():
        b.first.click()
        pg.wait_for_timeout(600)
    shot(pg, 'emp-time')


def emp_pto(pg):
    go(pg, 'app/time-off')
    f = pg.locator('form').first
    f.locator('input[required]').last.fill('Flow test day off')
    click(pg, 'Send request', f)


def emp_stub_ai(pg):
    go(pg, 'app/pay')
    pg.locator('.list-item').filter(has_text='$').first.click()
    pg.wait_for_timeout(500)
    if not pg.locator('.modal').count():
        pg.get_by_role('button', name='View').first.click()
    click(pg, 'Explain')
    pg.wait_for_selector('.modal .md', timeout=90000)
    shot(pg, 'emp-stub-ai')


def owner_approve(pg):
    login(pg, 'Dustin')
    go(pg, 'app/approvals')
    while pg.get_by_role('button', name='Approve all').count():
        click(pg, 'Approve all')
    pg.get_by_role('tab', name='Time off').first.click()
    pg.wait_for_timeout(300)
    while pg.get_by_role('button', name='Approve', exact=True).count():
        click(pg, 'Approve', exact=True)


def owner_payroll(pg):
    go(pg, 'app/payroll')
    shot(pg, 'owner-payroll')
    b = pg.get_by_role('button', name='Process payroll')
    if not (b.count() and b.first.is_enabled()):
        raise Exception('Process payroll button missing or disabled')
    b.first.click()
    toast_has(pg, 'Payroll processed')


def owner_schedule(pg):
    go(pg, 'app/schedule')
    click(pg, 'Add shift')
    pg.locator('.modal').get_by_role('button', name='Save').click()
    toast_has(pg, 'Shift saved')
    pg.wait_for_timeout(300)
    click(pg, 'Publish')
    shot(pg, 'owner-schedule')


def owner_booking(pg):
    go(pg, 'app/bookings')
    click(pg, 'Make client & schedule')
    pg.wait_for_url('**/app/clients/*', timeout=4000)


def owner_invoices(pg):
    go(pg, 'app/invoices')
    click(pg, 'Invoice completed cleanings')
    pg.locator('.modal button.sage').last.click()
    pg.wait_for_timeout(500)
    shot(pg, 'owner-invoices')


def owner_message(pg):
    go(pg, 'app/messages')
    pg.locator('.msg-layout .list-item').first.click()
    pg.wait_for_timeout(300)
    pg.locator('.chat-card textarea').first.fill('Flow test message')
    pg.keyboard.press('Enter')
    pg.wait_for_selector('.bubble:has-text("Flow test message")', timeout=3000)


def assistant(pg):
    go(pg, 'app/assistant')
    pg.locator('.ai-input textarea').fill('What is the cancellation fee with 10 hours notice?')
    pg.keyboard.press('Enter')
    wait_answer(pg)
    pg.wait_for_timeout(500)
    shot(pg, 'assistant')
    if not pg.locator('.ai-head .t', has_text='Team Assistant').count():
        raise Exception('owner did not get the team assistant')
    note = ' '.join(pg.locator('.ai-msgs .note').all_inner_texts())
    if 'unavailable' in note:
        raise Exception('live assistant fell back: ' + note[:200])


def client_pay(pg):
    login(pg, 'Aspen')
    go(pg, 'app/invoices')
    b = pg.get_by_role('button', name='Pay', exact=True)
    if not b.count():
        raise Exception('no open invoice to pay')
    b.first.click()
    pg.wait_for_timeout(300)
    click(pg, 'I paid with venmo')
    toast_has(pg, 'Marked paid')


def client_cancel(pg):
    go(pg, 'app/visits')
    click(pg, 'Cancel / reschedule')
    shot(pg, 'client-cancel')
    pg.locator('.modal').get_by_role('button', name='Cancel visit').click()
    toast_has(pg, 'Visit cancelled')


def mobile_overflow(pg):
    pg.set_viewport_size({'width': 390, 'height': 844})
    bad = []
    width = '() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]'
    plan = [
        ('Dustin', ['app', 'app/schedule', 'app/payroll', 'app/approvals', 'app/clients', 'app/invoices', 'app/reports', 'app/messages', 'app/settings', 'app/team/u_jamie']),
        ('Jamie', ['app', 'app/schedule', 'app/time', 'app/pay', 'app/onboarding', 'app/expenses', 'app/docs/sop-general']),
        ('Aspen', ['app', 'app/visits', 'app/invoices', 'app/preferences', 'app/messages']),
    ]
    for who, routes in plan:
        login(pg, who)
        for r in routes:
            go(pg, r)
            w = pg.evaluate(width)
            if w[0] > w[1] + 2:
                bad.append(f'{who}:{r} {w}')
    for r in ['', 'services', 'pricing', 'book', 'about', 'organization', 'careers']:
        go(pg, r)
        w = pg.evaluate(width)
        if w[0] > w[1] + 2:
            bad.append(f'public:{r} {w}')
    login(pg, 'Jamie')
    go(pg, 'app')
    shot(pg, 'mobile-emp')
    go(pg, '')
    shot(pg, 'mobile-home')
    if bad:
        raise Exception('horizontal overflow: ' + '; '.join(bad))


def sign_in(pg):
    """One real sign-in form for everyone; the demo panel is separate, labelled, one role at a time."""
    go(pg, 'login')
    pg.reload()
    pg.wait_for_timeout(500)
    demo = pg.locator('.demo-card')
    if not demo.locator('.badge', has_text='Demo only').count():
        raise Exception('demo panel is not labelled Demo only')
    for tab, yes, no in [('Client', 'Aspen', 'Jamie'), ('Cleaning team', 'Jamie', 'Dustin'), ('Owner', 'Dustin', 'Aspen')]:
        pg.get_by_role('tab', name=tab).click()
        pg.wait_for_timeout(150)
        if not demo.locator('button.btn.block', has_text=yes).count() or demo.locator('button.btn.block', has_text=no).count():
            raise Exception(f'{tab} tab shows the wrong accounts')
    form = pg.locator('form.login-real')
    form.locator('input[type=email]').fill('nobody@example.com')
    form.get_by_role('button', name='Email me a sign-in link').click()
    pg.wait_for_selector('form.login-real [role=alert]', timeout=2000)
    form.locator('input[type=email]').fill('Jamie@gist.demo')
    form.get_by_role('button', name='Email me a sign-in link').click()
    pg.wait_for_timeout(600)
    if not pg.url.endswith('#/app'):
        raise Exception('email sign-in did not open the app: ' + pg.url)
    if not pg.locator('.role-switch .demo-chip', has_text='Demo').count():
        raise Exception('person switcher is not marked Demo')
    shot(pg, 'sign-in-email')


def header_buttons(pg):
    """Website header: always 'Sign in' (never 'Open app'), plus a Get app link to the APK."""
    for who in [None, 'Jamie']:
        if who:
            login(pg, who)
        go(pg, '')
        nav = pg.locator('.site-nav')
        if nav.get_by_text('Open app').count() or not nav.get_by_role('link', name='Sign in').count():
            raise Exception('header label wrong (signed in: %s)' % bool(who))
        href = nav.locator('a.get-app').get_attribute('href') or ''
        if not href.endswith('/releases/latest/download/gist-cleaning-hub.apk'):
            raise Exception('Get app link wrong: ' + href)
    shot(pg, 'header-buttons')
    pg.get_by_role('button', name='Sign out').first.click() if pg.url.find('/app') >= 0 else None


def docs_gated(pg):
    """Company docs are staff-only: hidden from visitors (route, footer, assistant) and clients."""
    def sign_out():
        pg.get_by_role('button', name='Sign out').first.click()
        pg.wait_for_timeout(400)
    login(pg, 'Jamie')
    sign_out()
    go(pg, 'docs/handbook-rct')
    if '#/login' not in pg.url:
        raise Exception('signed-out doc link did not go to sign-in: ' + pg.url)
    pg.wait_for_selector('.notice:has-text("for the GIST team")', timeout=3000)
    if pg.locator('footer a', has_text='Company docs').count():
        raise Exception('public footer still links to company docs')
    pg.locator('button.btn.block', has_text='Jamie').first.click()
    pg.wait_for_timeout(600)
    if not pg.url.endswith('#/app/docs/handbook-rct'):
        raise Exception('after sign-in did not land on the doc: ' + pg.url)
    pg.wait_for_selector('h1, h2', timeout=3000)
    sign_out()
    go(pg, '')
    pg.locator('.ai-fab').click()
    pg.locator('.ai-input textarea').fill('What does the employee handbook say about supplies and the supply card?')
    pg.keyboard.press('Enter')
    wait_answer(pg)
    pg.wait_for_timeout(500)
    if pg.locator('.ai-head .t', has_text='Team').count():
        raise Exception('visitor got the team assistant')
    chips = ' '.join(pg.locator('.ai-msgs .src').all_inner_texts())
    hrefs = pg.eval_on_selector_all('.ai-msgs a', 'els => els.map(e => e.getAttribute("href") || "")')
    if 'Handbook' in chips or any('/app/docs' in h for h in hrefs):
        raise Exception('visitor assistant quoted internal docs')
    shot(pg, 'docs-gated-visitor-ai')
    login(pg, 'Aspen')
    go(pg, 'app/docs/handbook-rct')
    if not pg.url.endswith('#/app'):
        raise Exception('client reached a company doc: ' + pg.url)


# On a machine inside Rob's tailnet, Chrome resolves the live assistant's ts.net name to a
# private 100.x address and Local Network Access blocks it from a public page. Pin it to the
# public Funnel address so the test sees what an outside visitor sees.
LIVE_HOST = 'robert.tail48e80c.ts.net'


def public_ip(host):
    """Ask a public resolver (the system one answers tailnet names privately)."""
    try:
        out = subprocess.run(['nslookup', host, '1.1.1.1'], capture_output=True, text=True, timeout=15).stdout
    except (OSError, subprocess.SubprocessError):
        return ''
    ips = re.findall(r'(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.])', out.split(host, 1)[-1])
    return next((ip for ip in ips if not ip.startswith('100.')), '')


pub_ip = public_ip(LIVE_HOST)
chrome_args = [f'--host-resolver-rules=MAP {LIVE_HOST} {pub_ip}'] if pub_ip and not pub_ip.startswith('100.') else []

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=chrome_args)
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, geolocation={'latitude': 46.73, 'longitude': -117.0}, permissions=['geolocation'])
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text[:200]))
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:200]))
    pg.on('dialog', lambda d: d.accept())
    go(pg, '')
    for f in [public_booking, emp_clock, emp_submit, emp_pto, emp_stub_ai, owner_approve, owner_payroll, owner_schedule, owner_booking,
              owner_invoices, owner_message, assistant, client_pay, client_cancel, sign_in, header_buttons, docs_gated, mobile_overflow]:
        run(f.__name__, f, pg)
    b.close()
for r in results:
    print(*r)
