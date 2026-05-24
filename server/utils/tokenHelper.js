import jwt from 'jsonwebtoken';

const getSecrets = () => {
  const jwtSecret = process.env.JWT_SECRET || 'safenet_user_auth_secret_key_32chars_long_minimum';
  const trackingSecret = process.env.JWT_TRACKING_SECRET || 'safenet_public_panic_tracking_secret_key_32chars_long_minimum';
  return { jwtSecret, trackingSecret };
};

/**
 * Generate a standard auth token for users, valid for 7 days
 * @param {string} userId - The user ID
 * @returns {string} Signed JWT
 */
export const generateAuthToken = (userId) => {
  const { jwtSecret } = getSecrets();
  return jwt.sign({ id: userId }, jwtSecret, { expiresIn: '7d' });
};

/**
 * Generate a public tracking token for a specific panic event, valid for 2 hours
 * @param {string} panicId - The Panic Event ID
 * @returns {string} Signed JWT for contacts
 */
export const generateTrackingToken = (panicId) => {
  const { trackingSecret } = getSecrets();
  return jwt.sign({ panicId }, trackingSecret, { expiresIn: '2h' });
};

/**
 * Verify a panic event tracking token
 * @param {string} token - The tracking JWT
 * @returns {object|null} Decoded payload or null
 */
export const verifyTrackingToken = (token) => {
  const { trackingSecret } = getSecrets();
  try {
    return jwt.verify(token, trackingSecret);
  } catch (error) {
    return null;
  }
};
