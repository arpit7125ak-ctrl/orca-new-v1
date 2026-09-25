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

    const step = 6;
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    const grid = new Float32Array(rows * cols);
    
    // Smoothing factor (larger = smoother, more oceanographic)
    const smoothFactor = 12000;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * step + step / 2;
        const cy = r * step + step / 2;
        let num = 0, den = 0;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const d2 = (cx - p.x) ** 2 + (cy - p.y) ** 2;
          const w_i = 1 / (d2 + smoothFactor); 
          num += p.v * w_i;
          den += w_i;
        }
        grid[r * cols + c] = num / den;
      }
    }
    
    // Draw continuous interpolated fills
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid[r * cols + c];
        ctx.fillStyle = this.getColor(val).fill;
        ctx.fillRect(c * step, r * step, step, step);
      }
    }
    
    // Draw discrete borders
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid[r * cols + c];
        const t = this.getTier(val);
        const right = c < cols - 1 ? this.getTier(grid[r * cols + c + 1]) : t;
        const down = r < rows - 1 ? this.getTier(grid[(r + 1) * cols + c]) : t;
        
        if (t !== right || t !== down) {
          const maxTier = Math.max(t, right, down);
          ctx.fillStyle = this.getColor(null, maxTier).border; // pass null for val, pass explicit tier
          if (t !== right) ctx.fillRect(c * step + step - 1, r * step, 2, step);
          if (t !== down) ctx.fillRect(c * step, r * step + step - 1, step, 2);
        }
      }
    }
  }
});
