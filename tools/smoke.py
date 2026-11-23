"""Smoke-test every route for every demo role in headless Chrome; report console errors and blank pages.
Usage: python tools/smoke.py [base_url]   (default http://127.0.0.1:4173/)"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
PUBLIC = ['', 'about', 'services', 'pricing', 'organization', 'business', 'contact', 'policies', 'updates', 'careers', 'book', 'login', 'docs', 'docs/sop-general', 'about-this-app']
ROLES = {
    'u_owner': ['', 'schedule', 'approvals', 'payroll', 'team', 'team/u_jamie', 'clients', 'bookings', 'invoices', 'reports', 'messages', 'docs', 'assistant', 'settings', 'tasks'],
    'u_jamie': ['', 'schedule', 'time', 'pay', 'time-off', 'availability', 'expenses', 'cards', 'tasks', 'onboarding', 'docs', 'docs/handbook-rct', 'messages', 'assistant', 'profile'],
    'u_taylor': ['', 'onboarding'],
    'u_client1': ['', 'visits', 'request', 'invoices', 'messages', 'preferences', 'assistant'],
}
problems = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' ' + (e.stack or '')[:600]))
    def visit(path, label):
        errs.clear()
        pg.goto(BASE + '#/' + path)
        pg.wait_for_timeout(450)
        txt = pg.inner_text('body')
        if len(txt.strip()) < 80: problems.append((label, path, 'blank page'))
        if errs: problems.append((label, path, errs[:3]))
    for r in PUBLIC: visit(r, 'public')
    for uid, routes in ROLES.items():
        pg.goto(BASE + '#/login'); pg.reload(); pg.wait_for_timeout(600)
        btns = pg.locator('button.btn.block')
        names = pg.evaluate("""() => [...document.querySelectorAll('button.btn.block')].map(b => b.innerText)""")
        name = {'u_owner': 'Dustin', 'u_jamie': 'Jamie', 'u_taylor': 'Taylor', 'u_client1': 'Aspen'}[uid]
        idx = next((i for i, n in enumerate(names) if name in n), None)
        if idx is None: problems.append((uid, 'login', f'no button; have {names}')); continue
        btns.nth(idx).click(); pg.wait_for_timeout(500)
        for r in routes: visit('app/' + r if r else 'app', uid)
    pg.screenshot(path=sys.argv[2] if len(sys.argv) > 2 else 'smoke-last.png')
    b.close()
print(json.dumps(problems, indent=1) if problems else 'ALL OK')
