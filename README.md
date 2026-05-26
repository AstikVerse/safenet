# SafeNet — Personal Safety Network Web App

SafeNet is a complete, production-ready, MERN-stack social impact platform designed to protect and connect individuals through community alerts, safe check-in journeys, fuzzed area hazards, and real-time emergency SOS streaming. 

Incorporating dynamic mobile layouts, custom browser audio synthesizers, zero-cost native share integrations, and strict privacy-by-design principles, SafeNet delivers a modern native-app experience directly on the mobile web.

---

## Core Feature Highlights

1. **Circular 2s Hold-for-SOS**: Avoids accidental SOS triggers using frame-by-frame mouse holding calculations, circular progress animations, and browser Vibration haptic feedback.
2. **Soft Geolocation Loader (Method B)**: Intercepts the Leaflet viewport mount using a gorgeous concentric pinging sonar animation screen. The map container mounts only after the device hardware GPS stream resolves, completely eliminating flashes or flickering of default (New Delhi) coordinates.
3. **High-Policy Password Security**: Enforces strong passwords at both client and server validation layers. Passwords must satisfy:
   * ✅ Minimum 8 characters
   * ✅ At least 1 uppercase letter (A-Z)
   * ✅ At least 1 lowercase letter (a-z)
   * ✅ At least 1 number (0-9)
   * ✅ At least 1 special character (e.g. `!`, `@`, `#`, `$`, `%`)
4. **Periodic SOS Email Updates**: Sweeps active emergencies every 30 seconds via node-cron. If an emergency remains active, it automatically dispatches updated location tracking emails to trusted contacts every **5 minutes** with the victim's latest coordinates and active tracking link.
5. **Call Police Emergency Dialers**: Provides direct dial shortcuts to universal emergency services (`tel:112`) featuring a custom hand-drawn **policeman silhouette SVG** (badge + cap outline). Accessible on both the idle dashboard and active emergency console.
6. **SendGrid HTTP REST API Gateway (Port 443)**: Bypasses cloud host SMTP blocks (e.g., Render free-tier blocks on outbound TCP ports `25`, `465`, and `587`) by integrating **SendGrid's REST API over HTTPS on port 443** for 100% reliable cloud delivery, with standard Gmail SMTP as a local development fallback.
7. **Synthesized Web Audio Ringtone**: Synthesizes a premium out-loud dual-chirp digital telephone ringtone directly in `FakeCallScreen.jsx` using browser `AudioContext` oscillators (`850Hz` + `950Hz` sine waves modulated with rapid frequency vibrato and tremolo volume amplitude warbles) repeating every 3 seconds while ringing, plus retro telephone busy beeps upon call hang-up.
8. **Expired Journey Watcher**: Scans check-in journeys every 30 seconds. Missed countdown arrivals prompt Nodemailer email dispatches with Leaflet map markers to emergency contacts.
9. **Fuzzed Coordinate Privacy**: Unsafe area reports fuzz locations by `±0.0005 degrees` (approx. 50 meters) on submissions. No reporter user accounts or IDs are recorded on the maps (privacy by design).
10. **WebSocket Coordinate Streaming**: SOS panics open dynamic rooms (`panic_${panicId}`). Observers with the public secure JWT tracking token trace live travel trails (polyline trail cap of 10 coordinates).
11. **SafeNet Premium Brand Logo**: Displays beautiful, custom product typography next to the shield icon inside `LoginRegister.jsx` using the brand's dual color palette (`Safe` in Rose, `Net` in Violet).

---

## Technical Architecture

- **Backend**: Node.js + Express.js + Mongoose (MongoDB) + Socket.io + Node-cron + Nodemailer + SendGrid REST API.
- **Frontend**: React + Vite + Tailwind CSS v3 + Leaflet maps + React-leaflet.
- **Layout**: Centered mobile-first frame (`max-width: 430px`) for a native smartphone app experience.

---

## Folder Layout

```
safenet/
  client/                  # React Vite Frontend client
    src/
      components/          # Bottom navigation, layouts
      context/             # AuthContext, SocketContext
      hooks/               # Geolocation & Check-in timers
      pages/               # Splash, SOS, Maps, Profiles, FakeCall, public trackings
      utils/               # Axios clients and formatters
      index.css            # Tailwind theme, CSS transitions, Leaflet customizers
  server/                  # Node Express Backend Server
    models/                # User, CheckIn, PanicEvent, UnsafeZone schemas
    routes/                # API router handlers
    middleware/            # Authorization token checking & rate limits
    jobs/                  # Missed check-in & active SOS periodic email watcher background crons
    utils/                 # HTML SMTP Mailer, SendGrid HTTP APIs, JWT helpers
    server.js              # Server entry point + WebSocket room event coordinators
```

---

## Installation & Running Locally

### Step 1: Clone and scaffold the dependencies

Make sure you have **NodeJS** and **MongoDB** installed and running on your system.

#### 1. Start MongoDB:
Run your local MongoDB server on standard port `27017` (e.g. `mongod` or your MongoDB Atlas connection).

#### 2. Install Server modules:
```bash
cd safenet/server
npm install
```

#### 3. Install Client modules:
```bash
cd ../client
npm install
```

---

### Step 2: Configure Environment Variables (`.env`)

#### Server Configuration (`safenet/server/.env`):
The environment setup has been automatically initialized with realistic defaults:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/safenet
JWT_SECRET=safenet_user_auth_secret_key_32chars_long_minimum
JWT_TRACKING_SECRET=safenet_public_panic_tracking_secret_key_32chars_long_minimum
SENDGRID_API_KEY=your_sendgrid_api_key_here
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your_16char_app_password
CLIENT_URL=http://localhost:5173
```
*Note: If `SENDGRID_API_KEY` is omitted, SafeNet automatically switches to standard SMTP using `GMAIL_USER`. If both are omitted or keep their default values, SafeNet will automatically fallback to creating a mock **Ethereal Mail** developer transport, printing email alerts straight to the server console log!*

#### Client Configuration (`safenet/client/.env`):
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

### Step 3: Run the servers in Developer Mode

#### 1. Run the Express Backend Server:
```bash
cd safenet/server
npm run dev
```
*(This triggers `nodemon server.js` to enable hot reload).*

#### 2. Run the React Client:
```bash
cd safenet/client
npm run dev
```
*(This boots the Vite server at `http://localhost:5173`).*

---

## Production Builds

To test production compiling or prepare assets for deployment, compile the optimized static assets:
```bash
cd safenet/client
npm run build
```
This outputs a compiled static SPA ready for static web hosts inside `/safenet/client/dist/` in under 13 seconds.
