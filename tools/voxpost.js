// Post-processing świata voxel (three r128). Adaptacja lemo-opuscar: precise-mechanism/demo/film-outline.js (kontur we własnym kolorze bryły)
// + core/three/post.js (miękki kontrast, nasycenie, winieta) + tani AO z bufora głębi (zamiast GTAO, którego r128 nie ma, a swiftshader by nie uciągnął).
// Użycie: const vp = makeVoxPost(THREE, R, scene, cam, opts); w renderAt zamiast R.render(scene,cam): vp.render(amt) (amt 0..1 = siła efektów).
// Przezroczyste tło (niebo z CSS) zostaje przezroczyste.
function makeVoxPost(THREE, R, scene, cam, o) {
  o = Object.assign({ edge: 1, ao: .9, aoR: 9, contrast: .08, sat: 1.12, warm: .15, vig: .2, rD: 1.6, rN: 1.2, kD: .0035 }, o || {});
  const size = new THREE.Vector2(); let W = 0, H = 0, rtC, rtN, q;
  const nm = new THREE.MeshNormalMaterial();
  const fs = `
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tCol, tN, tD; uniform vec2 px; uniform float near, far, rD, rN, kD, amt, eAmt, aoAmt, aoR, contrast, sat, warm, vig;
    float lz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tD, uv).x, near, far); }
    vec3 nn(vec2 uv){ return texture2D(tN, uv).xyz * 2. - 1.; }
    void main(){
      vec4 c4 = texture2D(tCol, vUv); vec3 col = c4.rgb; float a = c4.a;
      float zc = lz(vUv);
      if (zc < far * .98 && amt > 0.) {
        vec3 nc = nn(vUv); float e = 0.;
        vec2 dirs[4]; dirs[0]=vec2(1.,0.); dirs[1]=vec2(0.,1.); dirs[2]=vec2(.7071,.7071); dirs[3]=vec2(.7071,-.7071);
        float thr = kD * zc;
        for (int i = 0; i < 4; i++) {
          vec2 o = dirs[i] * px * rD;
          float lap = lz(vUv + o) + lz(vUv - o) - 2. * zc;          // > 0 tylko po bliższej stronie uskoku głębi
          e = max(e, smoothstep(thr, thr * 2.2, lap));
          vec2 on = dirs[i] * px * rN;
          float dn = max(1. - dot(nc, nn(vUv + on)), 1. - dot(nc, nn(vUv - on)));
          float zn = abs(lz(vUv + on) - zc);
          e = max(e, smoothstep(.30, .55, dn) * (1. - smoothstep(thr, thr * 3., zn)) * .85);   // załamanie (krawędź kostki)
        }
        // tani AO: sąsiedzi bliżej kamery niż środek = wnęka / styk
        float occ = 0.; float r = aoR / max(zc * .08, 1.);
        for (int i = 0; i < 12; i++) {
          float th = float(i) * 2.39996, rr = r * sqrt((float(i) + .5) / 12.);
          float zs = lz(vUv + vec2(cos(th), sin(th)) * px * rr);
          float d = zc - zs; occ += smoothstep(.02, .35, d) * (1. - smoothstep(1.2, 3., d));
        }
        occ = clamp(occ / 12. * 1.6, 0., 1.);
        col *= 1. - aoAmt * amt * occ * .6;
        vec3 line = mix(col * .52, vec3(.10,.08,.12), .28);
        col = mix(col, line, e * eAmt * amt);
      }
      // gradacja (post.js) liczona liniowo: S-krzywa kontrastu, nasycenie, lekko ciepło, winieta
      vec3 lin = pow(max(col, 0.), vec3(2.2));
      float l = dot(lin, vec3(.2126,.7152,.0722)); lin = mix(vec3(l), lin, mix(1., sat, amt));
      lin *= mix(vec3(1.), vec3(1.04, 1., .94), warm * amt);
      vec2 d = vUv - .5; d.x *= .7; lin *= 1. - vig * amt * smoothstep(.3, .8, length(d));
      col = pow(lin, vec3(1. / 2.2));
      float k = contrast * amt; col = mix(col, col * col * (3. - 2. * col), k);   // S-krzywa w sRGB: ciemne ciemniej, jasne jaśniej
      gl_FragColor = vec4(col, a);
    }`;
  function setup(w, h) {
    W = w; H = h;
    rtC = new THREE.WebGLMultisampleRenderTarget(w, h, { format: THREE.RGBAFormat }); rtC.samples = 4; rtC.texture.encoding = THREE.sRGBEncoding;
    rtN = new THREE.WebGLRenderTarget(w, h); rtN.depthTexture = new THREE.DepthTexture(w, h); rtN.depthTexture.type = THREE.UnsignedIntType;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tCol: { value: rtC.texture }, tN: { value: rtN.texture }, tD: { value: rtN.depthTexture }, px: { value: new THREE.Vector2(1 / w, 1 / h) },
        near: { value: cam.near }, far: { value: cam.far }, rD: { value: o.rD }, rN: { value: o.rN }, kD: { value: o.kD }, amt: { value: 1 }, eAmt: { value: o.edge },
        aoAmt: { value: o.ao }, aoR: { value: o.aoR * h / 1920 }, contrast: { value: o.contrast }, sat: { value: o.sat }, warm: { value: o.warm }, vig: { value: o.vig } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: fs, depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending });
    q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false;
    q.scene = new THREE.Scene(); q.scene.add(q); q.cam = new THREE.Camera();
  }
  return {
    opts: o,
    render(amt = 1) {
      R.getDrawingBufferSize(size); if (size.x !== W || size.y !== H) setup(size.x, size.y);
      const u = q.material.uniforms; u.amt.value = amt; u.near.value = cam.near; u.far.value = cam.far;
      const cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha();
      R.setRenderTarget(rtC); R.setClearColor(0x000000, 0); R.clear(); R.render(scene, cam);
      const sm = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false;
      const bg = scene.background; scene.background = null; scene.overrideMaterial = nm;
      R.setRenderTarget(rtN); R.setClearColor(0x8080ff, 1); R.clear(); R.render(scene, cam);
      scene.overrideMaterial = null; scene.background = bg; R.shadowMap.autoUpdate = sm;
      R.setRenderTarget(null); R.setClearColor(cc, ca); R.clear(); R.render(q.scene, q.cam);
    }
  };
}
