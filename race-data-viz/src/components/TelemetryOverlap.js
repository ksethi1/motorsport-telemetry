export function getDualHoverPoints(index, slowData, fastData) {
  const slow = slowData[index] || null;
  const fast = fastData[index] || null;
  return { slow, fast };
}

export function renderDualTelemetryCursor(index, slowData, fastData, projectFn) {
  const cursors = [];

  const slow = slowData[index];
  const fast = fastData[index];

  if (slow) {
    const [x, y] = projectFn(slow.Lon, slow.Lat);
    cursors.push(<circle key="slow-cursor" cx={x} cy={y} r={4} fill="blue" />);
  }

  if (fast) {
    const [x, y] = projectFn(fast.Lon, fast.Lat);
    cursors.push(<circle key="fast-cursor" cx={x} cy={y} r={4} fill="green" />);
  }

  return cursors;
}
