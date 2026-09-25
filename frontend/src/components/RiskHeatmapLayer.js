import L from 'leaflet';

export const RiskHeatmapLayer = L.Layer.extend({
  initialize: function (points, options) {
    this.points = points; // [{lat, lon, value}]
    this.getColor = options.getColor;
    this.getTier = options.getTier;
    L.setOptions(this, options);
  },
  onAdd: function (map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-zoom-animated');
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.opacity = '0.9'; // Transparency handled by fill colors mostly
    map.getPanes().overlayPane.appendChild(this._canvas);
    map.on('moveend', this._reset, this);
    map.on('resize', this._reset, this);
    this._reset();
  },
  onRemove: function (map) {
    L.DomUtil.remove(this._canvas);
    map.off('moveend', this._reset, this);
    map.off('resize', this._reset, this);
  },
  updatePoints: function (points) {
    this.points = points;
    this._draw();
  },
  _reset: function () {
    const map = this._map;
    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this._draw();
  },
  _draw: function () {
    const ctx = this._canvas.getContext('2d');
    const w = this._canvas.width;
    const h = this._canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    if (!this.points || this.points.length === 0) return;

    // Filter points that have lat/lon/val
    const validPts = this.points.filter(p => p.lat != null && p.lon != null && p.value != null);
    if (validPts.length === 0) return;

    const pts = validPts.map(p => {
      const pt = this._map.latLngToContainerPoint([p.lat, p.lon]);
      return { x: pt.x, y: pt.y, v: p.value };
    });

    const step = 4;
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    const grid = new Float32Array(rows * cols);
    
    // Dynamically calculate grid spacing to make radius zoom-responsive
    let minPointDist = Infinity;
    if (pts.length > 1) {
      for (let i = 0; i < pts.length; i++) {
        for (let j = i+1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d > 0 && d < minPointDist) minPointDist = d;
        }
      }
    }
    if (minPointDist === Infinity || minPointDist > 500) minPointDist = 150;
    
    const maxDist2 = Math.pow(minPointDist * 1.3, 2); // Defines the outer boundary of the localized blob
    const smoothFactor = Math.pow(minPointDist * 0.8, 2); 
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * step + step / 2;
        const cy = r * step + step / 2;
        
        let num = 0, den = 0;
        let minD2 = Infinity;
        
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const d2 = (cx - p.x) ** 2 + (cy - p.y) ** 2;
          if (d2 < minD2) minD2 = d2;
          const w_i = 1 / (d2 + smoothFactor); 
          num += p.v * w_i;
          den += w_i;
        }
        
        if (minD2 > maxDist2) {
           grid[r * cols + c] = -1; // Outside blob -> Transparent
        } else {
           grid[r * cols + c] = num / den;
        }
      }
    }
    
    // Draw continuous interpolated fills
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid[r * cols + c];
        if (val >= 0) {
          ctx.fillStyle = this.getColor(val).fill;
          ctx.fillRect(c * step, r * step, step + 1, step + 1); // +1 to prevent subpixel gaps
        }
      }
    }
    
    // Draw discrete borders (between tiers AND outer edge of blob)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid[r * cols + c];
        const rightVal = c < cols - 1 ? grid[r * cols + c + 1] : -1;
        const downVal = r < rows - 1 ? grid[(r + 1) * cols + c] : -1;
        
        const t = val >= 0 ? this.getTier(val) : -1;
        const right = rightVal >= 0 ? this.getTier(rightVal) : -1;
        const down = downVal >= 0 ? this.getTier(downVal) : -1;
        
        if (t >= 0) {
          if (t !== right) {
            ctx.fillStyle = this.getColor(null, t).border;
            ctx.fillRect(c * step + step - 1, r * step, 2, step);
          }
          if (t !== down) {
            ctx.fillStyle = this.getColor(null, t).border;
            ctx.fillRect(c * step, r * step + step - 1, step, 2);
          }
        } else {
          // If we are transparent, but right or down is a tier, draw border on them
          if (right >= 0) {
            ctx.fillStyle = this.getColor(null, right).border;
            ctx.fillRect(c * step + step - 1, r * step, 2, step);
          }
          if (down >= 0) {
            ctx.fillStyle = this.getColor(null, down).border;
            ctx.fillRect(c * step, r * step + step - 1, step, 2);
          }
        }
      }
    }
  }
});
