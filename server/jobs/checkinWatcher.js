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

  // 2. Run Panic SOS active watchers every 30 seconds (Phase 2 priority escalation + 5m updates)
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const now = new Date();
      // Find active PanicEvents
      const activePanics = await PanicEvent.find({ status: 'active' });
      if (activePanics.length === 0) return;

      // Configurable Escalation Delay (Default: 10 minutes)
      const ESCALATION_DELAY_MINUTES = parseInt(process.env.ESCALATION_DELAY_MINUTES) || 10;
      const ESCALATION_DELAY_MS = ESCALATION_DELAY_MINUTES * 60 * 1000;

      // 5-minute interval for standard periodic updates
      const EMAIL_INTERVAL_MS = 5 * 60 * 1000;

      for (const panic of activePanics) {
        try {
          const user = await User.findById(panic.userId);
          if (!user) {
            console.error(`User not found for panic event: ${panic._id}`);
            continue;
          }

          const contacts = user.trustedContacts || [];
          if (contacts.length === 0) continue;

          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          const trackingLink = `${clientUrl}/track/${panic._id}?token=${panic.trackingToken}`;

          // Check if Phase 2 Secondary Escalation is due
          const elapsedMs = now.getTime() - new Date(panic.triggeredAt).getTime();
          if (!panic.secondaryAlertsSent && elapsedMs >= ESCALATION_DELAY_MS) {
            console.log(`🚨 Priority Escalation: Active SOS for ${user.name} has been active for ${ESCALATION_DELAY_MINUTES} min. Dispatched Phase 2 escalation to all contacts...`);

            // Email primary & secondary contacts with latest coordinates
            const sentResults = await sendPanicAlert(user, panic.location, contacts, trackingLink);

            // Update alert metadata
            panic.alertsSent.push(...sentResults);
            panic.secondaryAlertsSent = true;
            panic.lastEmailSentAt = now;
            await panic.save();
            continue; // Proceed to next panic
          }

          // Otherwise, run standard 5-minute periodic updates (only after Phase 2 has fired, or for primary contacts if no secondary exists)
          const lastSentTime = new Date(panic.lastEmailSentAt || panic.triggeredAt).getTime();
          if (now.getTime() - lastSentTime >= EMAIL_INTERVAL_MS) {
            console.log(`🚨 Periodic SOS Alert: Sending 5m update for active panic of ${user.name}...`);

            // If secondary alerts have not been sent yet (we are still within the 10-minute window),
            // periodic updates should only go to PRIMARY contacts!
            // Once secondary alerts are sent, periodic updates go to ALL contacts!
            const targetContacts = panic.secondaryAlertsSent 
              ? contacts 
              : contacts.filter(c => c.priority === 'primary' || !c.priority);

            if (targetContacts.length > 0) {
              const sentResults = await sendPanicAlert(user, panic.location, targetContacts, trackingLink);
              panic.alertsSent.push(...sentResults);
            }

            panic.lastEmailSentAt = now;
            await panic.save();
            console.log(`✅ Periodic SOS Alert: Updated for panic event ${panic._id}.`);
          }
        } catch (err) {
          console.error(`Error processing periodic panic email update for ${panic._id}:`, err);
        }
      }
    } catch (err) {
      console.error('Error in background SOS periodic email watcher cron job:', err);
    }
  });
};
