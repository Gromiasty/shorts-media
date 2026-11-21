// Statyczne kostki 1×1×1 → jedna siatka z samymi widocznymi ścianami (ukryte ściany i kostki pod ziemią znikają).
// Wygląd identyczny jak cubes() z InstancedMesh (ta sama tekstura 16×16 na ścianę, kolor per kostka), ale ok. 5–10× mniej trójkątów,
// więc swiftshader renderuje klatkę szybciej. Tylko dla kostek, które się nie ruszają (teren, zamek, drzewa).
// list: [[x,y,z,color],...] z x,z całkowitymi i y = całkowite + 0.5 lub −0.5 (jak w cubes()).
function voxMerge(THREE, list, tex) {
  const key = (x, y, z) => x + ',' + y + ',' + z, occ = new Set(), cells = [];
  for (const [x, y, z, c] of list) { const X = Math.round(x), Y = Math.round(y - .5), Z = Math.round(z); occ.add(key(X, Y, Z)); cells.push([X, Y, Z, x - X, y - .5 - Y, z - Z, c]); }
  // ściana: normalna, 4 narożniki (kolejność CCW patrząc od zewnątrz), UV jak BoxGeometry
  const F = [
    [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]]];
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const pos = [], nor = [], uv = [], col = [], idx = []; const C = new THREE.Color(); let v = 0;
  for (const [X, Y, Z, ox, oy, oz, c] of cells) {
    C.set(c);
    for (const [n, q] of F) {
      if (occ.has(key(X + n[0], Y + n[1], Z + n[2]))) continue;
      for (let i = 0; i < 4; i++) { pos.push(X + ox + q[i][0] - .5, Y + oy + q[i][1], Z + oz + q[i][2] - .5); nor.push(...n); uv.push(...UV[i]); col.push(C.r, C.g, C.b); }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true })); m.receiveShadow = true;
  m.userData.faces = idx.length / 6; return m;
}
