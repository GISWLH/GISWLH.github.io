/* Interactive 3D hero globe: illustrative SST-style field + ocean particle flow + GRACE-like twin satellites.
   Three.js from CDN (jsDelivr, unpkg fallback). Honors prefers-reduced-motion and pauses when off-screen. */
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/build/three.module.js'
];
let THREE = null;
for (const src of SOURCES) {
  try { THREE = await import(src); break; } catch (e) { /* try next */ }
}
const canvas = document.getElementById('globe');
const root = document.documentElement;
window.__globe = { started: false, frames: 0, error: null };

function fail(err) {
  window.__globe.error = String(err && err.message || err);
  root.classList.add('no-webgl');
}

if (!THREE || !canvas) {
  fail('three.js unavailable');
} else {
  try { init(); } catch (e) { fail(e); }
}

function init() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth <= 720;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  const tiltGroup = new THREE.Group();   // axial tilt + parallax
  const spin = new THREE.Group();        // auto-rotation + drag
  tiltGroup.add(spin);
  scene.add(tiltGroup);
  tiltGroup.rotation.z = 0.28;
  spin.rotation.y = 2.55;                // start over the Indo-Pacific

  const R = 1.35;
  const uniforms = {
    uTime: { value: 0 },
    uMask: { value: null },
    uLight: { value: new THREE.Vector3(-0.6, 0.45, 0.75).normalize() }
  };

  const noise = /* glsl */`
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    float fbm(vec3 p){ float f=0.0; float a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; } return f; }
  `;

  // --- Earth / SST sphere
  const earthMat = new THREE.ShaderMaterial({
    uniforms,
    extensions: { derivatives: true },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vUv = uv; vP = position;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMask; uniform float uTime; uniform vec3 uLight;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      ${noise}
      vec3 sst(float t){
        vec3 c0=vec3(0.04,0.11,0.32), c1=vec3(0.11,0.31,0.85), c2=vec3(0.05,0.65,0.91), c3=vec3(0.18,0.83,0.75),
             c4=vec3(0.64,0.90,0.21), c5=vec3(0.98,0.80,0.08), c6=vec3(0.98,0.45,0.09), c7=vec3(0.86,0.15,0.15);
        t = clamp(t,0.0,1.0)*7.0;
        if(t<1.0) return mix(c0,c1,t); if(t<2.0) return mix(c1,c2,t-1.0); if(t<3.0) return mix(c2,c3,t-2.0);
        if(t<4.0) return mix(c3,c4,t-3.0); if(t<5.0) return mix(c4,c5,t-4.0); if(t<6.0) return mix(c5,c6,t-5.0);
        return mix(c6,c7,t-6.0);
      }
      void main(){
        float water = smoothstep(0.35, 0.65, texture2D(uMask, vUv).r);
        float lat = (vUv.y - 0.5) * 3.14159265;
        vec3 p = normalize(vP);
        float n  = fbm(p*2.1 + vec3(0.0, uTime*0.025, uTime*0.02));
        float n2 = snoise(p*7.0 + vec3(uTime*0.04, 0.0, 0.0));
        float T = pow(cos(lat), 2.6)*0.97 + n*0.22 + n2*0.04 - 0.09;
        vec3 ocean = sst(T);
        float f = fract(clamp(T,0.0,1.0)*12.0);
        float iso = 1.0 - smoothstep(0.0, 0.07, min(f, 1.0-f));
        ocean += iso*0.10;
        // land: deep glass with graticule and glowing coastline
        vec2 g = vec2(vUv.x*24.0, vUv.y*12.0);
        vec2 gw = fwidth(g);
        vec2 gl = abs(fract(g-0.5)-0.5)/gw;
        float grid = 1.0 - min(min(gl.x, gl.y), 1.0);
        vec3 land = vec3(0.045,0.07,0.115) + grid*vec3(0.06,0.14,0.2);
        float coast = 1.0 - abs(water-0.5)*2.0;
        vec3 col = mix(land, ocean, water) + coast*vec3(0.35,0.9,1.0)*0.55;
        vec3 N = normalize(vN);
        float diff = max(dot(N, uLight), 0.0);
        col *= 0.34 + 0.78*diff;
        float spec = pow(max(dot(reflect(-uLight, N), normalize(vV)), 0.0), 40.0) * water;
        col += spec*vec3(0.6,0.8,1.0)*0.35;
        float fres = pow(1.0 - max(dot(N, normalize(vV)), 0.0), 3.0);
        col += fres*vec3(0.25,0.7,1.0)*0.55;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), earthMat);
  spin.add(earth);

  // --- Atmosphere glow
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.17, 96, 64),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float i = pow(max(0.56 - dot(vN, vV), 0.0), 4.0); gl_FragColor = vec4(0.25,0.72,1.0,1.0)*i*0.85; }`
    })
  );
  tiltGroup.add(atmo);

  // --- Ocean particle flow (zonal currents: easterly trades, mid-latitude westerlies)
  const COUNT = isMobile() ? 3500 : 9000;
  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    seeds[i * 3] = Math.random();
    const v = Math.acos(1 - 2 * Math.random()) / Math.PI; // uniform on sphere
    seeds[i * 3 + 1] = 1 - v;
    seeds[i * 3 + 2] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.1);
  const pMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uPR: { value: renderer.getPixelRatio() } }, uniforms),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPR; uniform sampler2D uMask;
      attribute vec3 seed; varying float vA; varying float vLat;
      const float PI = 3.14159265;
      void main(){
        float lat = (seed.y - 0.5)*PI;
        float wind = -cos(lat*3.0);
        float u = fract(seed.x + wind*uTime*0.006 + 0.002*sin(uTime*0.5 + seed.z*40.0));
        float v = clamp(seed.y + 0.006*sin(uTime*0.35 + seed.z*6.283 + seed.x*25.0), 0.0, 1.0);
        float water = smoothstep(0.55, 0.9, texture2D(uMask, vec2(u, v)).r);
        float life = fract(uTime*0.07 + seed.z);
        float phi = u*2.0*PI; float th = (1.0 - v)*PI;
        vec3 pos = ${(R * 1.006).toFixed(4)} * vec3(-cos(phi)*sin(th), cos(th), sin(phi)*sin(th));
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vA = water * sin(life*PI) * (0.35 + 0.65*abs(wind));
        vLat = abs(lat);
        gl_PointSize = uPR * (1.1 + 1.4*sin(life*PI)) * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vLat;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        vec3 c = mix(vec3(1.0,0.95,0.85), vec3(0.75,0.95,1.0), smoothstep(0.2, 0.9, vLat));
        gl_FragColor = vec4(c, a*0.6);
      }`
  });
  const particles = new THREE.Points(pGeo, pMat);
  spin.add(particles);

  // --- GRACE-like twin satellites on a near-polar orbit
  const orbit = new THREE.Group();
  orbit.rotation.set(0.2, 0, 1.25);
  tiltGroup.add(orbit);
  const ORB = R * 1.32;
  const ringPts = [];
  for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * ORB, 0, Math.sin(a) * ORB)); }
  orbit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.16 })));
  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const satMat = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uPR; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = uPR*9.0*(6.0/-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(1.0,0.86,0.6)*1.2, a*a); }`
  });
  const sats = new THREE.Points(satGeo, satMat);
  orbit.add(sats);

  // --- Starfield
  const STARS = isMobile() ? 600 : 1400;
  const sp = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const r = 18 + Math.random() * 20, t = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    sp[i * 3] = r * Math.sin(ph) * Math.cos(t); sp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t); sp[i * 3 + 2] = r * Math.cos(ph) - 10;
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb8d9, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(stars);

  // --- Layout
  function layout() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w <= 720) {
      camera.position.z = 7.6; tiltGroup.position.set(0.15, 1.2, 0); tiltGroup.scale.setScalar(0.66);
    } else {
      const halfW = Math.tan(THREE.MathUtils.degToRad(17.5)) * 6.2 * camera.aspect;
      camera.position.z = 6.2;
      tiltGroup.position.set(Math.min(1.65, halfW - 1.4), 0.05, 0);
      tiltGroup.scale.setScalar(w < 1080 ? 0.82 : 0.9);
    }
    camera.updateProjectionMatrix();
  }
  layout();
  const onResize = () => { layout(); if (!running && window.__globe.started) renderOnce(); };
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
  else window.addEventListener('resize', onResize);

  // --- Interaction: parallax + drag (mouse/pen only, so touch scrolling is never hijacked)
  let tx = 0, ty = 0, px = 0, py = 0, dragV = 0, dragging = false, lastX = 0;
  if (!reduce) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (dragging) { dragV += (e.clientX - lastX) * 0.0009; lastX = e.clientX; }
    }, { passive: true });
    if (finePointer) {
      canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; dragging = true; lastX = e.clientX; });
      window.addEventListener('pointerup', () => { dragging = false; });
    }
  }

  // --- Satellites position
  function placeSats(t) {
    const a = t * 0.35, b = a - 0.12;
    const arr = satGeo.attributes.position.array;
    arr[0] = Math.cos(a) * ORB; arr[1] = 0; arr[2] = Math.sin(a) * ORB;
    arr[3] = Math.cos(b) * ORB; arr[4] = 0; arr[5] = Math.sin(b) * ORB;
    satGeo.attributes.position.needsUpdate = true;
  }

  function renderOnce() { renderer.render(scene, camera); window.__globe.frames++; }

  let running = false, visible = true, last = performance.now(), t = 8.0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    t += dt;
    uniforms.uTime.value = t;
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    spin.rotation.y += dt * 0.05 + dragV;
    dragV *= 0.92;
    tiltGroup.rotation.x = py * 0.12;
    tiltGroup.rotation.y = px * 0.18;
    stars.rotation.y = px * 0.03; stars.rotation.x = py * 0.02;
    placeSats(t);
    renderOnce();
    requestAnimationFrame(frame);
  }
  function setRunning(on) {
    if (reduce) return;
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!on) running = false;
  }

  new THREE.TextureLoader().load('assets/img/land-mask.jpg', (tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    uniforms.uMask.value = tex;
    window.__globe.started = true;
    canvas.classList.add('ready');
    uniforms.uTime.value = t; placeSats(t);
    if (reduce) { renderOnce(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; setRunning(visible && !document.hidden); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));
    setRunning(true);
  }, undefined, (err) => fail(err || 'mask texture failed'));
}
