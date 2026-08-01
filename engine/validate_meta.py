import json, subprocess, urllib.request, math, sys
sys.path.insert(0, r"C:/hermes-projects/poolr-app/src")
from poolr.meta.analysis import MetaAnalysis

ENGINE = "http://127.0.0.1:5180/api/meta"

def call_csharp(studies, model="random", measure="OR", method="DL", subgroup="none", pub_bias="none"):
    req = {"model": model, "measure": measure, "method": method,
           "subgroup": subgroup, "pub_bias": pub_bias, "data": studies}
    body = json.dumps(req).encode()
    r = urllib.request.Request(ENGINE, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=10) as resp:
        return json.load(resp)

def call_python(studies, model="random", measure="OR", method="DL", subgroup="none", pub_bias="none"):
    return MetaAnalysis(model=model, measure=measure, method=method, subgroup=subgroup, pub_bias=pub_bias).run(studies)

CASES = [
    ("OR fixed", dict(model="fixed", measure="OR", method="DL"), [
        {"study":"S1","type":"binary","int_events":15,"int_n":100,"ctrl_events":25,"ctrl_n":100},
        {"study":"S2","type":"binary","int_events":8,"int_n":50,"ctrl_events":18,"ctrl_n":50},
        {"study":"S3","type":"binary","int_events":30,"int_n":200,"ctrl_events":45,"ctrl_n":200}]),
    ("OR random DL", dict(model="random", measure="OR", method="DL"), [
        {"study":"A","type":"binary","int_events":15,"int_n":100,"ctrl_events":25,"ctrl_n":100},
        {"study":"B","type":"binary","int_events":8,"int_n":50,"ctrl_events":18,"ctrl_n":50},
        {"study":"C","type":"binary","int_events":30,"int_n":200,"ctrl_events":45,"ctrl_n":200}]),
    ("RR random", dict(model="random", measure="RR", method="DL"), [
        {"study":"A","type":"binary","int_events":10,"int_n":100,"ctrl_events":20,"ctrl_n":100},
        {"study":"B","type":"binary","int_events":5,"int_n":50,"ctrl_events":15,"ctrl_n":50}]),
    ("RD random", dict(model="random", measure="RD", method="DL"), [
        {"study":"A","type":"binary","int_events":10,"int_n":100,"ctrl_events":20,"ctrl_n":100},
        {"study":"B","type":"binary","int_events":5,"int_n":50,"ctrl_events":15,"ctrl_n":50}]),
    ("MD fixed", dict(model="fixed", measure="MD", method="DL"), [
        {"study":"A","type":"continuous","int_mean":10.5,"int_sd":2.1,"int_n":50,"ctrl_mean":12.3,"ctrl_sd":2.5,"ctrl_n":50},
        {"study":"B","type":"continuous","int_mean":8.2,"int_sd":1.8,"int_n":40,"ctrl_mean":9.8,"ctrl_sd":2.0,"ctrl_n":40}]),
    ("SMD random", dict(model="random", measure="SMD", method="DL"), [
        {"study":"A","type":"continuous","int_mean":10.5,"int_sd":2.1,"int_n":50,"ctrl_mean":12.3,"ctrl_sd":2.5,"ctrl_n":50},
        {"study":"B","type":"continuous","int_mean":8.2,"int_sd":1.8,"int_n":40,"ctrl_mean":9.8,"ctrl_sd":2.0,"ctrl_n":40}]),
    ("HR random", dict(model="random", measure="HR", method="DL"), [
        {"study":"A","type":"survival","hr":0.75,"hr_lower":0.55,"hr_upper":1.02},
        {"study":"B","type":"survival","hr":0.82,"hr_lower":0.62,"hr_upper":1.08},
        {"study":"C","type":"survival","hr":0.90,"hr_lower":0.70,"hr_upper":1.15}]),
    ("OR random REML", dict(model="random", measure="OR", method="REML"), [
        {"study":"A","type":"binary","int_events":5,"int_n":100,"ctrl_events":20,"ctrl_n":100},
        {"study":"B","type":"binary","int_events":30,"int_n":100,"ctrl_events":10,"ctrl_n":100},
        {"study":"C","type":"binary","int_events":2,"int_n":100,"ctrl_events":25,"ctrl_n":100}]),
    ("OR random PM", dict(model="random", measure="OR", method="PM"), [
        {"study":"A","type":"binary","int_events":5,"int_n":100,"ctrl_events":20,"ctrl_n":100},
        {"study":"B","type":"binary","int_events":30,"int_n":100,"ctrl_events":10,"ctrl_n":100},
        {"study":"C","type":"binary","int_events":2,"int_n":100,"ctrl_events":25,"ctrl_n":100}]),
    ("OR random HS", dict(model="random", measure="OR", method="HS"), [
        {"study":"A","type":"binary","int_events":5,"int_n":100,"ctrl_events":20,"ctrl_n":100},
        {"study":"B","type":"binary","int_events":30,"int_n":100,"ctrl_events":10,"ctrl_n":100},
        {"study":"C","type":"binary","int_events":2,"int_n":100,"ctrl_events":25,"ctrl_n":100}]),
    ("subgroup", dict(model="random", measure="OR", method="DL", subgroup="design"), [
        {"study":"RCT1","type":"binary","design":"RCT","int_events":10,"int_n":100,"ctrl_events":20,"ctrl_n":100},
        {"study":"RCT2","type":"binary","design":"RCT","int_events":8,"int_n":80,"ctrl_events":15,"ctrl_n":80},
        {"study":"C1","type":"binary","design":"Cohort","int_events":25,"int_n":200,"ctrl_events":40,"ctrl_n":200},
        {"study":"C2","type":"binary","design":"Cohort","int_events":30,"int_n":180,"ctrl_events":35,"ctrl_n":180}]),
    ("pub_bias egger", dict(model="random", measure="OR", method="DL", pub_bias="egger"), [
        {"study":f"S{i}","type":"binary","int_events":10,"int_n":100,"ctrl_events":10,"ctrl_n":100} for i in range(10)]),
]

