"""Składa podgląd-artefakt z oryginalnej strony + narzędzi (wszystko inline, CDN jak w oryginale).
python3 -I tools/build_artifact.py <oryginał.html> <wynik.html>
Dokłada: voxMerge (statyczne kostki), makeVoxPost (kontur + AO + gradacja w świecie), makeBpPaper (papier blueprint).
"""
import sys, os
D = os.path.dirname(os.path.abspath(__file__))
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
inl = lambda f: '<script>\n' + open(os.path.join(D, f)).read() + '\n</script>'
anchor = '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/lines/Line2.js"></script>'
if anchor not in s: anchor = '<script src="node_modules/three/examples/js/lines/Line2.js"></script>'
assert anchor in s
s = s.replace(anchor, anchor + '\n' + inl('voxpost.js') + '\n' + inl('voxmerge.js') + '\n' + inl('bppaper.js'), 1)
s = s.replace("<script>\nif(location.search.indexOf('render')>=0)",
              "<script>window.__POST=!/post=0/.test(location.search);</script>\n<script>\nif(location.search.indexOf('render')>=0)", 1)
rep = [(" const t=cubes(L);t.castShadow=false;world.add(t);WORLDONLY.push(t);", " const t=voxMerge(THREE,L,NOISE);t.castShadow=false;world.add(t);WORLDONLY.push(t);"),
       (" const t=cubes(L,{tex:STONET});castle.add(t);", " const t=voxMerge(THREE,L,STONET);t.castShadow=true;castle.add(t);"),
       ("  O.kar(t);\n  R.render(scene,cam);",
        "  O.kar(t);\n  if(window.__POST!==false&&sh.mode==='world'){(window.__vp||(window.__vp=makeVoxPost(THREE,R,scene,cam,window.__POSTO)));window.__vp.render(1);}else R.render(scene,cam);")]
for a, b in rep:
    assert s.count(a) == 1, a; s = s.replace(a, b)
i = s.index("  const r=2;for(let dx=-r;dx<=r;dx++)"); old = " const t=cubes(L);world.add(t);WORLDONLY.push(t);}"; j = s.index(old, i)
s = s[:j] + " const t=voxMerge(THREE,L,NOISE);t.castShadow=true;world.add(t);WORLDONLY.push(t);}" + s[j + len(old):]
paper = """<script>(function(){const e=document.getElementById('bpbg');if(!e||/paper=0/.test(location.search))return;const u=makeBpPaper(1080,1920,7);if(!u)return;
const cs=getComputedStyle(e);e.style.backgroundImage=cs.backgroundImage+',url('+u+')';e.style.backgroundSize='20cqw 20cqw,20cqw 20cqw,5cqw 5cqw,5cqw 5cqw,100% 100%';e.style.backgroundRepeat='repeat,repeat,repeat,repeat,no-repeat';})();</script>
</body>"""
k = s.rindex('</body>'); s = s[:k] + paper + s[k + 7:]
open(dst, 'w').write(s); print('ok', dst, len(s))
