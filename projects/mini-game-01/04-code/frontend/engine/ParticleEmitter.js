/**
 * ParticleEmitter.js — 粒子特效系统
 * 按 UI 设计文档 §5.5 / §7.1 对齐参数
 * 合成成功粒子爆发、上菜星星特效、餐厅升级烟花特效
 * 低端机自动降级
 */

/** 检测是否为低端设备 */
function isLowEndDevice() {
  try {
    const sys = wx.getSystemInfoSync();
    const platform = sys.platform || '';
    const model = sys.model || '';
    if (platform === 'android') {
      const ver = parseFloat(sys.system ? sys.system.replace('Android ', '') : '9');
      return ver < 8;
    }
    if (platform === 'ios') {
      return model.includes('iPhone 5') || model.includes('iPhone 6') || model.includes('iPhone 7');
    }
  } catch (e) { /* ignore */ }
  return false;
}

const LOW_END = isLowEndDevice();

class Particle {
  constructor(x, y, vx, vy, life, color, size, type) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.type = type || 'dot';
    this.alive = true;
    this.gravity = 300;
    this.alpha = 1;
    this.currentSize = size;
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 6;
  }

  update(delta) {
    this.life -= delta;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vy += this.gravity * delta;
    this.x += this.vx * delta;
    this.y += this.vy * delta;

    const progress = 1 - (this.life / this.maxLife);
    this.alpha = 1 - progress;
    this.rotation += this.rotationSpeed * delta;

    if (this.type === 'star') {
      const peakProgress = 0.3;
      if (progress < peakProgress) {
        this.currentSize = this.size * (1 + progress / peakProgress * 2);
      } else {
        this.currentSize = this.size * 3 * (1 - (progress - peakProgress) / (1 - peakProgress));
      }
    } else {
      this.currentSize = this.size * this.alpha;
    }
  }
}

class ParticleEmitter {
  constructor() {
    this.particles = [];
    this._flashAlpha = 0;
    this._flashDuration = 0.1;
    this._flashRemaining = 0;
  }

  emit(type, x, y, opts) {
    const config = this._getConfig(type, opts);
    if (!config) return;

    const starCount = LOW_END ? Math.ceil(config.starCount / 2) : config.starCount;
    const sparkCount = LOW_END ? 0 : config.sparkCount;
    const dotCount = LOW_END ? 0 : config.dotCount;
    const total = starCount + sparkCount + dotCount;
    if (total === 0) return;

    for (let i = 0; i < starCount; i++) {
      const baseAngle = (Math.PI * 2 / starCount) * i;
      const angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 6);
      const speed = 80 + Math.random() * 120;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.4 + Math.random() * 0.2;
      const size = 8;
      const color = config.starColors[Math.floor(Math.random() * config.starColors.length)];
      this.particles.push(new Particle(x, y, vx, vy, life, color, size, 'star'));
    }

    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.35 + Math.random() * 0.25;
      const size = 2 + Math.random() * 3;
      const color = config.sparkColors[Math.floor(Math.random() * config.sparkColors.length)];
      this.particles.push(new Particle(x, y, vx, vy, life, color, size, 'spark'));
    }

    for (let i = 0; i < dotCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.3 + Math.random() * 0.3;
      const size = 1 + Math.random() * 2;
      const color = config.dotColors[Math.floor(Math.random() * config.dotColors.length)];
      this.particles.push(new Particle(x, y, vx, vy, life, color, size, 'dot'));
    }

    if (type === 'merge_lv3' || type === 'upgrade') {
      this._flashRemaining = this._flashDuration;
    }

    if (type === 'upgrade' && !LOW_END) {
      setTimeout(() => {
        for (let i = 0; i < Math.floor(sparkCount / 2); i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 120 + Math.random() * 180;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - 50;
          const life = 0.5 + Math.random() * 0.3;
          const color = config.sparkColors[Math.floor(Math.random() * config.sparkColors.length)];
          this.particles.push(new Particle(x, y, vx, vy, life, color, 4, 'spark'));
        }
      }, 200);
    }
  }

  _getConfig(type, opts) {
    switch (type) {
      case 'merge':
        return {
          starCount: opts && opts.starCount ? opts.starCount : 8,
          sparkCount: 12, dotCount: 20,
          starColors: ['#FFD700', '#FFB347', '#FFF44F'],
          sparkColors: ['#FFB347', '#FFD700', '#FFFFFF'],
          dotColors: ['#FF6B35', '#FFB347', '#FFA500']
        };
      case 'merge_lv3':
        return {
          starCount: 12, sparkCount: 16, dotCount: 24,
          starColors: ['#FFD700', '#FFB347', '#FFF44F', '#FFEC8B'],
          sparkColors: ['#FFB347', '#FFD700', '#FFFFFF', '#FF6B35'],
          dotColors: ['#FF6B35', '#FFB347', '#FFA500', '#FF5252']
        };
      case 'serve':
        return {
          starCount: 10, sparkCount: 6, dotCount: 8,
          starColors: ['#FFD700', '#FFF44F', '#FFFACD'],
          sparkColors: ['#FFD700', '#FFEC8B', '#FFFFFF'],
          dotColors: ['#FFB347', '#FFD700']
        };
      case 'upgrade':
        return {
          starCount: 16, sparkCount: 20, dotCount: 30,
          starColors: ['#FFD700', '#FF6B35', '#4CAF50', '#42A5F5', '#FFB347'],
          sparkColors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BB5', '#C9B1FF', '#FF8C42', '#4ECDC4'],
          dotColors: ['#FFD700', '#FF6B35', '#FFFFFF']
        };
      case 'star':
        return {
          starCount: opts && opts.starCount ? opts.starCount : 8,
          sparkCount: 0, dotCount: 4,
          starColors: ['#FFD700', '#FFEC8B', '#FFFACD', '#FFF44F'],
          sparkColors: [],
          dotColors: ['#FFD700', '#FFF44F']
        };
      default:
        return {
          starCount: 6, sparkCount: 6, dotCount: 8,
          starColors: ['#FFFFFF', '#CCCCCC'],
          sparkColors: ['#FFFFFF', '#CCCCCC', '#999999'],
          dotColors: ['#FFFFFF', '#CCCCCC']
        };
    }
  }

  update(delta) {
    if (this._flashRemaining > 0) {
      this._flashRemaining -= delta;
      this._flashAlpha = Math.max(0, this._flashRemaining / this._flashDuration);
    }
    for (const p of this.particles) {
      if (p.alive) p.update(delta);
    }
    this.particles = this.particles.filter(p => p.alive);
  }

  draw(ctx) {
    if (this._flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this._flashAlpha * 0.3})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    const sorted = [...this.particles].sort((a, b) => {
      const order = { dot: 0, spark: 1, star: 2 };
      return (order[a.type] || 0) - (order[b.type] || 0);
    });

    for (const p of sorted) {
      if (!p.alive) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === 'star') {
        this._drawStar(ctx, p.x, p.y, p.currentSize, p.color, p.rotation);
      } else if (p.type === 'spark') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.currentSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.currentSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawStar(ctx, cx, cy, size, color, rotation) {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.5;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      } else {
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  stop() {
    this.particles = [];
    this._flashAlpha = 0;
    this._flashRemaining = 0;
  }

  isActive() {
    return this.particles.length > 0 || this._flashRemaining > 0;
  }
}

module.exports = ParticleEmitter;
