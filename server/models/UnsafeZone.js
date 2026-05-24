import mongoose from 'mongoose';

const unsafeZoneSchema = new mongoose.Schema({
  location: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
  },
  category: {
    type: String,
    enum: ['harassment', 'theft', 'poor-lighting', 'stalking', 'other'],
    required: true
  },
  timeOfDay: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true
  },
  reportedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// Set up simple indexes on lat and lng for fast bounding box searches
unsafeZoneSchema.index({ 'location.lat': 1, 'location.lng': 1 });

const UnsafeZone = mongoose.model('UnsafeZone', unsafeZoneSchema);
export default UnsafeZone;
