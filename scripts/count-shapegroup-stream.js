const fs = require('fs');
const path = process.argv[2] || 'public/data/geoBoundaries/ADM1.geojson';
const isos = process.argv.slice(3).length ? process.argv.slice(3) : ['AUS','BRA','EGY','AFG'];
const counts = Object.fromEntries(isos.map(i=>[i,0]));
const reMap = Object.fromEntries(isos.map(i=>[i,new RegExp('"shapeGroup"\\s*:\\s*"'+i+'"','g')]));
const stream = fs.createReadStream(path, { encoding: 'utf8', highWaterMark: 1024*1024 });
let tail = '';
stream.on('data', chunk => {
  const text = tail + chunk;
  for (const iso of isos) {
    const re = reMap[iso];
    let m;
    while ((m = re.exec(text)) !== null) counts[iso]++;
    // reset lastIndex for next iteration because we reuse same regex on new text
    re.lastIndex = 0;
  }
  // keep last 200 chars to catch boundary matches
  tail = text.slice(-200);
});
stream.on('end', () => {
  for (const iso of isos) console.log(iso+':', counts[iso]);
});
stream.on('error', e => { console.error('ERROR', e && e.message); process.exit(2); });
