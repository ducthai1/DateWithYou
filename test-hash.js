function getPinColor(lat, lng) {
  const val = Math.floor(lat * 111111) * 73856093 ^ Math.floor(lng * 111111) * 19349663;
  const hue = Math.abs(val) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}
console.log(getPinColor(10.7769, 106.7009));
console.log(getPinColor(10.7770, 106.7009)); // Very close
console.log(getPinColor(10.7769, 106.7010)); // Very close
