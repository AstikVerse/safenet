import express from 'express';
import CheckIn from '../models/CheckIn.js';
import verifyToken from '../middleware/verifyToken.js';

const router = express.Router();

// Apply auth verification to all checkin routes
router.use(verifyToken);

/**
 * @route   POST /api/checkin/start
 * @desc    Start a safe check-in journey
 * @access  Private
 */
router.post('/start', async (req, res) => {
  const { durationMinutes, lat, lng } = req.body;

  if (!durationMinutes || isNaN(durationMinutes) || durationMinutes <= 0) {
    return res.status(400).json({ message: 'A valid journey duration is required.' });
  }

  try {
    // Check if there is an active check-in for the user already
    const existingActive = await CheckIn.findOne({
      userId: req.user.id,
      status: 'active'
    });

    if (existingActive) {
      return res.status(400).json({
        message: 'An active check-in journey is already running.',
        checkIn: existingActive
      });
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    const checkIn = new CheckIn({
      userId: req.user.id,
      durationMinutes,
      startedAt,
      expiresAt,
      lastKnownLocation: {
        lat: lat || 0,
        lng: lng || 0,
        timestamp: startedAt
      },
      status: 'active'
    });

    await checkIn.save();

    return res.status(201).json({
      message: 'Check-in journey started successfully.',
      checkIn
    });
  } catch (error) {
    console.error('Check-in start error:', error);
    return res.status(500).json({ message: 'Server check-in error.' });
  }
});

/**
 * @route   GET /api/checkin/active
 * @desc    Retrieve the current active check-in for the logged-in user
 * @access  Private
 */
router.get('/active', async (req, res) => {
  try {
    const activeCheckin = await CheckIn.findOne({
      userId: req.user.id,
      status: 'active'
    });

    if (!activeCheckin) {
      return res.status(200).json({ active: false });
    }

    return res.status(200).json({ active: true, checkIn: activeCheckin });
  } catch (error) {
    console.error('Fetch active check-in error:', error);
    return res.status(500).json({ message: 'Server check-in fetch error.' });
  }
});

/**
 * @route   PATCH /api/checkin/:id/safe
 * @desc    Confirm safe arrival and cancel/end check-in alert countdown
 * @access  Private
 */
router.patch('/:id/safe', async (req, res) => {
  const { id } = req.params;

  try {
    const checkIn = await CheckIn.findOne({ _id: id, userId: req.user.id });
    if (!checkIn) {
      return res.status(404).json({ message: 'Check-in journey not found.' });
    }

    if (checkIn.status !== 'active') {
      return res.status(400).json({ message: `Check-in is already marked as ${checkIn.status}.` });
    }

    // Cancel alert, mark safe
    checkIn.status = 'safe';
    await checkIn.save();

    return res.status(200).json({
      message: "Glad you are safe! Check-in journey resolved.",
      checkIn
    });
  } catch (error) {
    console.error('Mark check-in safe error:', error);
    return res.status(500).json({ message: 'Server check-in update error.' });
  }
});

/**
 * @route   PATCH /api/checkin/:id/location
 * @desc    Periodically update the user's last known GPS coordinates
 * @access  Private
 */
router.patch('/:id/location', async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'Coordinates (lat, lng) are required.' });
  }

  try {
    const checkIn = await CheckIn.findOne({ _id: id, userId: req.user.id, status: 'active' });
    if (!checkIn) {
      return res.status(404).json({ message: 'Active check-in journey not found.' });
    }

    checkIn.lastKnownLocation = {
      lat,
      lng,
      timestamp: new Date()
    };

    await checkIn.save();

    return res.status(200).json({
      message: 'Last known location updated successfully.',
      lastKnownLocation: checkIn.lastKnownLocation
    });
  } catch (error) {
    console.error('Check-in location update error:', error);
    return res.status(500).json({ message: 'Server coordinates error.' });
  }
});

export default router;
