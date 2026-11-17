// Papier blueprint (cyjanotypia) generowany raz przy starcie: plamisty granat, smugi powłoki, włókna, krzyżowe zagięcie, wyblakłe brzegi, drobne skazy.
// Adaptacja shadera paper() z lemo-opuscar styles/blueprint/demo/paper.js, przestrojona na nasz granat #143866. Zwraca dataURL (PNG) do tła #bpbg.
// Użycie: document.getElementById('bpbg').style.backgroundImage = GRID_CSS + ', url(' + makeBpPaper(1080, 1920, 7) + ')';
function makeBpPaper(W, H, seed) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true }); if (!gl) return null;
  const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0.,1.); }';
  const FS = `precision highp float; varying vec2 uv; uniform vec2 res; uniform float seed;
  float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031 + seed*.0173); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for(int i=0;i<5;i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= .5; } return s; }
  void main(){
    vec2 p = vec2(uv.x, 1.-uv.y)*res; vec2 sh = res;
    float n1 = fbm(p/760.), n2 = fbm(vec2(p.x/1500., p.y/70.) + 3.), n3 = fbm(p/190. + 9.);
    vec3 dark = vec3(.060,.170,.345), light = vec3(.105,.255,.470);          // wokół #143866
    float m = clamp(.30 + .80*(n1-.25) + .18*(n2-.5) + .12*(n3-.5), 0., 1.);
    vec3 c = mix(dark, light, m);
    float fib = vn(p*.55)*.5 + vn(p*1.7)*.5; c *= .965 + .06*fib;              // włókna papieru
    float fl = smoothstep(.93, 1., vn(vec2(p.x*.02 + p.y*.07, p.y*.9 - p.x*.3)*.35)); c = mix(c, c*1.12 + .02, fl*.30);
    float fx = p.x - sh.x*.5 - 6.*(vn(vec2(p.y*.01, 2.))-.5), fy = p.y - sh.y*.42 - 6.*(vn(vec2(p.x*.01, 5.))-.5);
    float cx = exp(-fx*fx/18.), cy = exp(-fy*fy/18.);                          // krzyżowe zagięcie arkusza
    c *= 1. + .05*sign(fx)*exp(-fx*fx/260.) + .04*sign(fy)*exp(-fy*fy/260.);
    float wear = (cx + cy)*smoothstep(.45, .8, fbm(p/9.)); c = mix(c, vec3(.42,.55,.74), clamp(wear*.45, 0., .5));
    float e = min(min(p.x, sh.x - p.x), min(p.y, sh.y - p.y));                // wyblakłe brzegi
    float bl = smoothstep(70., 0., e + 50.*(fbm(p/60.)-.5)); c = mix(c, vec3(.36,.49,.70), bl*.35);
    float sp = smoothstep(.985, 1., vn(p/14. + 40.)); c *= 1. - .16*sp;       // skazy
    vec2 q = uv - .5; c *= 1. - .18*dot(q, q)*2.2;                            // lekka winieta
    gl_FragColor = vec4(c, 1.);
  }`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(pr, 'res'), W, H); gl.uniform1f(gl.getUniformLocation(pr, 'seed'), seed || 0);
  gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  const url = c.toDataURL('image/png'); gl.getExtension('WEBGL_lose_context')?.loseContext(); return url;
}
