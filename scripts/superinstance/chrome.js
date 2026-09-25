/* ============ chrome — hero field + reveal ============ */
(function () {
  const cv = document.getElementById('heroFx');
  const ctx = cv.getContext('2d');
  let W, H, cell = 30, cols, rows, t = 0, last = 0;
  const pulses = [];
  function resize() {
    W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight;
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
  }
  window.addEventListener('resize', resize); resize();
  function spawn() {
    pulses.push({ x: Math.random() * cols, y: Math.random() * rows, r: 0, hue: Math.random() > 0.75 ? '255,122,107' : '63,224,197' });
    if (pulses.length > 6) pulses.shift();
  }
  setInterval(spawn, 2100); spawn();
  function draw(tms) {
    const dt = Math.min(60, tms - last || 16); last = tms; t += dt / 1000;
    ctx.clearRect(0, 0, W, H);
    for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].r += dt / 1000 * 7; if (pulses[i].r > 24) pulses.splice(i, 1); }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let b = 0.028 + 0.02 * (Math.sin(x * 0.35 + t * 0.7) * Math.cos(y * 0.28 - t * 0.5) + 1);
      for (const p of pulses) {
        const d = Math.abs(Math.hypot(x - p.x, y - p.y) - p.r);
        if (d < 1.6) b += 0.4 * (1 - d / 1.6) * Math.max(0, 1 - p.r / 24);
      }
      if (b > 0.031) {
        ctx.fillStyle = `rgba(63,224,197,${Math.min(0.5, b)})`;
        ctx.beginPath(); ctx.roundRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4, 5); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${b})`;
        ctx.beginPath(); ctx.roundRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4, 5); ctx.fill();
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();
