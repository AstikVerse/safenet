import express from 'express';
import PanicEvent from '../models/PanicEvent.js';
import User from '../models/User.js';
import verifyToken from '../middleware/verifyToken.js';
import { generateTrackingToken, verifyTrackingToken } from '../utils/tokenHelper.js';
import { sendPanicAlert } from '../utils/mailer.js';

const router = express.Router();

/**
 * @route   POST /api/panic/trigger
 * @desc    Trigger an emergency panic SOS event (asynchronous email, <300ms response)
 * @access  Private
 */
router.post('/trigger', verifyToken, async (req, res) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'GPS coordinates (lat, lng) are required to trigger SOS.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // A. Daily Email Rate Limiter Quota calculation (Model B)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in India
    if (user.lastSosEmailDate !== todayStr) {
      user.dailySosEmailsCount = 0;
      user.lastSosEmailDate = todayStr;
    }

    const MAX_SOS_EMAILS_PER_DAY = parseInt(process.env.MAX_SOS_EMAILS_PER_DAY) || 3;
    let emailQuotaExceeded = false;

    const contacts = user.trustedContacts || [];
    const primaryContacts = contacts.filter(c => c.priority === 'primary' || !c.priority);
    const targetImmediateContacts = primaryContacts.length > 0 ? primaryContacts : contacts;

    if (user.dailySosEmailsCount >= MAX_SOS_EMAILS_PER_DAY) {
      emailQuotaExceeded = true;
      console.log(`⚠️ Quota Exhausted: User ${user.name} initiated SOS but daily emergency emails are blocked (${user.dailySosEmailsCount}/${MAX_SOS_EMAILS_PER_DAY}).`);
    } else {
      // Increment the daily emails count by the actual number of primary emails to be dispatched (Model B)
      user.dailySosEmailsCount = (user.dailySosEmailsCount || 0) + targetImmediateContacts.length;
      await user.save();
    }

    // Auto-resolve any previous active SOS events for this user to prevent orphaned alarms
    await PanicEvent.updateMany(
      { userId: req.user.id, status: 'active' },
      { status: 'resolved', resolvedAt: new Date() }
    );

    // 1. Create PanicEvent ID beforehand to construct the tracking link
    const panicEventId = new (PanicEvent.db.base.Types.ObjectId)();
    
    // 2. Generate signed JWT tracking token (valid for 2 hours)
    const trackingToken = generateTrackingToken(panicEventId.toString());

    // 3. Create the emergency tracking link
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const trackingLink = `${clientUrl}/track/${panicEventId}?token=${trackingToken}`;

    // 4. Instantiate the PanicEvent
    const panicEvent = new PanicEvent({
      _id: panicEventId,
      userId: req.user.id,
      location: { lat, lng },
      locationHistory: [{ lat, lng, timestamp: new Date() }],
      trackingToken,
      status: 'active',
      emailsEnabled: !emailQuotaExceeded,
      secondaryAlertsSent: emailQuotaExceeded // If emails are disabled, mark Phase 2 as true so it doesn't trigger escalation dispatches either
    });

    await panicEvent.save();

    // 5. Send emails to PRIMARY trusted contacts immediately (Phase 1)
    if (!emailQuotaExceeded) {
      const contacts = user.trustedContacts || [];
      const primaryContacts = contacts.filter(c => c.priority === 'primary' || !c.priority);
      // If no contacts are explicitly primary, notify all contacts as a safe fallback
      const targetImmediateContacts = primaryContacts.length > 0 ? primaryContacts : contacts;

      if (targetImmediateContacts.length > 0) {
        sendPanicAlert(user, { lat, lng }, targetImmediateContacts, trackingLink)
          .then(async (alerts) => {
            // Update the alert logs on the PanicEvent document
            await PanicEvent.findByIdAndUpdate(panicEventId, { alertsSent: alerts });
            console.log(`Async Alert: Immediate (Phase 1) SOS emails logged for Panic ${panicEventId}`);
          })
          .catch((err) => {
            console.error(`Async Alert: Failed to send Phase 1 immediate SOS emails for ${panicEventId}:`, err);
          });
      }
    }

    // 6. Instantly respond to client
    return res.status(201).json({
      message: emailQuotaExceeded 
        ? 'SOS Panic triggered. Outbound email cap reached.'
        : 'SOS Panic triggered successfully.',
      panicEventId: panicEvent._id,
      trackingToken,
      emailQuotaExceeded
    });

  } catch (error) {
    console.error('SOS Panic trigger failure:', error);
    return res.status(500).json({ message: 'Server SOS system failure.' });
  }
});

