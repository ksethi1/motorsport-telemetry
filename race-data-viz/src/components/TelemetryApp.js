import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { renderDualTelemetryCursor } from './TelemetryOverlap';

export default function TelemetryViewer() {
  const [slowData, setSlowData] = useState([]);
  const [fastData, setFastData] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [selectedMapMetric, setSelectedMapMetric] = useState('Speed');
  const [selectedGraphMetrics, setSelectedGraphMetrics] = useState(['Speed', 'Throttle', 'RPM']);
  const [focus, setFocus] = useState('slow');
  const containerRef = useRef();

  useEffect(() => {
    Promise.all([
      fetch('/data/slowest_lap.json').then(res => res.json()),
      fetch('/data/fastest_lap.json').then(res => res.json())
    ]).then(([slow, fast]) => {
      setSlowData(slow.telemetry);
      setFastData(fast.telemetry);
    });
  }, []);

  if (!slowData.length || !fastData.length) return <div>Loading...</div>;

  const width = 400;
  const height = 500;
  const padding = 40;

  const focusedData = focus === 'slow' ? slowData : fastData;
  const allData = [...slowData, ...fastData];
  const lons = allData.map(p => p.Lon);
  const lats = allData.map(p => p.Lat);
  const lonRange = d3.extent(lons);
  const latRange = d3.extent(lats);

  const scale = Math.min(
    (width - 2 * padding) / (lonRange[1] - lonRange[0]),
    (height - 2 * padding) / (latRange[1] - latRange[0])
  );

  const lonCenter = (lonRange[0] + lonRange[1]) / 2;
  const latCenter = (latRange[0] + latRange[1]) / 2;

  const project = (lon, lat) => {
    const x = (lon - lonCenter) * scale + width / 2;
    const y = height / 2 - (lat - latCenter) * scale;
    return [x, y];
  };

  const findClosestIndex = (x, y) => {
    let minDist = Infinity;
    let closest = null;
    focusedData.forEach((d, i) => {
      const [px, py] = project(d.Lon, d.Lat);
      const dist = Math.hypot(px - x, py - y);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  };

  const metrics = Object.keys(slowData[0]).filter(k => typeof slowData[0][k] === 'number' && !['Lon', 'Lat'].includes(k));
  const metricExtent = d3.extent([...slowData, ...fastData], d => d[selectedMapMetric]);
  const colorScale = d3.scaleLinear()
    .domain([metricExtent[0], (metricExtent[0] + metricExtent[1]) / 2, metricExtent[1]])
    .range(['yellow', 'orange', 'red']);

  const formatRange = (min, max) => `${Math.round(min)}–${Math.round(max)} ${getUnits(selectedMapMetric)}`;
  const rangeLow = formatRange(metricExtent[0], (metricExtent[0] + metricExtent[1]) / 3);
  const rangeMid = formatRange((metricExtent[0] + metricExtent[1]) / 3, (2 * metricExtent[0] + metricExtent[1]) / 3);
  const rangeHigh = formatRange((2 * metricExtent[0] + metricExtent[1]) / 3, metricExtent[1]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 10 }}>
          <label style={{ fontSize: 14, fontWeight: 'bold', marginRight: 8 }}>Track Map Metric:</label>
          <select value={selectedMapMetric} onChange={e => setSelectedMapMetric(e.target.value)}>
            {metrics.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div
          ref={containerRef}
          style={{ width, height, background: 'white', border: '1px solid #ccc', cursor: 'pointer', position: 'relative' }}
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
            {(() => {
              const [x1, y1] = project(slowData[0].Lon, slowData[0].Lat);
              const [x2, y2] = project(slowData[slowData.length - 1].Lon, slowData[slowData.length - 1].Lat);
              return (
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="green" strokeWidth={2} />
              );
            })()}

            {[...slowData, ...fastData].map((p, i) => {
              const [x, y] = project(p.Lon, p.Lat);
              const fill = colorScale(p[selectedMapMetric]);
              return (
                <circle key={i} cx={x} cy={y} r={1.5} fill={fill} />
              );
            })}

            {hoverIndex !== null && renderDualTelemetryCursor(hoverIndex, slowData, fastData, project)}
          </svg>

          <div style={{ position: 'absolute', bottom: 10, left: 10, background: '#fff', padding: '4px 8px', border: '1px solid #ccc', fontSize: 12 }}>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'red', marginRight: 4 }}></span>{rangeHigh}</div>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'orange', marginRight: 4 }}></span>{rangeMid}</div>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'yellow', marginRight: 4 }}></span>{rangeLow}</div>
          </div>

          <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 12 }}>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'blue', marginRight: 4 }}></span>Racer 1</div>
            <div><span style={{ display: 'inline-block', width: 12, height: 12, background: 'green', marginRight: 4 }}></span>Racer 2</div>
          </div>

          <button
            onClick={() => setFocus(focus === 'slow' ? 'fast' : 'slow')}
            style={{ position: 'absolute', bottom: 10, right: 10, padding: '6px 10px', background: '#444', color: 'white', border: 'none', borderRadius: 4 }}
          >
            Switch Focus ({focus === 'slow' ? 'Racer 1' : 'Racer 2'})
          </button>
        </div>
      </div>

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
          <DualMetricGraph
            key={metric}
            metric={metric}
            hoverIndex={hoverIndex}
            slowData={slowData}
            fastData={fastData}
          />
        ))}
      </div>
    </div>
  );
}

function DualMetricGraph({ metric, hoverIndex, slowData, fastData }) {
  const width = 800;
  const height = 200;
  const padding = 40;
  const yAxisRef = useRef(null);
  const xAxisRef = useRef(null);

  const x = d3.scaleLinear()
    .domain([0, Math.max(slowData.length, fastData.length) - 1])
    .range([padding, width - padding]);

  const y = d3.scaleLinear()
    .domain(d3.extent([...slowData, ...fastData], d => d[metric]))
    .range([height - padding, padding]);

  const lineSlow = d3.line().x((d, i) => x(i)).y(d => y(d[metric]));
  const lineFast = d3.line().x((d, i) => x(i)).y(d => y(d[metric]));

  useEffect(() => {
    if (yAxisRef.current) {
      const yAxis = d3.axisLeft(y).ticks(4);
      d3.select(yAxisRef.current).call(yAxis);
    }
    if (xAxisRef.current) {
      const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d => `${(d * 0.05).toFixed(1)}s`);
      d3.select(xAxisRef.current).call(xAxis);
    }
  }, [y, x]);

  return (
    <svg width={width} height={height} style={{ marginBottom: '30px', background: '#f9f9f9', border: '1px solid #ccc' }}>
      <g ref={yAxisRef} transform={`translate(${padding},0)`} />
      <g ref={xAxisRef} transform={`translate(0,${height - padding})`} />
      <path d={lineSlow(slowData)} fill="none" stroke="blue" strokeWidth={1.5} />
      <path d={lineFast(fastData)} fill="none" stroke="green" strokeWidth={1.5} />
      {hoverIndex !== null && (
        <>
          <circle cx={x(hoverIndex)} cy={y(slowData[hoverIndex]?.[metric])} r={4} fill="blue" />
          <circle cx={x(hoverIndex)} cy={y(fastData[hoverIndex]?.[metric])} r={4} fill="green" />
        </>
      )}
      <text x={padding} y={20} fontSize={14} fill="#333">{metric} ({getUnits(metric)})</text>
    </svg>
  );
}

function getUnits(metric) {
  switch (metric) {
    case 'Speed': return 'km/h';
    case 'Throttle': return '%';
    case 'RPM': return 'rpm';
    default: return '';
  }
}
