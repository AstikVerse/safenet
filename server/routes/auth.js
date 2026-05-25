import express from 'express';
import User from '../models/User.js';
import { generateAuthToken } from '../utils/tokenHelper.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply rate limiter to auth requests
router.use(authLimiter);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { name, phone, email, password } = req.body;

  // Basic validation
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  // Password policy check: minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one uppercase letter (A-Z).' });
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one lowercase letter (a-z).' });
  }
  if (!/\d/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one number (0-9).' });
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one special character (e.g. !, @, #, $, %).' });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    // Create user. Note: password pre-save hook will hash it into passwordHash
    const user = new User({
      name,
      phone,
      email,
      passwordHash: password // Pass raw, pre-save hook converts to passwordHash
    });

    await user.save();

    // Generate JWT
    const token = generateAuthToken(user._id);

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server registration error. Please try again.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Verify password using schema compare helper
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = generateAuthToken(user._id);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        trustedContacts: user.trustedContacts,
        emergencyMessage: user.emergencyMessage
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server login error. Please try again.' });
  }
});

export default router;
