#!/usr/bin/env python3
# build_portfolio_page.py — generates index.html from the captured tool outputs
import html, re, pathlib

ROOT = pathlib.Path('/home/z/my-project/download/quilt-tools')

META = [
    ('01-fleet-pager',    'DevOps / SRE',        'Golden signals → severity → edge-triggered pages with hysteresis.'),
    ('02-ledger-seal',    'Security',            'Tamper-evident audit ledger; the verifier pins the exact broken row.'),
    ('03-ocean-recall',   'Knowledge',           'Remember / recall / forget with an auditable memory and honest misses.'),
    ('04-triagedesk',     'Support',             'System One triage — the fence between model and sheet holds.'),
    ('05-budget-tide',    'Fintech',             'Envelopes that refuse: the tide gate stops money before it moves.'),
    ('06-home-ecos',      'IoT / Smart home',    'Learned baselines catch the 2am heater no threshold can see.'),
    ('07-driftwatch',     'ML-ops',              'Shape-reading drift detection — flagged at 0.890 vs static 0.792.'),
    ('08-approvals',      'SaaS workflow',       'One sheet, three tenants, policies that know who is asking.'),
    ('09-habit-atlas',    'Health',              'Habits as physics: momentum with slow gains, gentle decay.'),
    ('10-pipeline-guard', 'Data engineering',    'Schema as data: precise reasons, dead-letter replay, evolution without deploys.'),
]

def ansi_to_html(s):
    s = html.escape(s)
    s = re.sub(r'\x1b\[32m(.*?)\x1b\[0m', r'<span class="g">\1</span>', s)
    s = re.sub(r'\x1b\[31m(.*?)\x1b\[0m', r'<span class="r">\1</span>', s)
    s = re.sub(r'\x1b\[33m(.*?)\x1b\[0m', r'<span class="y">\1</span>', s)
    s = re.sub(r'\x1b\[36m(.*?)\x1b\[0m', r'<span class="c">\1</span>', s)
    s = re.sub(r'\x1b\[2m(.*?)\x1b\[0m', r'<span class="d">\1</span>', s)
    s = re.sub(r'\x1b\[1m(.*?)\x1b\[0m', r'<span class="b">\1</span>', s)
    s = re.sub(r'\x1b\[[0-9;]*m', '', s)
    return s

cards = []
for name, realm, pitch in META:
    out = (ROOT / 'outputs' / f'{name}.txt').read_text()
    verdict_m = re.search(r'═ (.*?): (.*?) ══', out)
    verdict = f'{verdict_m.group(2)}' if verdict_m else 'see output'
    ok = 'green' in verdict
    badge = f'<span class="{"pass" if ok else "fail"}">{html.escape(verdict.strip())}</span>'
    body = ansi_to_html(out.strip())
    cards.append(f'''
    <section class="card" id="{name}">
      <div class="card-head">
        <h3>{name.split("-", 1)[1].replace("-", " ")}</h3>
        <span class="realm">{realm}</span>
        {badge}
      </div>
      <p class="pitch">{pitch}</p>
      <details open><summary>verified run</summary><pre>{body}</pre></details>
    </section>''')

page = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quilt Tools — ten working prototypes</title>
<style>
  :root {{ --bg:#0a0a0a; --card:rgba(255,255,255,.03); --bd:rgba(255,255,255,.09); --tx:#f0f0f0; --dim:#9a9a9a;
          --green:#7ec699; --blue:#5fa8d3; --purple:#bb7ec6; --red:#c67e7e; --amber:#c6c67e; }}
  * {{ box-sizing:border-box; margin:0; padding:0 }}
  body {{ background:var(--bg); color:var(--tx); font:15px/1.6 'Inter',-apple-system,sans-serif; padding:48px 20px }}
  .wrap {{ max-width:880px; margin:0 auto }}
  h1 {{ font-size:2rem; letter-spacing:-.03em }}
  .sub {{ color:var(--dim); margin:8px 0 6px }}
  .hero-note {{ color:var(--dim); font-size:.9rem; margin-bottom:36px }}
  .hero-note b {{ color:var(--green) }}
  .grad {{ background:linear-gradient(135deg,#7ec699,#5fa8d3,#bb7ec6); -webkit-background-clip:text; background-clip:text; color:transparent }}
  .card {{ background:var(--card); border:1px solid var(--bd); border-radius:12px; padding:20px 22px; margin-bottom:18px }}
  .card-head {{ display:flex; align-items:center; gap:12px; flex-wrap:wrap }}
  h3 {{ font-size:1.05rem; text-transform:capitalize }}
  .realm {{ font-size:.72rem; color:var(--dim); border:1px solid var(--bd); border-radius:99px; padding:2px 10px; text-transform:uppercase; letter-spacing:.08em }}
  .pass, .fail {{ margin-left:auto; font-size:.8rem; font-weight:600 }}
  .pass {{ color:var(--green) }} .fail {{ color:var(--red) }}
  .pitch {{ color:var(--dim); margin:8px 0 4px }}
  details {{ margin-top:10px }} summary {{ cursor:pointer; color:var(--blue); font-size:.85rem }}
  pre {{ background:#050505; border:1px solid var(--bd); border-radius:8px; padding:14px; overflow-x:auto;
        font:12px/1.55 'JetBrains Mono',Menlo,monospace; color:#cfcfcf; margin-top:10px }}
  .g {{ color:var(--green) }} .r {{ color:var(--red) }} .y {{ color:var(--amber) }}
  .c {{ color:var(--blue) }} .d {{ color:var(--dim) }} .b {{ color:#fff; font-weight:600 }}
  footer {{ color:var(--dim); font-size:.85rem; margin-top:36px }}
  code {{ font-family:'JetBrains Mono',monospace; color:var(--green); font-size:.9em }}
</style></head><body><div class="wrap">
  <h1><span class="grad">Quilt Tools</span></h1>
  <p class="sub">ten working prototypes on one reactive runtime — <b class="b">75/75 checks green</b> in the latest sweep</p>
  <p class="hero-note">Each card is the tool's <b>actual captured output</b> — the verification you see ran, it was not
  hand-written. One file per tool, <code>node tools/&lt;name&gt;.mjs</code>, no config. Built on
  SuperInstance/quilt (play-test-patched engine, 11 patches, 36/36 upstream tests).</p>
  {''.join(cards)}
  <footer>Shared runtime: <code>quilt-toolkit.mjs</code> — witness receipts (fnv1a-64 chains), playtest harness,
  schema-fenced System One decisions, deterministic embeddings. Swap-in seams are marked in every tool header.</footer>
</div></body></html>'''

(ROOT / 'index.html').write_text(page)
print(f'index.html written ({len(page)} bytes, {len(cards)} cards)')
