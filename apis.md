# Backend APIs to get telemetry data
This project provides a set of Azure Function HTTPS APIs to interact with CSV files stored in an Blob Storage container.

---

## 📁 API Structure

---

## 🔗 Available APIs

### 1. `GET /api/tracks`

**Description**: Lists all available tracks.

```http request 
https://dv-telemetry-load.azurewebsites.net/api/tracks
```
Response:
```json
[
"Summit Point Main",
"Virginia International Raceway",
"Watkins Glen"
]
```

### 2. `GET /api/tracks/{track_name}`

**Description**: Lists all telemetry files for a specific track.

```http request 
https://dv-telemetry-load.azurewebsites.net/api/tracks/Summit%20Point%20Main
```
Response:
```json
[
  "Alex-18.107.csv",
  "Alex_Pritchard-16.046.csv",
  "Bartosz-Laszuk-17.143.csv",
  "Brian-21.064.csv",
  "Colin-19.053.csv",
  "David-Vanslambrouck-15.136.csv",
  "Joe-17.249.csv",
  "Josh-Coldewe-14.455.csv",
  "Ken-Camp-17.146.csv"
]
```

### 3. GET /api/tracks/{track_name}/{player_name}

**Description**: Send the data as json for the specified telemetry in array format with same structure for all laps.

```http request
https://dv-telemetry-load.azurewebsites.net/api/tracks/Summit%20Point%20Main/Alex-18.107.csv
```
```json
[
  [
    55.81469,
    0.0004055172,
    39.2352157141511,
    -77.969058733504,
    0,
    1,
    6741.295,
    -0.008492051,
    5,
    1,
    "false",
    "false",
    0.11552991,
    1.8239666,
    11.1423645,
    3.0781221,
    3
  ]
]
```
**Returns the file**

### 4. GET /api/structure

**Description**: Send the index of the array for the above API

```http request
https://dv-telemetry-load.azurewebsites.net/api/structure
```

```json
[
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
  "LongAccel",
  "VertAccel",
  "Yaw",
  "PositionType"
]
```
