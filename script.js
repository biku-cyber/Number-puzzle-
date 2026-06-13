/* -------------------- HIGH-PERFORMANCE FX MODULE -------------------- */
const FX = (() => {
  let canvas, ctx, raf, parts = [], running = false;
  
  function init(c) {
    if (!c) return;
    canvas = c; ctx = c.getContext('2d');
    resize();
    window.addEventListener('resize', () => { if (running) resize(); });
  }
  
  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    if (ctx) ctx.scale(dpr, dpr);
  }
  
  function spawnConfetti(n = 140) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const colors = ['#d9a441','#f0c870','#ffffff','#c0392b','#2ecc71','#3498db','#e91e63'];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * w, y: -20,
        vx: (Math.random() - 0.5) * 5,
        vy: 2 + Math.random() * 4,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25,
        kind: 'confetti', life: 1,
      });
    }
  }
  
  function spawnFirework() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const cx = Math.random() * w, cy = h * (0.2 + Math.random() * 0.35);
    const hue = Math.floor(Math.random() * 360);
    for (let i = 0; i < 50; i++) {
      const a = (Math.PI * 2 * i) / 50;
      const sp = 1.5 + Math.random() * 2.5;
      parts.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: 2.5, color: `hsl(${hue},95%,65%)`,
        kind: 'spark', life: 1,
      });
    }
  }
  
  function loop() {
    if (!running) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'confetti') { p.vy += 0.12; p.rot += p.vr; }
      else { p.vy += 0.06; p.life -= 0.015; }
      
      if ((p.kind === 'spark' && p.life <= 0) || p.y > h + 20) {
        parts.splice(i, 1); continue;
      }
      
      ctx.globalAlpha = p.kind === 'spark' ? Math.max(p.life, 0) : 1;
      ctx.fillStyle = p.color;
      if (p.kind === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(loop);
  }
  
  function start() {
    if (running) return;
    running = true; resize(); parts = [];
    spawnConfetti(150);
    const fwTimer = setInterval(() => { if (running) spawnFirework(); else clearInterval(fwTimer); }, 750);
    setTimeout(() => clearInterval(fwTimer), 4000);
    loop();
  }
  
  function stop() { 
    running = false; 
    cancelAnimationFrame(raf); 
    if (ctx && canvas) {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
    }
    parts = []; 
  }
  
  return { init, start, stop };
})();
     

