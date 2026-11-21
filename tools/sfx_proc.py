"""Proceduralne efekty dźwiękowe zsynchronizowane z listą zdarzeń (adaptacja lemo-opuscar core/audio/sfx.py, MIT).
Każdy efekt to mono float32 @ 48 kHz. Zdarzenia z sceny (window.EV = [{t, type, gain, pan, ...}]) → stem WAV co do klatki.

  python3 -I tools/sfx_proc.py events.json out/stem_proc.wav [--dur 26.47]
  python3 -I tools/sfx_proc.py --demo out/sfx_demo/        # próbki każdego efektu do odsłuchu

Do czego: drobne dźwięki „interfejsu” (kreślenie w blueprincie, pop etykiety, stempel, whoosh cięcia, tyk zębatki,
skrzypienie drewna, stuk deski), które muszą trafiać idealnie w klatkę. Większe efekty i muzyka dalej z biblioteki ElevenLabs.
Głośność: każdy efekt jest znormalizowany do szczytu 1.0; poziom w filmie ustawia "gain" zdarzenia i potem mikser (bez masteringu).
"""
import json, sys, os
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

SR = 48000
_rng = np.random.default_rng(7)


def t_(d): return np.arange(int(round(d * SR))) / SR
def env_exp(d, tau): return np.exp(-t_(d) / tau)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(d): return _rng.standard_normal(int(round(d * SR)))
def norm(x, p=1.0): m = np.abs(x).max(); return x * (p / m) if m > 0 else x
def brown(d): w = np.cumsum(noise(d)); w -= np.linspace(w[0], w[-1], len(w)); return norm(hp(w, 20))


# —— z lemo-opuscar (bez zmian w brzmieniu) ——
def click(pitch=1.0, v=1.0):
    d = .06; tt = t_(d)
    tr = hp(noise(d), 2500) * env_exp(d, .0015)
    res = sum(a * np.sin(2 * np.pi * f * pitch * tt + _rng.random() * 6) * env_exp(d, tau) for f, a, tau in [(2900, .6, .012), (4600, .4, .008), (1500, .35, .018)])
    return norm(tr * .8 + res + np.sin(2 * np.pi * 190 * pitch * tt) * env_exp(d, .01) * .5) * v

def whoosh(d=.35, v=1.0):
    n = noise(d); tt = t_(d); out = np.zeros_like(n)
    for i in range(0, len(n), 480):
        hi = min(len(n), i + 480); f = 600 + 2600 * np.sin(np.pi * i / len(n)); out[i:hi] = bp(n[max(0, i - 2000):hi], f * .7, f * 1.3)[-(hi - i):]
    return norm(out * np.sin(np.pi * tt / d) ** 2) * v

def creak(v=1.0):
    d = .22; tt = t_(d); f0 = 70 + _rng.random() * 40
    saw = 2 * ((tt * f0 * (1 + .3 * np.sin(2 * np.pi * 9 * tt))) % 1) - 1
    return norm(bp(saw, 400, 3000) * (np.abs(np.sin(2 * np.pi * 23 * tt)) ** 3) * np.sin(np.pi * tt / d)) * v

def thump(v=1.0, f=70):
    d = .35; tt = t_(d)
    return norm(np.sin(2 * np.pi * f * tt * (1 - .3 * tt)) * env_exp(d, .07) + lp(noise(d), 300) * env_exp(d, .02) * .5) * v

def ding(v=1.0):
    d = 1.6; tt = t_(d)
    return norm(sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(1318, 1, .6), (2637, .5, .35), (3951, .3, .2), (1976, .25, .5), (5274, .15, .1)])) * v

def pop(v=1.0):
    d = .18; tt = t_(d); f = 500 + 1400 * tt / d
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .05)) * v

def rumble(d=1.5, v=1.0): return norm(lp(brown(d), 200)) * np.sin(np.pi * t_(d) / d / 2) ** 2 * v


