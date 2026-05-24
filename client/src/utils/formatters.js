/**
 * Format remaining seconds into a standard MM:SS countdown format
 * @param {number} totalSeconds - Seconds remaining
 * @returns {string} Formatted MM:SS countdown string
 */
export const formatCountdown = (totalSeconds) => {
  if (totalSeconds <= 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format an ISO date/time string into a localized time string
 * @param {string|Date} dateVal - Date value to format
 * @returns {string} Localized time string
 */
export const formatTime = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format an ISO date/time string into a full date and time string
 * @param {string|Date} dateVal - Date value to format
 * @returns {string} Formatted date and time
 */
export const formatFullDateTime = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
