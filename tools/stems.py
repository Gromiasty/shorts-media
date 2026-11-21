"""Pięć stemów Shorta (lektor, efekty komediowe, akcja, muzyka, tło) — 48 kHz stereo WAV + MP3 do podglądu.
python3 -I tools/stems.py   (czyta audio/lektor.wav, audio/scene_events.json z EV/SFX/SEGS)
Normalizacja wg wytycznych: efekt RMS = lektor −14 dB, muzyka = lektor −20 dB; ducking pod głosem: SFX −6 dB, muzyka −5 dB.
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx_proc
SR = 48000
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = json.load(open(os.path.join(D, 'audio/scene_events.json')))
W = json.load(open(os.path.join(D, 'audio/words.json')))
DUR = W['dur']; N = int(round(DUR * SR))

def load(p):
    tmp = os.path.join(D, 'audio/_tmp.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-ar', str(SR), '-ac', '2', tmp], check=True)
    x, _ = sf.read(tmp); os.remove(tmp); return x.astype(np.float64)
def rms(x):
    a = np.abs(x).mean(axis=1) if x.ndim > 1 else np.abs(x)
    v = x[a > a.max() * 0.05] if a.max() > 0 else x
    return np.sqrt(np.mean(v ** 2)) + 1e-12
def db(v): return 10 ** (v / 20)
def fade(x, fi=0.01, fo=0.05):
    n = len(x); a = int(fi * SR); b = int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None]
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None]
    return x
def place(buf, x, t):
    s = int(round(t * SR)); e = min(len(buf), s + len(x))
    if e > s and s >= 0: buf[s:e] += x[:e - s]

lek = load(os.path.join(D, 'audio/lektor.wav'))[:N]; lek = np.pad(lek, ((0, N - len(lek)), (0, 0)))
R_L = rms(lek)
FX = {}
for f in os.listdir(os.path.join(D, 'sfx/new')) + os.listdir(os.path.join(D, 'sfx/lib')):
    if f.endswith('.mp3'):
        p = os.path.join(D, 'sfx/new', f)
        if not os.path.exists(p): p = os.path.join(D, 'sfx/lib', f)
        FX[f[:-4]] = load(p)
def fx(name): x = FX[name].copy(); return x * (R_L * db(-14) / rms(x))

stem = {k: np.zeros((N, 2)) for k in ['com', 'act', 'mus', 'amb']}
# 1) sample SFX
for e in J['SFX']:
    x = fx(e['f']) * db(e.get('db', 0))
    if 'len' in e: x = fade(x[:int(e['len'] * SR)].copy(), 0.02, 0.15)
    place(stem[e['stem']], fade(x), e['t'])
# 2) procedural (UI sounds -> comedic stem, machine sounds -> action stem)
ui = [e for e in J['EV'] if e['type'] in ('pen', 'ruler', 'letter', 'stamp', 'paper', 'tick', 'pop', 'whoosh', 'ding')]
mc = [e for e in J['EV'] if e not in ui]
for lst, k in [(ui, 'com'), (mc, 'act')]:
    if not lst: continue
    x = sfx_proc.render(lst, DUR)[:N]; x = np.pad(x, ((0, N - len(x)), (0, 0)))
    stem[k] += x * (R_L * db(-14) / rms(x)) * 0.9
# 3) fire bed in the action stem: on in world shots with fire, off in palace and blueprint
segs = J['SEGS']; fireOn = np.zeros(N); seaOn = np.zeros(N); roomOn = np.zeros(N)
NOFIRE = {'4', '23', '24', '26a'}; PAL = {'23', '24'}
for s in segs:
    a, b = int(s['s'] * SR), int(s['e'] * SR)
    if s['mode'] == 'world' and s['id'] not in NOFIRE: fireOn[a:b] = 1
    if s['mode'] == 'world' and s['id'] not in PAL: seaOn[a:b] = 1
    if s['mode'] == 'bp': seaOn[a:b] = 0.25
    if s['id'] in PAL: roomOn[a:b] = 1
def smooth(v, sec=0.12):
    k = int(sec * SR); c = np.cumsum(np.concatenate([[0], v])); out = (c[k:] - c[:-k]) / k
    return np.concatenate([out, np.full(len(v) - len(out), out[-1])])
def loop(x, n, xf=1.0):
    k = int(xf * SR); out = np.zeros((n, 2)); pos = 0; step = len(x) - k
    while pos < n:
        seg = x.copy(); seg[:k] *= np.linspace(0, 1, k)[:, None]; seg[-k:] *= np.linspace(1, 0, k)[:, None]
        e = min(n, pos + len(seg)); out[pos:e] += seg[:e - pos]; pos += step
    return out
fire = loop(fx('fire_loop'), N, 1.5) * db(-7); stem['act'] += fire * smooth(fireOn)[:, None]
sea = loop(fx('sea_amb'), N, 2.0) * db(-4); room = loop(fx('amb_room'), N, 1.0) * db(-6)
stem['amb'] += sea * smooth(seaOn, 0.2)[:, None] + room * smooth(roomOn, 0.2)[:, None]
# 4) music: loop under everything, silence during the comedic pause (crickets)
mus = loop(load(os.path.join(D, 'sfx/new/mus_byz.mp3')), N, 1.0); mus *= R_L * db(-20) / rms(mus)
gate = np.ones(N); P0, P1 = J['PAUSE']; gate[int((P0 - 0.05) * SR):int((P1 + 0.25) * SR)] = 0
stem['mus'] += mus * smooth(gate, 0.06)[:, None]
# 5) ducking under the voice (SFX −6 dB, music −5 dB)
env = np.abs(lek).max(axis=1); act = np.zeros(N)
for w in W['W']: act[int(w[1] * SR):int((w[2] + 0.05) * SR)] = 1
act = smooth(act, 0.08)
for k in ['com', 'act']: stem[k] *= (1 - act * (1 - db(-6)))[:, None]
stem['mus'] *= (1 - act * (1 - db(-5)))[:, None]
# 6) write
os.makedirs(os.path.join(D, 'audio/stems'), exist_ok=True)
allst = {'lek': lek, **stem}
for k, x in allst.items():
    p = os.path.join(D, f'audio/stems/{k}.wav'); sf.write(p, x.astype(np.float32), SR)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-b:a', '128k', p[:-4] + '.mp3'], check=True)
    print(k, 'peak %.2f' % np.abs(x).max(), 'rms dB %.1f' % (20 * np.log10(rms(x))))