/**
 * @route   PATCH /api/panic/:id/location
 * @desc    Update live location during active SOS panic (broadcasts to WebSocket tracking room)
 * @access  Private
 */
router.patch('/:id/location', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'Coordinates (lat, lng) are required.' });
  }

  try {
    const panicEvent = await PanicEvent.findOne({ _id: id, userId: req.user.id, status: 'active' });
    if (!panicEvent) {
      return res.status(404).json({ message: 'Active panic event not found or unauthorized.' });
    }

    const timestamp = new Date();
    
    // Update live location and location history trail
    panicEvent.location = { lat, lng };
    panicEvent.locationHistory.push({ lat, lng, timestamp });
    await panicEvent.save();

    // Broadcast location update to the tracking room via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`panic_${id}`).emit('location-changed', { lat, lng, timestamp });
      console.log(`Socket Broadcast: Location updated in room panic_${id}`);
    }

    return res.status(200).json({ message: 'Location updated successfully.', location: panicEvent.location });
  } catch (error) {
    console.error('SOS Location update error:', error);
    return res.status(500).json({ message: 'Server live location error.' });
  }
});

/**
 * @route   GET /api/panic/:id/track
 * @desc    Public tracking endpoint for emergency contacts (requires tracking JWT token)
 * @access  Public (Token Secured)
 */
router.get('/:id/track', async (req, res) => {
  const { id } = req.params;
  const token = req.query.token || req.headers['x-tracking-token'];

  if (!token) {
    return res.status(401).json({ message: 'Tracking access denied. Token missing.' });
  }

  // Verify the tracking JWT token
  const decoded = verifyTrackingToken(token);
  if (!decoded || decoded.panicId !== id) {
    return res.status(403).json({ message: 'Invalid or expired tracking token.' });
  }

  try {
    const panicEvent = await PanicEvent.findById(id).populate('userId', 'name phone emergencyMessage');
    if (!panicEvent) {
      return res.status(404).json({ message: 'Panic event not found.' });
    }

    return res.status(200).json({
      panicId: panicEvent._id,
      userName: panicEvent.userId.name,
      userPhone: panicEvent.userId.phone,
      emergencyMessage: panicEvent.userId.emergencyMessage,
      triggeredAt: panicEvent.triggeredAt,
      location: panicEvent.location,
      locationHistory: panicEvent.locationHistory.slice(-10), // Send last 10 points for path polyline
      status: panicEvent.status,
      resolvedAt: panicEvent.resolvedAt
    });

  } catch (error) {
    console.error('SOS Public Tracking Error:', error);
    return res.status(500).json({ message: 'Server tracking error.' });
  }
});

/**
 * @route   POST /api/panic/:id/resolve
 * @desc    Resolve the panic event, closing the active socket room
 * @access  Private
 */
router.post('/:id/resolve', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const panicEvent = await PanicEvent.findOne({ _id: id, userId: req.user.id });
    if (!panicEvent) {
      return res.status(404).json({ message: 'Panic event not found or unauthorized.' });
    }

    if (panicEvent.status === 'resolved') {
      return res.status(400).json({ message: 'SOS Panic has already been resolved.' });
    }

    // Resolve event
    panicEvent.status = 'resolved';
    panicEvent.resolvedAt = new Date();
    await panicEvent.save();

    // Broadcast resolve event to all contacts tracking the room
    const io = req.app.get('io');
    if (io) {
      io.to(`panic_${id}`).emit('panic-resolved', { resolvedAt: panicEvent.resolvedAt });
      console.log(`Socket Broadcast: Panic resolved in room panic_${id}`);
    }

    return res.status(200).json({ message: 'Emergency alert resolved successfully.', resolvedAt: panicEvent.resolvedAt });
  } catch (error) {
    console.error('SOS Resolve failure:', error);
    return res.status(500).json({ message: 'Server SOS resolution failure.' });
  }
});

export default router;
