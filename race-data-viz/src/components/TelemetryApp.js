import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';

// Main component that loads telemetry data and renders both the track map and graphs
export default function TelemetryViewer() {
  const [data, setData] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [selectedMapMetric, setSelectedMapMetric] = useState('Speed');
  const [selectedGraphMetrics, setSelectedGraphMetrics] = useState(['Speed', 'Throttle', 'RPM']);
  const containerRef = useRef();

  // Fetch telemetry data once when component mounts
  useEffect(() => {
    fetch('/data/telemetry_full.json')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data.length) return <div>Loading...</div>;

  const width = 400;
  const height = 500;
  const padding = 40;

  const lons = data.map(p => p.Lon);
  const lats = data.map(p => p.Lat);
  const lonRange = d3.extent(lons);
  const latRange = d3.extent(lats);

  // Calculate scale and center for projection based on GPS bounds
  const scale = Math.min(
    (width - 2 * padding) / (lonRange[1] - lonRange[0]),
    (height - 2 * padding) / (latRange[1] - latRange[0])
  );

  const lonCenter = (lonRange[0] + lonRange[1]) / 2;
  const latCenter = (latRange[0] + latRange[1]) / 2;

  // Project Lon/Lat to SVG x/y coordinates
  const project = (lon, lat) => {
    const x = (lon - lonCenter) * scale + width / 2;
    const y = height / 2 - (lat - latCenter) * scale;
    return [x, y];
  };

  // Find the closest data point to a mouse x/y coordinate
  const findClosestIndex = (x, y) => {
    let minDist = Infinity;
    let closest = null;
    data.forEach((d, i) => {
      const [px, py] = project(d.Lon, d.Lat);
      const dist = Math.hypot(px - x, py - y);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  };

  // Extract numeric telemetry metrics to show in dropdowns
  const metrics = Object.keys(data[0]).filter(k => typeof data[0][k] === 'number' && !['Lon', 'Lat'].includes(k));

  // Color scale based on selected map metric
  const metricExtent = d3.extent(data, d => d[selectedMapMetric]);
  const colorScale = d3.scaleLinear()
    .domain([metricExtent[0], (metricExtent[0] + metricExtent[1]) / 2, metricExtent[1]])
    .range(['yellow', 'orange', 'red']);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Dropdown to select heatmap metric */}
        <div style={{ padding: 10 }}>
          <label style={{ fontSize: 14, fontWeight: 'bold', marginRight: 8 }}>Track Map Metric:</label>
          <select value={selectedMapMetric} onChange={e => setSelectedMapMetric(e.target.value)}>
            {metrics.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Track map with heatmap overlay and hover tracking */}
        <div
          ref={containerRef}
          style={{ width: width, height: height, background: 'white', border: '1px solid #ccc', cursor: 'pointer', position: 'relative' }}
          onMouseMove={(e) => {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const index = findClosestIndex(x, y);
            setHoverIndex(index);
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg width={width} height={height}>
            {/* Draw green line from start to finish */}
            {(() => {
              const [x1, y1] = project(data[0].Lon, data[0].Lat);
              const [x2, y2] = project(data[data.length - 1].Lon, data[data.length - 1].Lat);
              return (
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="green" strokeWidth={2} />
              );
            })()}

            {/* Plot track as color-coded dots */}
            {data.map((p, i) => {
              const [x, y] = project(p.Lon, p.Lat);
              const isActive = i === hoverIndex;
              const fill = colorScale(p[selectedMapMetric]);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={isActive ? 3 : 1.5}
                  fill={fill}
                  stroke={isActive ? 'black' : 'none'}
                />
              );
            })}
          </svg>

          {/* Heatmap legend for the track map */}
          <div style={{ position: 'absolute', bottom: 10, left: 10, background: '#fff', padding: '4px 8px', border: '1px solid #ccc', fontSize: 12 }}>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'red', marginRight: 4 }}></span>High ({Math.round(metricExtent[1])} {getUnits(selectedMapMetric)})</div>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'orange', marginRight: 4 }}></span>Mid ({Math.round((metricExtent[0] + metricExtent[1]) / 2)} {getUnits(selectedMapMetric)})</div>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'yellow', marginRight: 4 }}></span>Low ({Math.round(metricExtent[0])} {getUnits(selectedMapMetric)})</div>
          </div>
        </div>
      </div>

      {/* Graphs for selected metrics */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'scroll' }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 'bold', marginRight: 8 }}>Graph Metrics:</label>
          <select
            multiple
            value={selectedGraphMetrics}
            onChange={e => setSelectedGraphMetrics(Array.from(e.target.selectedOptions, o => o.value))}
            style={{ minWidth: 200, height: 100 }}
          >
            {metrics.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {selectedGraphMetrics.map(metric => (
          <MetricGraph
            key={metric}
            data={data}
            metric={metric}
            hoverIndex={hoverIndex}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Render a time-series line graph for the given metric
 * @param {Array} data - telemetry data array
 * @param {string} metric - metric to plot
 * @param {number|null} hoverIndex - current hover index
 */
function MetricGraph({ data, metric, hoverIndex }) {
  const width = 600;
  const height = 150;
  const padding = 40;
  const yAxisRef = useRef(null);

  const x = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([padding, width - padding]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d[metric]))
    .range([height - padding, padding]);

  const line = d3.line()
    .x((d, i) => x(i))
    .y(d => y(d[metric]));

  // Draw y-axis ticks on metric change
  useEffect(() => {
    if (yAxisRef.current) {
      const yAxis = d3.axisLeft(y).ticks(4);
      d3.select(yAxisRef.current).call(yAxis);
    }
  }, [y]);

  return (
    <svg width={width} height={height} style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px solid #ccc' }}>
      <g ref={yAxisRef} transform={`translate(${padding},0)`} />
      <path
        d={line(data)}
        fill="none"
        stroke="steelblue"
        strokeWidth={1.5}
      />
      {hoverIndex !== null && (
        <circle
          cx={x(hoverIndex)}
          cy={y(data[hoverIndex][metric])}
          r={4}
          fill="red"
        />
      )}
      <text x={padding} y={20} fontSize={14} fill="#333">{metric} ({getUnits(metric)})</text>
    </svg>
  );
}

/**
 * Return units for a given telemetry metric
 * @param {string} metric - metric name
 * @returns {string} units of the metric
 */
function getUnits(metric) {
  switch (metric) {
    case 'Speed': return 'm/s';
    case 'Throttle': return '%';
    case 'RPM': return 'rpm';
    default: return '';
  }
}
