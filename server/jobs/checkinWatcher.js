import cron from 'node-cron';
import CheckIn from '../models/CheckIn.js';
import User from '../models/User.js';
import PanicEvent from '../models/PanicEvent.js';
import { sendCheckinAlert, sendPanicAlert } from '../utils/mailer.js';

export const startCheckinWatcher = () => {
  console.log('⏳ Starting background emergency watchers (node-cron)...');

  // 1. Run Check-in timer checker every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const now = new Date();
      // Find CheckIns where status=active and expiresAt <= now
      const activeCheckins = await CheckIn.find({
        status: 'active',
        expiresAt: { $lte: now }
      });

      if (activeCheckins.length === 0) return;

      console.log(`🔍 Watcher: Found ${activeCheckins.length} expired check-ins.`);

      for (const checkin of activeCheckins) {
        try {
          // Fetch user and check contacts
          const user = await User.findById(checkin.userId);
          if (!user) {
            console.error(`User not found for check-in: ${checkin._id}`);
            checkin.status = 'triggered';
            await checkin.save();
            continue;
          }

          console.log(`🚨 Watcher: Missed check-in detected for ${user.name}. Triggering alerts...`);

          // Fetch last known location
          const location = checkin.lastKnownLocation || { lat: 0, lng: 0 };
          const contacts = user.trustedContacts || [];

          let sentAlerts = [];
          if (contacts.length > 0) {
            // Trigger SMTP mails
            sentAlerts = await sendCheckinAlert(user, location, contacts);
          }

          // Update check-in status and save alerts sent
          checkin.status = 'triggered';
          checkin.alertsSent = sentAlerts;
          await checkin.save();

          console.log(`✅ Watcher: Expired check-in ${checkin._id} processed. ${sentAlerts.length} alerts logged.`);
        } catch (err) {
          console.error(`Error processing expired check-in ${checkin._id}:`, err);
        }
      }
    } catch (err) {
      console.error('Error in background check-in watcher cron job:', err);
    }
  });

  // 2. Run Panic SOS periodic emailing check every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const now = new Date();
      // Find active PanicEvents
      const activePanics = await PanicEvent.find({ status: 'active' });
      if (activePanics.length === 0) return;

      // 5-minute interval for periodic alerting
      const EMAIL_INTERVAL_MS = 5 * 60 * 1000;

      for (const panic of activePanics) {
        try {
          const lastSentTime = new Date(panic.lastEmailSentAt || panic.triggeredAt).getTime();
          if (now.getTime() - lastSentTime < EMAIL_INTERVAL_MS) {
            continue; // Not enough time has elapsed
          }

          const user = await User.findById(panic.userId);
          if (!user) {
            console.error(`User not found for panic event: ${panic._id}`);
            continue;
          }

          console.log(`🚨 Periodic SOS Alert: Sending update for active panic of ${user.name}...`);

          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          const trackingLink = `${clientUrl}/track/${panic._id}?token=${panic.trackingToken}`;
          const contacts = user.trustedContacts || [];

          if (contacts.length > 0) {
            // Send email to contacts with the LATEST location coordinates
            const sentResults = await sendPanicAlert(user, panic.location, contacts, trackingLink);
            
            // Append new alerts log to alertsSent array
            panic.alertsSent.push(...sentResults);
          }

          // Update lastEmailSentAt timestamp
          panic.lastEmailSentAt = now;
          await panic.save();

          console.log(`✅ Periodic SOS Alert: Updated for panic event ${panic._id}.`);
        } catch (err) {
          console.error(`Error processing periodic panic email update for ${panic._id}:`, err);
        }
      }
    } catch (err) {
      console.error('Error in background SOS periodic email watcher cron job:', err);
    }
  });
};
