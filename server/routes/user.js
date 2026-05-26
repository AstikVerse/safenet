import express from 'express';
import User from '../models/User.js';
import verifyToken from '../middleware/verifyToken.js';
import { sendPanicAlert } from '../utils/mailer.js';

const router = express.Router();

// Apply authorization check globally on user routes
router.use(verifyToken);

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile details along with trusted contacts
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ message: 'Server profile error.' });
  }
});

/**
 * @route   PUT /api/user/contacts
 * @desc    Update trusted contacts list (maximum 5 contacts)
 * @access  Private
 */
router.put('/contacts', async (req, res) => {
  const { contacts } = req.body;

  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ message: 'Contacts array is required.' });
  }

  if (contacts.length > 5) {
    return res.status(400).json({ message: 'Maximum of 5 trusted contacts allowed.' });
  }

  // Validate contacts structure
  for (const contact of contacts) {
    if (!contact.name || !contact.phone || !contact.email) {
      return res.status(400).json({ message: 'Each contact must contain a name, phone, and email.' });
    }
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.trustedContacts = contacts;
    await user.save();

    return res.status(200).json({
      message: 'Trusted contacts updated successfully.',
      trustedContacts: user.trustedContacts
    });
  } catch (error) {
    console.error('Contacts update error:', error);
    return res.status(500).json({ message: error.message || 'Server contacts update error.' });
  }
});

/**
 * @route   PUT /api/user/message
 * @desc    Update default emergency SMS message
 * @access  Private
 */
router.put('/message', async (req, res) => {
  const { emergencyMessage } = req.body;

  if (!emergencyMessage || typeof emergencyMessage !== 'string' || emergencyMessage.trim() === '') {
    return res.status(400).json({ message: 'Valid emergency message is required.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.emergencyMessage = emergencyMessage;
    await user.save();

    return res.status(200).json({
      message: 'Emergency message updated successfully.',
      emergencyMessage: user.emergencyMessage
    });
  } catch (error) {
    console.error('Emergency message update error:', error);
    return res.status(500).json({ message: 'Server message update error.' });
  }
});

/**
 * @route   POST /api/user/test-contact
 * @desc    Send a test emergency safety email alert to a selected contact
 * @access  Private
 */
router.post('/test-contact', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Contact email is required.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Daily Email Rate Limiter Quota check for test alerts (Model B)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (user.lastSosEmailDate !== todayStr) {
      user.dailySosEmailsCount = 0;
      user.lastSosEmailDate = todayStr;
    }

    const MAX_SOS_EMAILS_PER_DAY = parseInt(process.env.MAX_SOS_EMAILS_PER_DAY) || 3;
    if (user.dailySosEmailsCount >= MAX_SOS_EMAILS_PER_DAY) {
      return res.status(400).json({
        message: 'Daily emergency email limit reached (3/3). Please try again tomorrow.'
      });
    }

    const contact = user.trustedContacts.find(c => c.email === email);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found in your trusted contacts list.' });
    }

    // Increment count by 1 for this test email
    user.dailySosEmailsCount = (user.dailySosEmailsCount || 0) + 1;
    await user.save();

    // Call mailer with test link
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const testTrackingLink = `${clientUrl}/track/test-panic-id?token=test-token`;
    
    // Create fuzzed test coordinates
    const testLocation = { lat: 28.6139, lng: 77.2090 };

    await sendPanicAlert(user, testLocation, [contact], testTrackingLink);

    return res.status(200).json({
      message: `Test email alert successfully dispatched to ${contact.name}.`
    });
  } catch (error) {
    console.error('Test alert error:', error);
    return res.status(500).json({ message: 'Server failed to send test alert.' });
  }
});

export default router;

