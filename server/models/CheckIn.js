import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'safe', 'triggered', 'cancelled'],
    default: 'active',
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  lastKnownLocation: {
    lat: { type: Number },
    lng: { type: Number },
    timestamp: { type: Date, default: Date.now }
  },
  alertsSent: [
    {
      contactName: { type: String, required: true },
      email: { type: String, required: true },
      sentAt: { type: Date, default: Date.now }
    }
  ]
});

const CheckIn = mongoose.model('CheckIn', checkInSchema);
export default CheckIn;
