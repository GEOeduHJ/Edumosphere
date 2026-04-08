const fs = require('fs');
const path = process.argv[2] || 'public/data/geoBoundaries/ADM1.geojson';
const isos = process.argv.slice(3).length ? process.argv.slice(3) : ['AUS','BRA','EGY','AFG'];
try {
  const s = fs.readFileSync(path, 'utf8');
  for (const iso of isos) {
    const re = new RegExp('"shapeGroup"\s*:\s*"' + iso + '"', 'g');
    const m = s.match(re) || [];
    console.log(iso + ':', m.length);
  }
} catch (e) {
  console.error('ERROR', e && e.message);
  process.exit(2);
}
