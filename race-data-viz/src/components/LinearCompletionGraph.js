import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

export default function LapCompletionGraph({
  racer1Data,
  racer2Data,
  hoverIndex,
  width = 400,
  height = 60,
}) {
  const padding = 40;
  const xAxisRef = useRef(null);

  const truncateAfterLapReset = (data) => {
    for (let i = 1; i < data.length; i++) {
      if (data[i].LapDistPct < data[i - 1].LapDistPct - 0.1) {
        return data.slice(0, i);
      }
    }
    return data;
  };

  const computeFrameTime = (data, step = (1/60)) => {
    return data.map((d, i) => ({
      time: i * step,
      lapPct: d.LapDistPct,
    }));
  };

  const cleanR1 = computeFrameTime(truncateAfterLapReset(racer1Data));
  const cleanR2 = computeFrameTime(truncateAfterLapReset(racer2Data));

  const maxTime = Math.max(
    cleanR1.at(-1)?.time || 0,
    cleanR2.at(-1)?.time || 0
  );

  const x = d3.scaleLinear().domain([0, maxTime]).range([padding, width - padding]);

  // Format seconds into mm:ss or ss
  const formatTime = (t) => {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${seconds}s`;
  };

  useEffect(() => {
    if (xAxisRef.current) {
      const rawTicks = x.ticks(5); // D3's default ~11 ticks
      const finalTick = maxTime;
  
      // Ensure final tick is included
      const hasFinal = rawTicks.some((t) => Math.abs(t - finalTick) < 1e-6);
      const ticks = hasFinal ? rawTicks : [...rawTicks, finalTick];
  
      d3.select(xAxisRef.current).call(
        d3.axisBottom(x)
          .tickValues(ticks)
          .tickFormat(formatTime)
      );
    }
  }, [x, maxTime]);
  

  return (
    <svg
      width={width}
      height={height}
      style={{ background: "#fff", borderBottom: "1px solid #ccc" }}
    >
      <g ref={xAxisRef} transform={`translate(0,${height - 20})`} />

      <line
        x1={x(0)}
        y1={height / 2}
        x2={x(maxTime)}
        y2={height / 2}
        stroke="#ccc"
        strokeWidth={4}
      />

      {hoverIndex !== null && cleanR1[hoverIndex] && (
        <circle
          cx={x(cleanR1[hoverIndex].time)}
          cy={height / 2 - 6}
          r={5}
          fill="blue"
        />
      )}

      {hoverIndex !== null && cleanR2[hoverIndex] && (
        <circle
          cx={x(cleanR2[hoverIndex].time)}
          cy={height / 2 + 6}
          r={5}
          fill="green"
        />
      )}

      <text x={padding} y={14} fontSize={12} fill="#333">
        Lap Progress (Time)
      </text>
    </svg>
  );
}