# —— nasze: kreślarnia (wg palety dźwięków z blueprint/STYLE.md §7) i drewno maszyn ——
def pen(d=.4, v=1.0):
    """Kreślenie linii rapidografem: ziarnisty szum 2–6 kHz, długość = długość kreski"""
    n = bp(noise(d), 2000, 6000, 3); g = .6 + .4 * np.abs(lp(noise(d), 18))      # nierówny nacisk
    e = np.minimum(1, t_(d) / .02) * np.minimum(1, (d - t_(d)) / .04)
    return norm(n * g * e) * v

def ruler(d=.5, v=1.0):
    """Przesunięcie drewnianej linijki/ekierki po papierze"""
    x = bp(noise(d), 300, 1800) * (.7 + .3 * np.sin(2 * np.pi * 7 * t_(d)))
    return norm(x * np.sin(np.pi * t_(d) / d)) * v

def letter(n=6, v=1.0):
    """Literowanie napisu: seria krótkich skrobnięć"""
    out = np.zeros(int(n * .07 * SR) + 4000)
    for k in range(n):
        s = int(k * .07 * SR + _rng.integers(0, 400)); x = pen(.035 + _rng.random() * .02); out[s:s + len(x)] += x * (.7 + .3 * _rng.random())
    return norm(out) * v

def stamp(v=1.0):
    """Gumowy stempel: głuche uderzenie + klapnięcie papieru"""
    d = .25; return norm(thump(1, 95)[:int(d * SR)] + hp(noise(d), 900) * env_exp(d, .012) * .8) * v

def paper(d=.4, v=1.0):
    """Szelest arkusza (przejście świat → blueprint)"""
    x = hp(noise(d), 1500) * (np.abs(lp(noise(d), 40)) ** 2) * 3
    return norm(x * np.sin(np.pi * t_(d) / d) ** .5) * v

def tick(v=1.0):
    """Tyk zapadki / zęba koła: trzy mikrokliknięcia (unlock, impulse, drop)"""
    out = np.zeros(int(.05 * SR))
    for dt, p, a in [(0, 1.3, .5), (.008, 1.0, 1.), (.02, .8, .6)]:
        c = click(p) * a; s = int(dt * SR); out[s:s + len(c)] += c[:len(out) - s]
    return norm(out) * v

def wood(v=1.0, size=1.0):
    """Stuk drewnianej belki (ramię trebusza o ogranicznik)"""
    d = .3; tt = t_(d); f = 160 / size
    x = sum(a * np.sin(2 * np.pi * f * k * tt) * env_exp(d, tau) for k, a, tau in [(1, 1, .06), (2.3, .5, .03), (4.1, .3, .015)])
    return norm(x + hp(noise(d), 1200) * env_exp(d, .004) * .6) * v


FX = dict(click=click, whoosh=whoosh, creak=creak, thump=thump, ding=ding, pop=pop, rumble=rumble,
          pen=pen, ruler=ruler, letter=letter, stamp=stamp, paper=paper, tick=tick, wood=wood)


def add(buf, x, at, gain=1.0, pan=0.0):
    s = int(round(at * SR))
    if s >= len(buf) or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    e = min(len(buf), s + len(x)); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[s:e, 0] += x[:e - s] * gain * l * 1.414; buf[s:e, 1] += x[:e - s] * gain * r * 1.414


def render(events, dur):
    buf = np.zeros((int(dur * SR) + SR, 2))
    for ev in events:
        f = FX[ev['type']]; kw = {k: v for k, v in ev.items() if k not in ('t', 'type', 'gain', 'pan')}
        add(buf, f(**kw), ev['t'], ev.get('gain', .5), ev.get('pan', 0))
    return buf[:int(dur * SR)]


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--demo':
        os.makedirs(a[1], exist_ok=True)
        for k, f in FX.items(): sf.write(os.path.join(a[1], k + '.wav'), (f() * .8).astype(np.float32), SR)
        print('demo:', ', '.join(FX)); sys.exit()
    ev = json.load(open(a[0])); dur = float(a[a.index('--dur') + 1]) if '--dur' in a else max(e['t'] for e in ev) + 2
    sf.write(a[1], render(ev, dur).astype(np.float32), SR); print('stem', a[1], len(ev), 'zdarzeń')
