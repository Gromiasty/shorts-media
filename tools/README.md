# Narzędzia do Shortów (wytyczne 7.5)

Opis i zasady: dokument Projektu `shorts-technika-v7.5.md`. Pomysły i fragmenty kodu z repo lemomo-ai/lemo-opuscar (kod MIT).

- `voxmerge.js` — statyczne kostki → jedna siatka z widocznymi ścianami (render ok. 5× szybszy)
- `voxpost.js` — kontur we własnym kolorze, AO, gradacja (tryb świata)
- `bppaper.js` — papier cyjanotypii jako tło blueprintu
- `render_fast.mjs` — render JPEG → ffmpeg, segmenty łączone bez rekompresji
- `profile.mjs`, `stills.mjs` — pomiar kosztu klatki i klatki kontrolne
- `sfx_proc.py` — proceduralne SFX z listy zdarzeń `window.EV`
- `build_artifact.py` — wstawia powyższe do strony-podglądu
