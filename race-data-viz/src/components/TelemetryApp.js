/*
Joey - default 2D track with corresponding line graphs that track user's curson on the racetrack
[tried with .csv file and ran into difficulties, so I transformed it to a .json file; used example data from the original proposal]
*/

import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';

export default function TelemetryViewer() {
  // Store the telemetry data and currently hovered point
  const [data, setData] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);
  const containerRef = useRef();

  // Load the full telemetry JSON file when the component mounts
  useEffect(() => {
    fetch('/data/telemetry_full.json')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data.length) return <div>Loading...</div>;

  // SVG canvas dimensions and padding
  const width = 400;
  const height = 500;
  const padding = 40;

  // Compute lat/lon ranges from telemetry
  const lons = data.map(p => p.Lon);
  const lats = data.map(p => p.Lat);
  const lonRange = d3.extent(lons);
  const latRange = d3.extent(lats);

  // Determine scaling factor to fit track in box
  const scale = Math.min(
    (width - 2 * padding) / (lonRange[1] - lonRange[0]),
    (height - 2 * padding) / (latRange[1] - latRange[0])
  );

  // Compute the center point of the track
  const lonCenter = (lonRange[0] + lonRange[1]) / 2;
  const latCenter = (latRange[0] + latRange[1]) / 2;

  // Convert lat/lon into X/Y screen coordinates
  const project = (lon, lat) => {
    const x = (lon - lonCenter) * scale + width / 2;
    const y = height / 2 - (lat - latCenter) * scale;
    return [x, y];
  };

  // Find the closest point on the track to the cursor
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

  // Choose which telemetry metrics to show as side graphs
  const metrics = ['Speed', 'Throttle', 'RPM'];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Track display */}
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
          {/* Start/Finish marker */}
          {(() => {
            const [x, y] = project(data[0].Lon, data[0].Lat);
            return (
              <g>
                <circle cx={x} cy={y} r={5} fill="limegreen" stroke="black" strokeWidth={1} />
                <text x={x + 8} y={y + 4} fontSize={12} fill="green">Start / Finish</text>
              </g>
            );
          })()}

          {/* Track point circles */}
          {data.map((p, i) => {
            const [x, y] = project(p.Lon, p.Lat);
            const isActive = i === hoverIndex;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isActive ? 3 : 1.5}
                fill={isActive ? 'red' : 'black'}
              />
            );
          })}
        </svg>
      </div>

      {/* Telemetry line graphs */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'scroll' }}>
        {metrics.map(metric => (
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

// Render one telemetry graph (Speed, Throttle, RPM)
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

  // Draw Y-axis ticks using d3
  useEffect(() => {
    if (yAxisRef.current) {
      const yAxis = d3.axisLeft(y).ticks(4);
      d3.select(yAxisRef.current).call(yAxis);
    }
  }, [y]);

  return (
    <svg width={width} height={height} style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px solid #ccc' }}>
      {/* Y-axis ticks */}
      <g ref={yAxisRef} transform={`translate(${padding},0)`} />

      {/* Graph line */}
      <path
        d={line(data)}
        fill="none"
        stroke="steelblue"
        strokeWidth={1.5}
      />

      {/* Hover point marker */}
      {hoverIndex !== null && (
        <circle
          cx={x(hoverIndex)}
          cy={y(data[hoverIndex][metric])}
          r={4}
          fill="red"
        />
      )}

      {/* Title with units */}
      <text x={padding} y={20} fontSize={14} fill="#333">{metric} ({getUnits(metric)})</text>
    </svg>
  );
}

// Helper to show units for each telemetry metric
function getUnits(metric) {
  switch (metric) {
    case 'Speed': return 'm/s';
    case 'Throttle': return '%';
    case 'RPM': return 'rpm';
    default: return '';
  }
}