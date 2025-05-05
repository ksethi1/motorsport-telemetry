import React, { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { renderDualTelemetryCursor } from "./TelemetryOverlap";
import LapCompletionGraph from "./LinearCompletionGraph";
import GoogleTrackMap from "./GoogleTrackMap";

const GOOGLE_MAPS_API_KEY = "XXXXXXXXXXXX"; // <-- CHANGE TO YOUR API KEY (Joey)

// Define keys to map raw telemetry array data to objects
const DATA_KEYS = [
  "Speed",
  "LapDistPct",
  "Lat",
  "Lon",
  "Brake",
  "Throttle",
  "RPM",
  "SteeringWheelAngle",
  "Gear",
  "Clutch",
  "ABSActive",
  "DRSActive",
  "LatAccel",
  "Yaw",
  "PositionType",
];

export default function TelemetryViewer() {
  // Track and player state
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState("");
  const [players, setPlayers] = useState([]);
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Parsed telemetry data for each player
  const [player1Data, setPlayer1Data] = useState([]);
  const [player2Data, setPlayer2Data] = useState([]);

  // UI + interaction state
  const [hoverIndex, setHoverIndex] = useState(null);
  const [selectedMapMetric, setSelectedMapMetric] = useState("Speed");
  const [selectedGraphMetrics, setSelectedGraphMetrics] = useState([
    "Throttle",
    "Speed",
    "Brake",
  ]);
  const [focus, setFocus] = useState("racer1");

  const containerRef = useRef();

  // Parse array of values to named object using DATA_KEYS
  const parseData = (raw) =>
    raw.map((row) =>
      Object.fromEntries(
        DATA_KEYS.map((key, i) => [
          key,
          key === "Speed" ? row[i] * 2.24 : row[i], // Convert Speed from m/s to mph
        ]),
      ),
    );

  // Format and compute the lap time for focused racer
  const computeFrameTime = (data, step = 1 / 60) =>
    data.map((d, i) => ({
      time: i * step,
      lapPct: d.LapDistPct,
    }));

  const formatTime = (t) => {
    const minutes = Math.floor(t / 60);
    const seconds = t % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds.toFixed(2).padStart(5, "0")}s`;
    }
    return `${seconds.toFixed(2)}s`;
  };

  // Load list of tracks on mount
  useEffect(() => {
    fetch("https://dv-telemetry-load.azurewebsites.net/api/tracks")
      .then((res) => res.json())
      .then(setTracks)
      .catch((err) => console.error("Error fetching tracks:", err));
  }, []);

  // Load players for selected track
  useEffect(() => {
    if (selectedTrack) {
      fetch(
        `https://dv-telemetry-load.azurewebsites.net/api/tracks/${encodeURIComponent(selectedTrack)}`,
      )
        .then((res) => res.json())
        .then(setPlayers)
        .catch((err) => console.error("Error fetching players:", err));
    }
  }, [selectedTrack]);

  // Load player 1 telemetry
  useEffect(() => {
    if (selectedTrack && player1) {
      fetch(
        `https://dv-telemetry-load.azurewebsites.net/api/tracks/${encodeURIComponent(selectedTrack)}/${encodeURIComponent(player1)}`,
      )
        .then((res) => res.json())
        .then((data) => setPlayer1Data(parseData(data)))
        .catch((err) => console.error("Error fetching Player 1 data:", err));
    }
  }, [selectedTrack, player1]);

  // Load player 2 telemetry
  useEffect(() => {
    if (selectedTrack && player2) {
      fetch(
        `https://dv-telemetry-load.azurewebsites.net/api/tracks/${encodeURIComponent(selectedTrack)}/${encodeURIComponent(player2)}`,
      )
        .then((res) => res.json())
        .then((data) => setPlayer2Data(parseData(data)))
        .catch((err) => console.error("Error fetching Player 2 data:", err));
    }
  }, [selectedTrack, player2]);

  // Aliases
  const racer1Data = player1Data;
  const racer2Data = player2Data;

  // Track visualization layout
  const width = 400;
  const height = 500;
  const padding = 40;

  const focusedData = focus === "racer1" ? racer1Data : racer2Data;
  const allData = [...racer1Data, ...racer2Data];

  // Set up projection scale for GPS coordinates
  const lons = allData.map((p) => p.Lon);
  const lats = allData.map((p) => p.Lat);
  const lonRange = d3.extent(lons);
  const latRange = d3.extent(lats);
  const scale =
    lonRange[1] && latRange[0] && latRange[1]
      ? Math.min(
          (width - 2 * padding) / (lonRange[1] - lonRange[0]),
          (height - 2 * padding) / (latRange[1] - latRange[0]),
        )
      : 1;

  const lonCenter = (lonRange[0] + lonRange[1]) / 2 || 0;
  const latCenter = (latRange[0] + latRange[1]) / 2 || 0;

  // Converts lat/lon into screen (x, y)
  const project = (lon, lat) => {
    const x = (lon - lonCenter) * scale + width / 2;
    const y = height / 2 - (lat - latCenter) * scale;
    return [x, y];
  };

  // Finds the closest data point to a mouse x/y on the track map
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

  const truncateAfterLapReset = (data) => {
    for (let i = 1; i < data.length; i++) {
      if (data[i].LapDistPct < data[i - 1].LapDistPct - 0.1) {
        return data.slice(0, i);
      }
    }
    return data;
  };

  const cleanFocused = computeFrameTime(truncateAfterLapReset(focusedData));
  const hoveredTime =
    hoverIndex !== null && cleanFocused[hoverIndex]
      ? cleanFocused[hoverIndex].time
      : null;

  // Valid numeric metrics excluding GPS
  const metrics =
    racer1Data[0] &&
    Object.keys(racer1Data[0]).filter(
      (k) =>
        typeof racer1Data[0][k] === "number" &&
        ![
          "Lon",
          "Lat",
          "PositionType",
          "LapDistPct",
          "Clutch",
          "LatAccel",
        ].includes(k),
    );

  // Color mapping for metric values on map
  const metricExtent = d3.extent(allData, (d) => d[selectedMapMetric]);
  const colorScale = d3
    .scaleLinear()
    .domain([
      metricExtent[0],
      (metricExtent[0] + metricExtent[1]) / 2,
      metricExtent[1],
    ])
    .range(["yellow", "orange", "red"]);

  const formatRange = (min, max) => {
    const format = (v) => {
      if (Math.abs(max - min) < 5) return v.toFixed(2); // narrow range
      if (Math.abs(max - min) < 20) return v.toFixed(1); // moderate range
      return Math.round(v); // wide range
    };
    return `${format(min)}–${format(max)} ${getUnits(selectedMapMetric)}`;
  };
  const rangeLow = formatRange(
    metricExtent[0],
    (metricExtent[0] + metricExtent[1]) / 3,
  );
  const rangeMid = formatRange(
    (metricExtent[0] + metricExtent[1]) / 3,
    (2 * metricExtent[0] + metricExtent[1]) / 3,
  );
  const rangeHigh = formatRange(
    (2 * metricExtent[0] + metricExtent[1]) / 3,
    metricExtent[1],
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Sidebar for track + player selection + map */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Dropdowns */}
        <label>
          Select Track:
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
          >
            <option value="">--Select a Track--</option>
            {tracks.map((track) => (
              <option key={track} value={track}>
                {track}
              </option>
            ))}
          </select>
        </label>

        <label>
          Select Player 1:
          <select
            value={player1}
            onChange={(e) => setPlayer1(e.target.value)}
            disabled={!selectedTrack}
          >
            <option value="">--Select Player 1--</option>
            {players.map((player) => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </label>

        <label>
          Select Player 2:
          <select
            value={player2}
            onChange={(e) => setPlayer2(e.target.value)}
            disabled={!selectedTrack}
          >
            <option value="">--Select Player 2--</option>
            {players.map((player) => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </label>

        {/* Track map and metric controls */}
        {metrics && (
          <>
            <div style={{ padding: 10 }}>
              <label
                style={{ fontSize: 14, fontWeight: "bold", marginRight: 8 }}
              >
                Track Map Metric:
              </label>
              <select
                value={selectedMapMetric}
                onChange={(e) => setSelectedMapMetric(e.target.value)}
              >
                {metrics.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Track map container */}
            <div
              ref={containerRef}
              style={{
                width,
                height,
                background: "white",
                border: "1px solid #ccc",
                cursor: "pointer",
                position: "relative",
              }}
              onMouseMove={(e) => {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setCursorPos({ x: e.clientX, y: e.clientY });
                setHoverIndex(findClosestIndex(x, y));
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {
                //UNCOMMENT THIS TO USES GOOGLE MAP API IMAGE BEHIND SVG TRACK
                /* <GoogleTrackMap
              latRange={latRange}
              lonRange={lonRange}
              width={width}
              height={height}
              apiKey={GOOGLE_MAPS_API_KEY}
              /> */
              }
              <svg
                width={width}
                height={height}
                style={{
                  position: "relative", // <----- Change this to "absolute" to set it above google maps image
                  top: 0,
                  left: 0,
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              >
                {/* Start/Finish marker */}
                {racer1Data.length > 0 &&
                  (() => {
                    const [startX, startY] = project(
                      racer1Data[0].Lon,
                      racer1Data[0].Lat,
                    );
                    return (
                      <g>
                        <circle cx={startX} cy={startY} r={4} fill="black" />
                        <text
                          x={startX + 6}
                          y={startY - 6}
                          fontSize="10"
                          fill="gold"
                          fontWeight="bold"
                        >
                          🏁Start / Finish🏁
                        </text>
                      </g>
                    );
                  })()}

                {/* Connecting line (e.g. lap trace) */}
                {racer1Data.length > 1 &&
                  (() => {
                    const [x1, y1] = project(
                      racer1Data[0].Lon,
                      racer1Data[0].Lat,
                    );
                    const [x2, y2] = project(
                      racer1Data[racer1Data.length - 1].Lon,
                      racer1Data[racer1Data.length - 1].Lat,
                    );
                    return (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="green"
                        strokeWidth={2}
                      />
                    );
                  })()}

                {/* All telemetry points rendered as colored dots */}
                {allData.map((p, i) => {
                  const [x, y] = project(p.Lon, p.Lat);
                  const fill = colorScale(p[selectedMapMetric]);
                  return <circle key={i} cx={x} cy={y} r={1.5} fill={fill} />;
                })}

                {/* Hover markers for both racers */}
                {hoverIndex !== null &&
                  renderDualTelemetryCursor(
                    hoverIndex,
                    racer1Data,
                    racer2Data,
                    project,
                  )}
              </svg>
              {hoveredTime !== null && (
                <div
                  style={{
                    position: "fixed",
                    top: cursorPos.y + 10,
                    left: cursorPos.x + 10,
                    background: "rgba(0, 0, 0, 0.85)",
                    color: "#fff",
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    pointerEvents: "none",
                    zIndex: 9999,
                  }}
                >
                  {`Lap Time: ${formatTime(hoveredTime)}`}
                </div>
              )}

              <LapCompletionGraph
                racer1Data={racer1Data}
                racer2Data={racer2Data}
                hoverIndex={hoverIndex}
                height={60}
                width={width}
              />

              {/* Legend */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 10,
                  background: "#fff",
                  padding: "4px 8px",
                  border: "1px solid #ccc",
                  fontSize: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      background: "red",
                      marginRight: 4,
                    }}
                  ></span>
                  {rangeHigh}
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      background: "orange",
                      marginRight: 4,
                    }}
                  ></span>
                  {rangeMid}
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      background: "yellow",
                      marginRight: 4,
                    }}
                  ></span>
                  {rangeLow}
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  fontSize: 12,
                }}
              >
                <div style={{ color: "white" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      background: "blue",
                      marginRight: 4,
                    }}
                  ></span>
                  Player 1
                </div>
                <div style={{ color: "white" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      background: "green",
                      marginRight: 4,
                    }}
                  ></span>
                  Player 2
                </div>
              </div>

              {/* Toggle focus between racers */}
              <button
                onClick={() =>
                  setFocus(focus === "racer1" ? "racer2" : "racer1")
                }
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  padding: "6px 10px",
                  background: "#444",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                Switch Focus ({focus === "racer1" ? "Racer 1" : "Racer 2"})
              </button>
            </div>
          </>
        )}
      </div>

      {/* Telemetry graph column */}
      <div style={{ flex: 1, padding: "20px", overflowY: "scroll" }}>
        {metrics && (
          <>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{ fontSize: 14, fontWeight: "bold", marginRight: 8 }}
              >
                Graph Metrics:
              </label>
              <select
                multiple
                value={selectedGraphMetrics}
                onChange={(e) =>
                  setSelectedGraphMetrics(
                    Array.from(e.target.selectedOptions, (o) => o.value),
                  )
                }
                style={{ minWidth: 200, height: 100 }}
              >
                {metrics.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Render one graph per selected metric */}
            {selectedGraphMetrics.map((metric) => (
              <DualMetricGraph
                key={metric}
                metric={metric}
                hoverIndex={hoverIndex}
                racer1Data={racer1Data}
                racer2Data={racer2Data}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function DualMetricGraph({ metric, hoverIndex, racer1Data, racer2Data }) {
  const width = 800;
  const height = 200;
  const padding = 40;
  const yAxisRef = useRef(null);
  const xAxisRef = useRef(null);

  // Truncate when LapDistPct drops by more than 0.1
  const truncateAfterLapReset = (data) => {
    for (let i = 1; i < data.length; i++) {
      if (data[i].LapDistPct < data[i - 1].LapDistPct - 0.1) {
        return data.slice(0, i);
      }
    }
    return data;
  };

  const cleanRacer1 = truncateAfterLapReset(racer1Data);
  const cleanRacer2 = truncateAfterLapReset(racer2Data);

  const x = d3
    .scaleLinear()
    .domain(d3.extent([...cleanRacer1, ...cleanRacer2], (d) => d.LapDistPct))
    .range([padding, width - padding]);

  const y = d3
    .scaleLinear()
    .domain(d3.extent([...cleanRacer1, ...cleanRacer2], (d) => d[metric]))
    .range([height - padding, padding]);

  const toPolylinePoints = (data) =>
    data
      .filter((d) => d && isFinite(d.LapDistPct) && isFinite(d[metric]))
      .map((d) => `${x(d.LapDistPct)},${y(d[metric])}`)
      .join(" ");

  useEffect(() => {
    if (yAxisRef.current) {
      d3.select(yAxisRef.current).call(d3.axisLeft(y).ticks(4));
    }
    if (xAxisRef.current) {
      d3.select(xAxisRef.current).call(
        d3
          .axisBottom(x)
          .ticks(8)
          .tickFormat((d) => `${(d * 100).toFixed(0)}%`),
      );
    }
  }, [x, y]);

  return (
    <svg
      width={width}
      height={height}
      style={{
        marginBottom: "30px",
        background: "#f9f9f9",
        border: "1px solid #ccc",
      }}
    >
      <g ref={yAxisRef} transform={`translate(${padding},0)`} />
      <g ref={xAxisRef} transform={`translate(0,${height - padding})`} />

      <polyline
        points={toPolylinePoints(cleanRacer1)}
        fill="none"
        stroke="blue"
        strokeWidth={1.5}
      />
      <polyline
        points={toPolylinePoints(cleanRacer2)}
        fill="none"
        stroke="green"
        strokeWidth={1.5}
      />

      {hoverIndex !== null && (
        <>
          {cleanRacer1[hoverIndex] &&
            isFinite(cleanRacer1[hoverIndex].LapDistPct) && (
              <circle
                cx={x(cleanRacer1[hoverIndex].LapDistPct)}
                cy={y(cleanRacer1[hoverIndex][metric])}
                r={4}
                fill="blue"
              />
            )}
          {cleanRacer2[hoverIndex] &&
            isFinite(cleanRacer2[hoverIndex].LapDistPct) && (
              <circle
                cx={x(cleanRacer2[hoverIndex].LapDistPct)}
                cy={y(cleanRacer2[hoverIndex][metric])}
                r={4}
                fill="green"
              />
            )}
        </>
      )}

      <text x={padding} y={20} fontSize={14} fill="#333">
        {metric} ({getUnits(metric)})
      </text>
    </svg>
  );
}

// Gets display units for common metrics
function getUnits(metric) {
  switch (metric) {
    case "Speed":
      return "MPH";
    case "Throttle":
      return "%";
    case "RPM":
      return "Revs/min";
    case "Brake":
      return "%";
    case "SteeringWheelAngle":
      return "Degree";
    case "Gear":
      return "1-6";
    case "LatAccel":
      return "g's";
    default:
      return "";
  }
}
