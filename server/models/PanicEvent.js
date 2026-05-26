import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const panicEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  triggeredAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  locationHistory: {
    type: [locationSchema],
    default: []
  },
  trackingToken: {
    type: String,
    required: true
  },
  alertsSent: [
    {
      contactName: { type: String, required: true },
      email: { type: String, required: true },
      sentAt: { type: Date, default: Date.now }
    }
  ],
  status: {
    type: String,
    enum: ['active', 'resolved'],
    default: 'active',
    required: true
  },
  secondaryAlertsSent: {
    type: Boolean,
    default: false,
    required: true
  },
  emailsEnabled: {
    type: Boolean,
    default: true,
    required: true
  },
  lastEmailSentAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
});

const PanicEvent = mongoose.model('PanicEvent', panicEventSchema);
export default PanicEvent;
