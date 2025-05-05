// GoogleTrackMap.js
import React from "react";
console.log("✅ GoogleTrackMap loaded");


const getGoogleMapUrl = ({ latRange, lonRange, width, height, apiKey }) => {
  if (!latRange[0] || !latRange[1] || !lonRange[0] || !lonRange[1]) return "";

  const centerLat = (latRange[0] + latRange[1]) / 2;
  const centerLon = (lonRange[0] + lonRange[1]) / 2;

  const zoom = 15;
  const size = `${width}x${height}`;
  const scale = 4;
  const mapType = "satellite";

  return `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLon}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=${mapType}&key=${apiKey}`;
};

export default function GoogleTrackMap({ latRange, lonRange, width, height, apiKey }) {
  const mapUrl = getGoogleMapUrl({ latRange, lonRange, width, height, apiKey });

  if (!mapUrl) return null;

  return (
    <img
      src={mapUrl}
      alt="Google Satellite Map"
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        zIndex: 0,
      }}
    />
  );
}
