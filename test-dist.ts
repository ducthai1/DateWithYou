type LatLng = { lat: number; lng: number };

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Distance from point P to segment AB
function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): { distance: number, projection: LatLng } {
  // Simple Euclidean projection on equirectangular map (valid for small distances)
  const px = p.lng; const py = p.lat;
  const ax = a.lng; const ay = a.lat;
  const bx = b.lng; const by = b.lat;
  
  const l2 = (bx - ax)**2 + (by - ay)**2;
  if (l2 === 0) return { distance: haversineM(p, a), projection: a };
  
  // Projection factor t
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t)); // clamp to segment
  
  const proj = { lat: ay + t * (by - ay), lng: ax + t * (bx - ax) };
  return { distance: haversineM(p, proj), projection: proj };
}

console.log(distanceToSegment({lat: 10, lng: 10}, {lat: 10, lng: 9}, {lat: 10, lng: 11}));
console.log(distanceToSegment({lat: 11, lng: 10}, {lat: 10, lng: 9}, {lat: 10, lng: 11}));
