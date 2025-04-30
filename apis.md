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

**Description**: Downloads the specified telemetry, CSV file for the given track.

```http request
https://dv-telemetry-load.azurewebsites.net/api/tracks/Summit%20Point%20Main/Alex-18.107.csv
```

**Returns the file**
