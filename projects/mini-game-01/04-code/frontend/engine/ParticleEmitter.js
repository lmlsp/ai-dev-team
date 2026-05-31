/**
 * ParticleEmitter.js — 粒子特效系统
 * 合成成功粒子爆发、上菜星星特效、餐厅升级烟花特效
 */
class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.alive = true;
    this.gravity = 0.15;
  }

  update(delta) {
    this.life -= delta;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vy += this.gravity * delta * 60;
    this.x += this.vx * delta * 60;
    this.y += this.vy * delta * 60;
    // 衰减透明度
    this.alpha = Math.max(0, this.life / this.maxLife);
    // 衰减大小
    this.currentSize = this.size * this.alpha;
  }
}

class ParticleEmitter {
  constructor() {
    /** @type {Particle[]>} */
    this.particles = [];
    this._running = false;
  }

  /**
   * 发射粒子特效
   * @param {string} type - 'merge' | 'serve' | 'upgrade' | 'star'
   * @param {number} x - 发射中心 X
   * @param {number} y - 发射中心 Y
   */
  emit(type, x, y) {
    const colors = this._getColors(type);
    const count = this._getCount(type);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 2; // 初始向上
      const life = 0.5 + Math.random() * 0.8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 3 + Math.random() * 6;

      const p = new Particle(x, y, vx, vy, life, color, size);
      this.particles.push(p);
    }

    // 对于 upgrade 类型，发射第二波延迟粒子
    if (type === 'upgrade') {
      setTimeout(() => {
        for (let i = 0; i < count / 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 5;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - 3;
          const color = colors[Math.floor(Math.random() * colors.length)];
          const p = new Particle(x, y, vx, vy, 0.8, color, 4);
          this.particles.push(p);
        }
      }, 200);
    }
  }

  _getColors(type) {
    switch (type) {
      case 'merge':
        return ['#FFD700', '#FFA500', '#FF6347', '#FFE4B5', '#FF8C00'];
      case 'serve':
        return ['#FFD700', '#FFF44F', '#FFE4B5', '#FFFACD', '#FFEC8B'];
      case 'upgrade':
        return ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BB5',
          '#C9B1FF', '#FF8C42', '#4ECDC4'];
      case 'star':
        return ['#FFD700', '#FFEC8B', '#FFFACD', '#FFF44F'];
      default:
        return ['#FFFFFF', '#CCCCCC', '#999999'];
    }
  }

  _getCount(type) {
    switch (type) {
      case 'merge': return 12;
      case 'serve': return 18;
      case 'upgrade': return 36;
      case 'star': return 8;
      default: return 10;
    }
  }

  /**
   * 更新所有粒子状态
   * @param {number} delta - 距离上一帧的秒数
   */
  update(delta) {
    for (const p of this.particles) {
      if (p.alive) p.update(delta);
    }
    // 清理死亡粒子
    this.particles = this.particles.filter(p => p.alive);
  }

  /**
   * 绘制所有粒子
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha || 1;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.currentSize || p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 停止所有粒子（立即清除）
   */
  stop() {
    this.particles = [];
  }

  /**
   * 是否有活跃粒子
   */
  isActive() {
    return this.particles.length > 0;
  }
}

module.exports = ParticleEmitter;
