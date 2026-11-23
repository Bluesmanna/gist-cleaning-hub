"""Performance + visual audit of a deployed build: cold load on a throttled 4G phone, transfer sizes,
biggest assets, slow route changes, and screenshots of key screens at phone and desktop width.
Usage: python tools/perf_audit.py <base_url> <out_dir>"""
import sys, os, json, time
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SHOTS = ['', 'services', 'pricing', 'book', 'docs', 'docs/sop-general', 'login']
ROLE_SHOTS = {'Jamie': ['app', 'app/time', 'app/pay', 'app/schedule'], 'Dustin': ['app', 'app/payroll', 'app/schedule', 'app/reports'],
              'Aspen': ['app', 'app/invoices']}
report = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    # 1. cold load, throttled "fast 4G" phone, empty cache
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 1.6e6 / 8, 'uploadThroughput': 750e3 / 8})
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    sizes = []
    pg.on('response', lambda r: sizes.append(r.url))
    t = time.time(); pg.goto(BASE, wait_until='load'); load = time.time() - t
    pg.wait_for_timeout(1500)
    nav = pg.evaluate("""() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByType('paint');
      const res = performance.getEntriesByType('resource').map(r => ({u: r.name.split('/').slice(-1)[0].slice(0,60), kb: Math.round(r.transferSize/1024), dkb: Math.round(r.decodedBodySize/1024), ms: Math.round(r.duration)}));
      return {dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round((p.find(x => x.name==='first-contentful-paint')||{}).startTime||0),
              total_kb: res.reduce((a,r)=>a+r.kb, 0) + Math.round(n.transferSize/1024), res: res.sort((a,b)=>b.kb-a.kb).slice(0,12)} }""")
    lcp = pg.evaluate("""() => new Promise(r => { new PerformanceObserver(l => { const e = l.getEntries(); r(Math.round(e[e.length-1].startTime)) }).observe({type:'largest-contentful-paint', buffered:true}); setTimeout(()=>r(-1), 2000) })""")
    cls = pg.evaluate("""() => new Promise(r => { let s=0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) s+=e.value }).observe({type:'layout-shift', buffered:true}); setTimeout(()=>r(Math.round(s*1000)/1000), 1000) })""")
    report['cold_4g_phone'] = dict(nav, lcp=lcp, cls=cls, wall_s=round(load, 2))
    ctx.close()
    # 2. screenshots + route-change timing, phone and desktop, no throttling
    for label, vp in [('phone', {'width': 390, 'height': 844}), ('desktop', {'width': 1366, 'height': 860})]:
        ctx = b.new_context(viewport=vp); pg = ctx.new_page(); slow = []
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        def shot(path, name):
            t = time.time(); pg.goto(BASE + '#/' + path); pg.wait_for_load_state('networkidle'); ms = round((time.time() - t) * 1000)
            if ms > 1500: slow.append((path, ms))
            for attempt in range(3):  # headless Chrome screenshots occasionally stall; retry
                try:
                    pg.screenshot(path=os.path.join(OUT, f'{label}-{name}.png'), animations='disabled', timeout=10000); break
                except Exception:
                    pg.wait_for_timeout(500)
        for s in SHOTS: shot(s, 'pub-' + (s.replace('/', '_') or 'home'))
        for who, routes in ROLE_SHOTS.items():
            pg.goto(BASE + '#/login'); pg.wait_for_timeout(500)
            pg.locator('button.btn.block', has_text=who).first.click(); pg.wait_for_timeout(500)
            for r in routes: shot(r, who + '-' + r.replace('/', '_'))
            pg.evaluate("localStorage.clear()")
        report[label] = {'slow_routes': slow, 'page_errors': errs}
        ctx.close()
    b.close()
print(json.dumps(report, indent=1))
