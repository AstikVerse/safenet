import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Import Route Handlers
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import panicRoutes from './routes/panic.js';
import checkinRoutes from './routes/checkin.js';
import zonesRoutes from './routes/zones.js';

// Import Services
import { startCheckinWatcher } from './jobs/checkinWatcher.js';
import { verifyTrackingToken } from './utils/tokenHelper.js';
import PanicEvent from './models/PanicEvent.js';

// Load Config
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration matching client dev server default
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientUrl,
  credentials: true
}));

app.use(express.json());

// Mount MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/safenet';
mongoose.connect(mongoUri)
  .then(() => console.log('📁 Connected to MongoDB Successfully.'))
  .catch((err) => console.error('❌ MongoDB Connection Failure:', err));

// Configure Socket.io Server
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true
  }
});

// Bind Socket.io globally to request context for HTTP route access
app.set('io', io);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/panic', panicRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/zones', zonesRoutes);

// Base Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Socket.io Real-time Event Handlers
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Contact joins an emergency tracking session room
  socket.on('join-panic-room', async ({ panicId, token }) => {
    if (!panicId || !token) {
      console.log(`⚠️ Socket ${socket.id} connection rejected: missing params`);
      return;
    }

    // Verify tracking token validity
    const decoded = verifyTrackingToken(token);
    if (!decoded || decoded.panicId !== panicId) {
      console.log(`⚠️ Socket ${socket.id} unauthorized token verification failure.`);
      return;
    }

    const roomName = `panic_${panicId}`;
    socket.join(roomName);
    console.log(`👤 Contact socket ${socket.id} joined tracking room: ${roomName}`);
  });

  // Active user streams their live location coordinates
  socket.on('location-update', async ({ panicId, lat, lng, timestamp }) => {
    if (!panicId || lat === undefined || lng === undefined) return;

    const roomName = `panic_${panicId}`;
    const locationTime = timestamp || new Date();

    console.log(`📍 Location update received for room ${roomName}: lat: ${lat}, lng: ${lng}`);

    // Broadcast coordinate shift to all observers in room (excluding user who sent it)
    socket.to(roomName).emit('location-changed', { lat, lng, timestamp: locationTime });
  });

  // Resolver event fired to close down tracking room observers
  socket.on('resolve-panic', async ({ panicId }) => {
    if (!panicId) return;

    const roomName = `panic_${panicId}`;
    io.to(roomName).emit('panic-resolved', { resolvedAt: new Date() });
    
    console.log(`✅ Room ${roomName} tracking session terminated.`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Boot Background Cron Worker checkin watcher
startCheckinWatcher();

// Start Server Listen
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`🚀 SafeNet server active on http://localhost:${port}`);
});
