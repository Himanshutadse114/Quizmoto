(() => {
  'use strict';

  const E = window.GeometryEngine;
  if (!E) return;

  const { WORLD, BALL_RADIUS, equationSegments, sampleEquation, parseEquation } = E;

  class NaturalGravityRun {
    constructor(level, surfaces, onStar) {
      this.level = level;
      this.x = level.spawn.x;
      this.y = level.spawn.y;
      this.vx = Number(level.initialVx) || 0;
      this.vy = Number(level.initialVy) || 0;
      this.rotation = 0;
      this.time = 0;
      this.running = true;
      this.finished = false;
      this.onStar = onStar;
      this.trail = [];
      this.contact = false;
      this.grounded = false;
      this._preserveRolling = false;
      this.gravity = Number.isFinite(level.gravity) ? level.gravity : 9.81;
      this.functionSegments = surfaces
        .filter((surface) => surface.kind !== 'circle')
        .flatMap((surface) => equationSegments(surface, 280));
      this.circleSurfaces = surfaces.filter((surface) => surface.kind === 'circle');
      this.stars = level.stars.map((star) => ({ ...star, collected: false }));
    }

    step(dt) {
      if (!this.running || this.finished) return null;

      const frameDt = Math.max(0, Math.min(1 / 45, dt));
      const subSteps = 3;
      const h = frameDt / subSteps;
      this.time += frameDt;
      this._preserveRolling = this.grounded;
      this.contact = false;
      this.grounded = false;

      for (let i = 0; i < subSteps; i++) {
        this._integrate(h);
        for (let pass = 0; pass < 2; pass++) {
          this._resolveTracks(h);
          this._resolveCircles(h);
        }
        this._limitSpeed();
      }

      this.rotation += (this.vx / BALL_RADIUS) * frameDt;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 24) this.trail.shift();

      for (const star of this.stars) {
        if (!star.collected && Math.hypot(this.x - star.x, this.y - star.y) < 0.62) {
          star.collected = true;
          this.onStar?.();
        }
      }

      const collected = this.stars.filter((star) => star.collected).length;
      const inBasket =
        Math.abs(this.x - this.level.basket.x) < 0.82 &&
        Math.abs(this.y - this.level.basket.y) < 0.82;

      if (inBasket && collected === this.stars.length) {
        this.finished = true;
        this.running = false;
        return { won: true, collected };
      }

      if (
        this.time > this.level.timeLimit ||
        this.y < WORLD.yMin - 2 ||
        this.x < WORLD.xMin - 2 ||
        this.x > WORLD.xMax + 2
      ) {
        this.finished = true;
        this.running = false;
        return { won: false, collected };
      }

      return null;
    }

    _integrate(dt) {
      this.vy -= this.gravity * dt;
      const air = Math.exp(-0.018 * dt);
      this.vx *= air;
      this.vy *= air;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    _resolveTracks(dt) {
      for (const segment of this.functionSegments) this._collideTrack(segment, dt);
    }

    _collideTrack(segment, dt) {
      const { a, b } = segment;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const length2 = abx * abx + aby * aby;
      if (length2 < 1e-10) return;

      let t = ((this.x - a.x) * abx + (this.y - a.y) * aby) / length2;
      t = Math.max(0, Math.min(1, t));

      const cx = a.x + t * abx;
      const cy = a.y + t * aby;
      const dx = this.x - cx;
      const dy = this.y - cy;
      const distance = Math.hypot(dx, dy);
      if (distance >= BALL_RADIUS + 0.004) return;

      const length = Math.sqrt(length2);
      const tx = abx / length;
      const ty = aby / length;
      let nx = -ty;
      let ny = tx;

      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }

      const signedDistance = dx * nx + dy * ny;
      if (signedDistance < -0.055) return;

      const penetration = BALL_RADIUS - signedDistance + 0.001;
      if (penetration <= 0) return;

      const wasSupported = this._preserveRolling || this.grounded;
      this.x += nx * penetration;
      this.y += ny * penetration;
      this.contact = true;
      this.grounded = true;

      const vn = this.vx * nx + this.vy * ny;
      if (vn >= 0) return;

      let vt = this.vx * tx + this.vy * ty;
      const impactSpeed = Math.abs(vn);
      const speedBefore = Math.hypot(this.vx, this.vy);

      if ((wasSupported || impactSpeed < 3) && Math.abs(vt) > 0.04) {
        vt = (Math.sign(vt) || 1) * speedBefore;
      }
      vt *= Math.exp(-0.008 * dt);

      const restitution = impactSpeed > 4 ? 0.035 : 0.012;
      const newVn = -vn * restitution;
      this.vx = tx * vt + nx * newVn;
      this.vy = ty * vt + ny * newVn;
    }

    _resolveCircles(dt) {
      for (const circle of this.circleSurfaces) {
        const dx = this.x - circle.h;
        const dy = this.y - circle.k;
        const distance = Math.hypot(dx, dy);
        if (distance < 1e-8) continue;

        const boundaryDistance = Math.abs(distance - circle.r);
        if (boundaryDistance >= BALL_RADIUS + 0.004) continue;

        const side = distance >= circle.r ? 1 : -1;
        const radialX = dx / distance;
        const radialY = dy / distance;
        const nx = radialX * side;
        const ny = radialY * side;
        const penetration = BALL_RADIUS - boundaryDistance + 0.001;
        const wasSupported = this._preserveRolling || this.grounded;

        this.x += nx * penetration;
        this.y += ny * penetration;
        this.contact = true;
        this.grounded = true;

        const vn = this.vx * nx + this.vy * ny;
        if (vn >= 0) continue;

        const tx = -ny;
        const ty = nx;
        let vt = this.vx * tx + this.vy * ty;
        const impactSpeed = Math.abs(vn);
        const speedBefore = Math.hypot(this.vx, this.vy);

        if ((wasSupported || impactSpeed < 2) && Math.abs(vt) > 0.04) {
          vt = (Math.sign(vt) || 1) * speedBefore;
        }
        vt *= Math.exp(-0.008 * dt);

        const restitution = impactSpeed > 4 ? 0.055 : 0.018;
        const newVn = -vn * restitution;
        this.vx = tx * vt + nx * newVn;
        this.vy = ty * vt + ny * newVn;
      }
    }

    _limitSpeed() {
      const speed = Math.hypot(this.vx, this.vy);
      const maxSpeed = 18;
      if (speed > maxSpeed) {
        this.vx *= maxSpeed / speed;
        this.vy *= maxSpeed / speed;
      }
    }
  }

  E.PhysicsRun = NaturalGravityRun;

  const R = E.Renderer.prototype;

  R.render = function renderLight(level, user, preview, physics) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    const bg = c.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(1, '#F8FBFA');
    c.fillStyle = bg;
    c.fillRect(0, 0, this.w, this.h);

    this.grid();

    if (level.phase === 'shape') {
      const targets = level.target
        .map((formula) => {
          try { return parseEquation(formula); } catch { return null; }
        })
        .filter(Boolean);
      targets.forEach((eq) => this.equation(eq, 'rgba(111,99,190,.72)', 4.5, [10, 7]));
      this.nodes(targets);
    } else {
      this.objects(level, physics);
    }

    user.forEach((eq, i) => this.equation(eq, i % 2 ? '#32AFA4' : '#178C82', 3.4));
    if (preview) this.equation(preview, 'rgba(197,139,7,.76)', 2.5, [6, 5]);
    if (level.phase === 'gravity' && physics) this.ball(physics);

    c.fillStyle = '#6E817D';
    c.font = '11px "Plus Jakarta Sans", sans-serif';
    c.fillText('x', this.w - 18, this.y(0) - 7);
    c.fillText('y', this.x(0) + 8, 15);
  };

  R.grid = function lightGrid() {
    const c = this.ctx;
    for (let x = Math.ceil(WORLD.xMin); x <= WORLD.xMax; x++) {
      c.beginPath();
      c.moveTo(this.x(x), 0);
      c.lineTo(this.x(x), this.h);
      c.strokeStyle = x === 0 ? 'rgba(72,101,95,.35)' : 'rgba(105,132,126,.12)';
      c.lineWidth = x === 0 ? 1.4 : 1;
      c.stroke();
      if (x && x % 2 === 0) {
        c.fillStyle = '#83938F';
        c.font = '10px "Plus Jakarta Sans", sans-serif';
        c.fillText(String(x), this.x(x) + 4, this.y(0) + 14);
      }
    }
    for (let y = Math.ceil(WORLD.yMin); y <= WORLD.yMax; y++) {
      c.beginPath();
      c.moveTo(0, this.y(y));
      c.lineTo(this.w, this.y(y));
      c.strokeStyle = y === 0 ? 'rgba(72,101,95,.35)' : 'rgba(105,132,126,.12)';
      c.lineWidth = y === 0 ? 1.4 : 1;
      c.stroke();
      if (y && y % 2 === 0) {
        c.fillStyle = '#83938F';
        c.font = '10px "Plus Jakarta Sans", sans-serif';
        c.fillText(String(y), this.x(0) + 6, this.y(y) - 5);
      }
    }
  };

  R.nodes = function lightNodes(targets) {
    const c = this.ctx;
    targets
      .flatMap((target) => sampleEquation(target, 24))
      .filter((_, i) => i % 7 === 0)
      .forEach((point) => {
        c.fillStyle = 'rgba(111,99,190,.58)';
        c.beginPath();
        c.arc(this.x(point.x), this.y(point.y), 2.5, 0, 2 * Math.PI);
        c.fill();
      });
  };

  R.spawn = function lightSpawn(x, y) {
    const c = this.ctx;
    const sx = this.x(x);
    const sy = this.y(y);
    c.save();
    c.fillStyle = 'rgba(185,77,89,.07)';
    c.strokeStyle = '#B94D59';
    c.lineWidth = 1.8;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.arc(sx, sy, 13, 0, 2 * Math.PI);
    c.fill();
    c.stroke();
    c.restore();
    c.fillStyle = '#91404A';
    c.font = '700 9px "Plus Jakarta Sans", sans-serif';
    c.fillText('DROP', sx - 13, sy - 18);
  };

  R.basket = function lightBasket(x, y) {
    const c = this.ctx;
    const sx = this.x(x);
    const sy = this.y(y);
    c.save();
    c.fillStyle = 'rgba(35,139,104,.08)';
    c.strokeStyle = '#238B68';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(sx - 18, sy - 8);
    c.lineTo(sx - 12, sy + 12);
    c.lineTo(sx + 12, sy + 12);
    c.lineTo(sx + 18, sy - 8);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  };

  R.star = function lightStar(x, y, done) {
    const c = this.ctx;
    c.save();
    c.translate(this.x(x), this.y(y));
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? 4 : 9;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
    c.fillStyle = done ? '#2EA879' : '#E8AA13';
    c.strokeStyle = done ? '#20825F' : '#C58B07';
    c.lineWidth = 1;
    c.fill();
    c.stroke();
    c.restore();
  };

  R.ball = function physicalBall(physics) {
    const c = this.ctx;

    if (physics.trail.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(23,140,130,.15)';
      c.lineWidth = 2.3;
      c.beginPath();
      physics.trail.forEach((point, i) => {
        if (i) c.lineTo(this.x(point.x), this.y(point.y));
        else c.moveTo(this.x(point.x), this.y(point.y));
      });
      c.stroke();
      c.restore();
    }

    const x = this.x(physics.x);
    const y = this.y(physics.y);
    const radius = Math.max(8, (BALL_RADIUS / (WORLD.xMax - WORLD.xMin)) * this.w);

    c.save();
    c.strokeStyle = 'rgba(83,112,106,.48)';
    c.fillStyle = '#617A75';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(x + radius + 11, y - 10);
    c.lineTo(x + radius + 11, y + 17);
    c.stroke();
    c.beginPath();
    c.moveTo(x + radius + 7, y + 12);
    c.lineTo(x + radius + 11, y + 17);
    c.lineTo(x + radius + 15, y + 12);
    c.stroke();
    c.font = '700 9px "Plus Jakarta Sans", sans-serif';
    c.fillText('g', x + radius + 18, y + 7);
    c.restore();

    const gradient = c.createRadialGradient(
      x - radius * .35,
      y - radius * .40,
      1,
      x,
      y,
      radius * 1.15
    );
    gradient.addColorStop(0, '#EFFFFC');
    gradient.addColorStop(.28, '#7DE0D6');
    gradient.addColorStop(.72, '#32AFA4');
    gradient.addColorStop(1, '#14766E');

    c.save();
    c.shadowColor = 'rgba(24,101,92,.24)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 3;
    c.fillStyle = gradient;
    c.strokeStyle = '#0F665F';
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(x, y, radius, 0, 2 * Math.PI);
    c.fill();
    c.stroke();

    c.strokeStyle = 'rgba(255,255,255,.82)';
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(
      x + Math.cos(physics.rotation) * radius * .78,
      y + Math.sin(physics.rotation) * radius * .78
    );
    c.stroke();
    c.restore();
  };
})();