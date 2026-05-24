import express from 'express';
import UnsafeZone from '../models/UnsafeZone.js';
import { zoneReportLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * @route   POST /api/zones/report
 * @desc    Submit a new anonymous unsafe zone report (rate-limited, privacy-focused fuzzed coordinates)
 * @access  Public
 */
router.post('/report', zoneReportLimiter, async (req, res) => {
  const { lat, lng, category, timeOfDay } = req.body;

  if (lat === undefined || lng === undefined || !category || !timeOfDay) {
    return res.status(400).json({ message: 'GPS coordinates, category, and time of day are required.' });
  }

  // Double check that we're validating category and time of day enums
  const validCategories = ['harassment', 'theft', 'poor-lighting', 'stalking', 'other'];
  const validTimes = ['morning', 'afternoon', 'evening', 'night'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({ message: 'Invalid category type.' });
  }

  if (!validTimes.includes(timeOfDay)) {
    return res.status(400).json({ message: 'Invalid time of day selected.' });
  }

  try {
    // 1. Fuzz coordinates by ±0.0005 degrees before saving for reporter privacy
    // Math.random() * 0.001 yields [0, 0.001], subtracting 0.0005 yields [-0.0005, 0.0005]
    const fuzzLat = (Math.random() * 0.001) - 0.0005;
    const fuzzLng = (Math.random() * 0.001) - 0.0005;

    const fuzzedLat = parseFloat((parseFloat(lat) + fuzzLat).toFixed(6));
    const fuzzedLng = parseFloat((parseFloat(lng) + fuzzLng).toFixed(6));

    // 2. Create the UnsafeZone report
    const zoneReport = new UnsafeZone({
      location: {
        lat: fuzzedLat,
        lng: fuzzedLng
      },
      category,
      timeOfDay,
      reportedAt: new Date()
    });

    await zoneReport.save();

    return res.status(201).json({
      message: 'Area report submitted successfully. Coordinates fuzzed for your privacy.',
      reportId: zoneReport._id
    });

  } catch (error) {
    console.error('Zone reporting failure:', error);
    return res.status(500).json({ message: 'Server area report failure.' });
  }
});

/**
 * @route   GET /api/zones
 * @desc    Get all fuzzed unsafe zones within a specific bounding box (swLat, swLng, neLat, neLng)
 * @access  Public
 */
router.get('/', async (req, res) => {
  const { swLat, swLng, neLat, neLng } = req.query;

  if (swLat === undefined || swLng === undefined || neLat === undefined || neLng === undefined) {
    return res.status(400).json({ message: 'Bounding box query params (swLat, swLng, neLat, neLng) are required.' });
  }

  try {
    // Perform bounding box range query
    const zones = await UnsafeZone.find({
      'location.lat': { $gte: parseFloat(swLat), $lte: parseFloat(neLat) },
      'location.lng': { $gte: parseFloat(swLng), $lte: parseFloat(neLng) }
    }).sort({ reportedAt: -1 });

    return res.status(200).json(zones);
  } catch (error) {
    console.error('Zones fetch error:', error);
    return res.status(500).json({ message: 'Server database error fetching zone reports.' });
  }
});

export default router;
