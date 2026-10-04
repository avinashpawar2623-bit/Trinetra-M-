# TRINETRA Rover Dashboard

Real-time monitoring dashboard for the TRINETRA AI disaster-response rover.

- **frontend/**: React (Vite) + Tailwind. Live sensor data through Firebase `onValue` listeners, an MJPEG camera feed with a detection overlay, and a Firestore event log, all behind Firebase Auth.
- **backend/**: Minimal Express server with a health check, a sensor validation endpoint, an MJPEG camera proxy, and production serving of the built frontend.
- **companion/**: Reference YOLOv8 detector that reads the camera stream and writes `/rover/detections` to RTDB.

```
ESP32 ──sensors/status──▶ RTDB ◀──detections── companion/detect.py ◀── ESP32-CAM MJPEG
                           │                                              │
                           ▼                                              ▼
                      Dashboard (React) ◀──────── /api/camera/stream (Express proxy)
                           │
                           ▼
                Firestore "events" (gas / flame / detection log)
```

---

## 1. Firebase project setup

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication**: go to Build > Authentication > Get started > Sign-in method and enable **Email/Password**.
3. **Realtime Database**: go to Build > Realtime Database > Create database. Pick a region and start in **locked mode**.
4. **Firestore**: go to Build > Firestore Database > Create database and start in **production mode**.
5. **Web app credentials**: go to Project settings > General > Your apps > Add app > Web. Copy the config values.
6. **Deploy security rules** from the repo root using the Firebase CLI:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add            # select your project
   firebase deploy --only database,firestore:rules
   ```
   You can also paste `database.rules.json` and `firestore.rules` into the console's Rules tabs.

   The RTDB rules validate the types of each `/rover` field and reject unknown keys. They also declare `.indexOn: timestamp` on `/rover/history`, which is an optional location for time-series readings if you later want to query sensor data by time.

### Create the admin user

Go to Authentication > Users > **Add user**, then enter the operator email and password. There is no sign-up page, so this is the only account that can log in. Leave sign-ups disabled.

### ESP32 credentials

The rules only allow **authenticated** writes. Give the ESP32 its own email/password user, created the same way, and sign in with it from the Firebase ESP32 client library. Do not use the legacy database secret.

---

## 2. Configure credentials

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example  backend/.env
```

Fill in the `VITE_FIREBASE_*` values in `frontend/.env`. They are public identifiers; Firebase security rules enforce access control. Never commit `.env` files or service-account JSON. Both are already listed in `.gitignore`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_*` | frontend | Firebase web config |
| `VITE_CAMERA_STREAM_URL` | frontend | Fallback stream URL |
| `VITE_FORCE_CAMERA_PROXY` | frontend | Always use `/api/camera/stream` |
| `VITE_FRONTEND_EVENT_LOGGING` | frontend | Set `false` when another writer logs events |
| `PORT` | backend | Default `3001` |
| `CAMERA_STREAM_URL` | backend | Upstream MJPEG URL for the proxy |
| `NODE_ENV` | backend | `production` serves `frontend/dist` |

---

## 3. Run it

Requires Node 20.6+. The backend uses Node's built-in `--env-file` and `--watch` flags, so it doesn't need dotenv or nodemon.

```bash
# Terminal 1: backend (camera proxy, API)
cd backend && npm install && npm start      # or: npm run dev (auto-restart)

# Terminal 2: frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

In development, Vite proxies `/api/*` to `http://localhost:3001`.

### Production

```bash
cd frontend && npm run build
cd ../backend && NODE_ENV=production npm start   # serves dashboard + API on PORT
```

Any non-`/api` route falls back to `index.html`.

---

## 4. Camera stream URL

The dashboard resolves the stream URL in this order:

1. **`/rover/camera/streamUrl` in RTDB.** Change it live from the Firebase console without redeploying:
   ```json
   { "rover": { "camera": { "streamUrl": "http://192.168.1.50:81/stream" } } }
   ```
2. `VITE_CAMERA_STREAM_URL` in `frontend/.env`.
3. The backend proxy `/api/camera/stream`, which pulls from `CAMERA_STREAM_URL` in `backend/.env`.

If you set `VITE_FORCE_CAMERA_PROXY=true`, the dashboard always uses option 3. Use this when the dashboard is served over HTTPS or the camera is only reachable from the backend's network.

> **ESP32-CAM single-client limit:** the stock `CameraWebServer` firmware serves **one** stream client at a time. The companion detector and every open dashboard tab compete for that slot. If the companion holds the stream, the dashboard shows "Camera offline". To fix this, run the proxy on the same machine and point the companion at the proxy, or use firmware or a relay (for example go2rtc or mjpg-streamer) that supports multiple clients.

---

## 5. Companion detector

Object detection runs **outside the browser**. The dashboard only draws what the companion writes.

```bash
cd companion
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export STREAM_URL=http://192.168.1.50:81/stream
export FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com
export FIREBASE_CREDENTIALS=/secure/path/serviceAccount.json   # Project settings > Service accounts > Generate key
python detect.py
```

The companion writes this payload at about 5 FPS (set `TARGET_FPS` to change it). Payloads are written even when nothing is detected, so the dashboard can tell "no objects" apart from "detector stopped".

```json
{ "timestamp": 1790000000000, "frameWidth": 640, "frameHeight": 480,
  "objects": [{ "label": "person", "confidence": 0.91, "bbox": [x, y, w, h] }] }
```

`bbox` is in source-frame pixels with a top-left origin. The service account uses the Admin SDK, which bypasses security rules, so keep the key file secret.

---

## 6. Detection logging and its tradeoffs

When a priority class (`PRIORITY_CLASSES`, default `["person"]`) is detected at or above `DETECTION_LOG_MIN_CONFIDENCE`, the frontend writes an event to the Firestore `events` collection. Gas and flame alarms are logged on their rising edge. Each class or sensor is limited to one event per `DETECTION_LOG_DEBOUNCE_MS` (10 s).

**Frontend logging is a fallback.** Its limitations:

- It only logs while a dashboard tab is open and signed in. With no viewer, nothing is logged.
- Every open tab logs independently, so N tabs produce up to N duplicate events.
- The debounce state lives in memory, so reloading the page resets it.
- Events depend on the browser's network connection and clock (`clientTs`), although the document `timestamp` uses `serverTimestamp()`.

**Better options:** log from the companion device, which already sees every detection and runs continuously, or from a backend or Cloud Function that triggers on RTDB writes. Once one of those is in place, set `VITE_FRONTEND_EVENT_LOGGING=false`.

---

## 7. 3D rover view

The main panel has a **Camera | 3D rover** toggle, and the dashboard remembers your choice. The 3D view is a live, realistic scene of the rover at a night-time disaster site, built procedurally with `three.js` (no model or texture files). It is loaded on demand, so three.js (about 166 kB gzipped) downloads only the first time you open the tab.

**The scene**
- **Rover:** rounded chassis, rocker-bogie suspension with six treaded wheels, solar panel, antenna, GPS puck, pan-tilt camera mast, headlights, and an amber alarm beacon. Each sensor (both HC-SR04s, MQ-2, MQ-6, flame, DHT) is a separate housing you can click.
- **Site:** noise-generated rubble terrain with a cleared pad around the rover, scattered debris and rebar, collapsed slabs, hazard barriers, fog, moonlight, and drifting dust.

| Visual | Meaning |
| --- | --- |
| Status LED, headlights, paint | Green LED and lit headlights = online. Red LED, dim headlights, and dull paint = offline (auto-rotate stops) |
| Amber beacon | Spins while any alarm (flame or gas) is active |
| Fire particles + flickering light | Flame sensor triggered |
| Smoke + colored ring | MQ-2 and/or MQ-6 gas detected. Both together give denser smoke |
| Beam cone with travelling rings + hazard wall | Ultrasonic distance. The wall stands at the measured range, and the color follows `DISTANCE_THRESHOLDS`. A faint wireframe cone with no wall means "no echo" |
| Heat haze + emissive tint | Temperature at its warning or danger level |
| Floating HUD panel | Online status, temperature, humidity, battery, and last-seen time |
| Pillars with labels and fading trails | Fresh detections. Direction comes from where the bbox sits horizontally in the frame, across `ROVER3D.cameraFovDeg`. Range is the front distance reading, or `ROVER3D.defaultMarkerRange` if there isn't one. Pillars sit on the terrain, and trails show recent movement |

**Controls**
- Drag to orbit and scroll to zoom. The toolbar has camera presets (**Orbit**, **Front**, **Top**, **Chase**) with smooth transitions, **Auto-rotate** (Orbit only), **Quality**, **Reset view**, and **Screenshot** (downloads a PNG).
- Click a sensor housing to highlight it and open a card with its live reading, threshold, and description. Click a detection pillar to fly the camera to it and see its confidence, bearing, and age. Press Escape or click empty space to close.
- The legend in the bottom-left corner shows live values. It starts open on wide screens and collapsed on small ones.

**Performance**
- **Quality:** **High** adds shadows, bloom on bright lights, heat-haze shaders, more particles, and denser terrain and rubble. **Low** skips these for laptops and phones. **Auto** picks Low on touch-only or low-memory devices and with `prefers-reduced-motion`, and High otherwise. The choice is saved in the browser.
- Rendering pauses while the view is scrolled off-screen or the browser tab is hidden.
- Only the active tab is mounted. Switching to 3D closes the MJPEG connection, which frees the ESP32-CAM's single stream slot for the companion detector. Switching back to Camera disposes every 3D resource and releases the WebGL context.

**Other notes**
- The 3D view requires WebGL. If WebGL is unavailable, for example because hardware acceleration is disabled, a fallback message is shown.
- `prefers-reduced-motion` turns off sonar pulses, dust drift, label bobbing, camera transitions, auto-rotation, and the card tilt effect.
- To tune the 3D view (bloom, particle counts, trail length, transition speed, cleared radius), edit `ROVER3D` in `constants.js`.

The rest of the UI also uses a 3D style built only from CSS: glass panels with depth shadows, a pointer-driven tilt on cards (desktop only), a perspective grid backdrop, raised status badges, and recessed gauges.

---

## 8. Configuration

All thresholds and timeouts live in [`frontend/src/config/constants.js`](frontend/src/config/constants.js):

| Constant | Default | Meaning |
| --- | --- | --- |
| `TEMP_THRESHOLDS` | warning 40, danger 55 °C | Temperature card color |
| `HUMIDITY_THRESHOLDS` | 10/20/80/90 % | Humidity card color |
| `DISTANCE_MAX_CM` | 400 | Full scale of the distance bar |
| `STALE_STATUS_MS` | 10000 | "Connection lost" banner threshold |
| `STALE_DETECTION_MS` | 2000 | Hide old bounding boxes |
| `PRIORITY_CLASSES` | `["person"]` | Classes that create events |
| `DETECTION_COLORS` | person red, others blue | Overlay colors |
| `EVENT_LOG_LIMIT` | 25 | Events shown in the log |
| `ROVER3D` | FOV 60°, cone length 4, auto-rotate on | 3D view tuning |

---

## 9. Troubleshooting

**Mixed content (stream blocked on an HTTPS page).** Browsers block `http://` images on `https://` pages. Set `VITE_FORCE_CAMERA_PROXY=true` and set `CAMERA_STREAM_URL` on the backend, so the browser loads the stream from the same HTTPS origin.

**CORS.** An `<img>` tag does not need CORS to *display* a stream, but the stream must be reachable from the viewer's network. If you see errors calling `/api/*` while running the Vite dev server, confirm the backend is running on port 3001. The Vite proxy handles the cross-origin part in development.

**Stream not loading or "Camera offline".**
- Open the stream URL directly in a browser tab. If that fails too, the problem is the network or the camera, not the dashboard.
- Check the ESP32-CAM single-client limit described in section 4.
- `curl -I http://localhost:3001/api/camera/stream`: a 503 response means `CAMERA_STREAM_URL` is unset, and a 502 means the camera is unreachable from the backend.
- If you're behind nginx, disable buffering for `/api/camera/stream` (`proxy_buffering off;`).
- Click **Retry**. It forces a fresh request by adding a cache-busting query parameter.

**Bounding boxes misaligned.**
- `frameWidth` and `frameHeight` in the payload must match the resolution the model actually ran on, which is the resolution of the frame it read.
- `bbox` must be `[x, y, width, height]` measured from the top-left corner. YOLO's `xywh` is center-based. The companion script converts from `xyxy`, so use that conversion if you write your own detector.
- If the camera resolution doesn't match `CAMERA_ASPECT_RATIO` (4:3 vs 16:9), the overlay still compensates for letterboxing. Matching the two avoids black bars.
- If the boxes trail behind moving objects, the detector is too slow. Use a smaller model (`yolov8n.pt`) or a faster companion device. The overlay hides detections older than 2 s.

**Connection-lost banner flickers or shows when the rover is clearly online.** The `lastSeen` timestamp comes from the ESP32's clock and is compared against the browser's clock. Sync both with NTP, or have the ESP32 write RTDB's server timestamp (`{".sv": "timestamp"}`).

**"Missing Firebase config" screen.** `frontend/.env` is missing or incomplete. Restart `npm run dev` after editing it.

**`permission-denied` errors.** You aren't signed in, or the rules haven't been deployed. For RTDB writes, the payload is also checked against the validation rules: for example, `distanceFront` must be a number or `"no echo"`, and unknown fields are rejected.