max_diff = 0.0
fails = []
for name, kw, studies in CASES:
    py = call_python(studies, **kw)
    cs = call_csharp(studies, **kw)
    # compare pooled
    pf, cf = py["pooled"]["effect"], cs["pooled"]["effect"]
    pcl, ccl = py["pooled"]["ci_lower"], cs["pooled"]["ci_lower"]
    pcu, ccu = py["pooled"]["ci_upper"], cs["pooled"]["ci_upper"]
    pi2, ci2 = py["heterogeneity"]["i2"], cs["heterogeneity"]["i2"]
    ptau, ctau = py["heterogeneity"]["tau2"], cs["heterogeneity"]["tau2"]
    pk, ck = py["k"], cs["k"]
    tol = max(1e-3, abs(pf)*1e-3)
    ok = (abs(pf-cf) < tol and abs(pcl-ccl) < tol and abs(pcu-ccu) < tol
          and abs(pi2-ci2) < 1.0 and abs(ptau-ctau) < max(1e-2, abs(ptau)*1e-2) and pk == ck)
    d = max(abs(pf-cf), abs(pcl-ccl), abs(pcu-ccu), abs(pi2-ci2), abs(ptau-ctau))
    max_diff = max(max_diff, d)
    if not ok:
        fails.append((name, pf, cf, pcl, ccl, pcu, ccu, pi2, ci2, ptau, ctau))
    print(f"{name:18s} pooled={cf:.5f} (py {pf:.5f})  i2={ci2:.1f}(py {pi2:.1f})  tau2={ctau:.5f}(py {ptau:.5f})  {'OK' if ok else 'FAIL'}")

print(f"\nMAX_DIFF={max_diff:.6f}")
if fails:
    print("FAILURES:")
    for f in fails: print(f)
    sys.exit(1)
else:
    print("ALL CASES MATCH (within tolerance)")
