import nodemailer from 'nodemailer';
import https from 'https';

// Helper to make secure HTTPS POST requests to SendGrid API without external library dependencies
const sendGridPost = (apiKey, bodyData) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(bodyData);
    
    const options = {
      hostname: 'api.sendgrid.com',
      port: 443,
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ messageId: res.headers['x-message-id'] || 'sendgrid-success-msg' });
        } else {
          reject(new Error(`SendGrid API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

const createTransporter = async () => {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (user && user !== 'yourgmail@gmail.com' && pass && pass !== 'your_16char_app_password') {
    // Production Gmail SMTP
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  } else {
    // Fallback/Local Ethereal Mailer so that standard operations never crash
    console.log('⚠️ GMAIL_USER/GMAIL_APP_PASSWORD not configured. Creating Ethereal Test Account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.error('Failed to create Ethereal transporter. Falling back to log-only transporter.');
      return {
        sendMail: async (mailOptions) => {
          console.log('\n==================================================');
          console.log('📬 [LOG MAIL ALERT SENT] 📬');
          console.log(`From: ${mailOptions.from}`);
          console.log(`To: ${mailOptions.to}`);
          console.log(`Subject: ${mailOptions.subject}`);
          console.log(`HTML Body Excerpt:\n${mailOptions.html.substring(0, 800)}...`);
          console.log('==================================================\n');
          return { messageId: 'log-only-mock-id' };
        }
      };
    }
  }
};

/**
 * Send Panic SOS alert email to all trusted contacts
 */
export const sendPanicAlert = async (user, location, contacts, trackingLink) => {
  if (!contacts || contacts.length === 0) return [];
  
  const useSendGrid = !!process.env.SENDGRID_API_KEY;
  const timeString = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  }) + " (IST)";
  const results = [];

  for (const contact of contacts) {
    const textFallback = `
SafeNet Personal Safety Update

Hello ${contact.name},

Your trusted contact ${user.name} has activated a SafeNet safety session and shared their current location with you.

Safety Status:
Live location tracking is currently active.

Notification Time:
${timeString}

Current Coordinates:
Latitude: ${location.lat}
Longitude: ${location.lng}

Available Actions:
• View live tracking in SafeNet: ${trackingLink}
• Open current location in Google Maps: https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}
• Contact trusted user directly: tel:${user.phone}

Why am I receiving this?
You are receiving this notification because you were added as a trusted contact in SafeNet.

SafeNet Personal Safety Network © 2026
Automated trusted contact communication.
`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SafeNet Personal Safety Update</title>
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #F8FAFC; color: #1E293B; margin: 0; padding: 20px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background-color: #334155; padding: 24px; text-align: center; color: #FFFFFF; font-weight: 600; font-size: 20px; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1E293B; }
          .alert-box { background-color: #F1F5F9; border-left: 4px solid #475569; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .alert-msg { font-style: italic; color: #475569; font-size: 16px; margin: 0; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { background-color: #334155; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(51, 65, 85, 0.2); transition: all 200ms ease; }
          .info-list { list-style: none; padding: 0; margin: 24px 0; }
          .info-item { padding: 8px 0; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 15px; }
          .info-label { font-weight: 600; color: #1E293B; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            SafeNet Personal Safety Update
          </div>
          <div class="content">
            <div class="greeting">Hello ${contact.name},</div>
            <p>Your trusted contact, <strong>${user.name}</strong>, has activated a SafeNet safety session and shared their current location with you.</p>
            
            <div class="alert-box">
              <p class="info-label" style="margin-top:0; margin-bottom: 6px;">Safety Status:</p>
              <p class="alert-msg">Live location tracking is currently active.</p>
            </div>

            <div class="btn-container">
              <a href="${trackingLink}" class="btn" target="_blank">Track Live Location</a>
            </div>

            <ul class="info-list">
              <li class="info-item"><span class="info-label">Notification Time:</span> ${timeString}</li>
              <li class="info-item"><span class="info-label">Current Coordinates:</span> <a href="https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}" style="color: #3b82f6; text-decoration: underline; font-weight: 600;" target="_blank">Latitude: ${location.lat}, Longitude: ${location.lng}</a></li>
              <li class="info-item"><span class="info-label">Available Actions:</span>
                <ul style="margin: 8px 0 0 16px; padding: 0; list-style-type: disc; color: #475569;">
                  <li>View live tracking in SafeNet</li>
                  <li><a href="https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}" style="color: #3b82f6; text-decoration: none;" target="_blank">Open current location in Google Maps</a></li>
                  <li><a href="tel:${user.phone}" style="color: #6366f1; text-decoration: none;" target="_blank">Contact trusted user directly (${user.phone})</a></li>
                </ul>
              </li>
            </ul>

            <p style="font-size: 13px; color: #64748B; line-height: 1.5; margin-top: 24px; border-top: 1px dashed #E2E8F0; padding-top: 16px;">
              <strong>Why am I receiving this?</strong><br>
              You are receiving this notification because you were added as a trusted contact in SafeNet.
            </p>
          </div>
          <div class="footer">
            SafeNet Personal Safety Network © 2026. Automated trusted contact communication.
          </div>
        </div>
      </body>
      </html>
    `;

    if (useSendGrid) {
      try {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER || process.env.GMAIL_USER;
        
        const bodyData = {
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }]
          }],
          from: {
            email: fromEmail,
            name: 'SafeNet Safety Alerts'
          },
          subject: `SafeNet Safety Update — Live Tracking Available`,
          content: [
            {
              type: 'text/plain',
              value: textFallback
            },
            {
              type: 'text/html',
              value: html
            }
          ]
        };

        await sendGridPost(apiKey, bodyData);
        console.log(`Email sent successfully via SendGrid to ${contact.name} (${contact.email})`);
        results.push({ contactName: contact.name, email: contact.email, sentAt: new Date() });
      } catch (err) {
        console.error(`Error sending SendGrid panic alert to ${contact.email}:`, err);
      }
    } else {
      // Fallback to standard Nodemailer SMTP
      try {
        const transporter = await createTransporter();
        await transporter.sendMail({
          from: `"SafeNet Safety Alerts" <${process.env.EMAIL_USER || process.env.GMAIL_USER || 'safenet-alert@ethereal.email'}>`,
          to: contact.email,
          subject: `SafeNet Safety Update — Live Tracking Available`,
          text: textFallback,
          html
        });
        console.log(`Email sent successfully via SMTP to ${contact.name} (${contact.email})`);
        results.push({ contactName: contact.name, email: contact.email, sentAt: new Date() });
      } catch (err) {
        console.error(`Error sending SMTP panic alert email to ${contact.email}:`, err);
      }
    }
  }

  return results;
};

/**
 * Send missed checkin alert email to all trusted contacts
 */
export const sendCheckinAlert = async (user, location, contacts) => {
  if (!contacts || contacts.length === 0) return [];
  
  const useSendGrid = !!process.env.SENDGRID_API_KEY;
  const timeString = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  }) + " (IST)";
  const results = [];
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

  for (const contact of contacts) {
    const textFallback = `
SafeNet Check-in Update

Hello ${contact.name},

Your trusted contact ${user.name} started a scheduled SafeNet check-in. The check-in timer has concluded without a safe confirmation.

Safety Status:
Check-in timer has concluded without a safe confirmation.

Notification Time:
${timeString}

Last Known Coordinates:
Latitude: ${location.lat}
Longitude: ${location.lng}

Available Actions:
• View last known location in SafeNet: ${mapLink}
• Open last known location in Google Maps: ${mapLink}
• Contact trusted user directly: tel:${user.phone}

Why am I receiving this?
You are receiving this notification because you were added as a trusted contact in SafeNet.

SafeNet Personal Safety Network © 2026
Automated trusted contact communication.
`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SafeNet Check-in Status Update</title>
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #F8FAFC; color: #1E293B; margin: 0; padding: 20px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background-color: #475569; padding: 24px; text-align: center; color: #FFFFFF; font-weight: 600; font-size: 20px; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1E293B; }
          .alert-box { background-color: #F1F5F9; border-left: 4px solid #64748B; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .alert-msg { font-style: italic; color: #475569; font-size: 16px; margin: 0; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { background-color: #475569; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(71, 85, 105, 0.2); transition: all 200ms ease; }
          .info-list { list-style: none; padding: 0; margin: 24px 0; }
          .info-item { padding: 8px 0; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 15px; }
          .info-label { font-weight: 600; color: #1E293B; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            SafeNet Check-in Status Update
          </div>
          <div class="content">
            <div class="greeting">Hello ${contact.name},</div>
            <p>Your trusted contact, <strong>${user.name}</strong>, started a scheduled SafeNet check-in. The check-in timer has concluded without a safe confirmation.</p>
            
            <div class="alert-box">
              <p class="info-label" style="margin-top:0; margin-bottom: 6px;">Safety Status:</p>
              <p class="alert-msg">Check-in timer has concluded without a safe confirmation.</p>
            </div>

            <div class="btn-container">
              <a href="${mapLink}" class="btn" target="_blank">View Last Known Location</a>
            </div>

            <ul class="info-list">
              <li class="info-item"><span class="info-label">Notification Time:</span> ${timeString}</li>
              <li class="info-item"><span class="info-label">Last Known Coordinates:</span> <a href="${mapLink}" style="color: #3b82f6; text-decoration: underline; font-weight: 600;" target="_blank">Latitude: ${location.lat}, Longitude: ${location.lng}</a></li>
              <li class="info-item"><span class="info-label">Available Actions:</span>
                <ul style="margin: 8px 0 0 16px; padding: 0; list-style-type: disc; color: #475569;">
                  <li>View last known location in SafeNet</li>
                  <li><a href="${mapLink}" style="color: #3b82f6; text-decoration: none;" target="_blank">Open last known location in Google Maps</a></li>
                  <li><a href="tel:${user.phone}" style="color: #6366f1; text-decoration: none;" target="_blank">Contact trusted user directly (${user.phone})</a></li>
                </ul>
              </li>
            </ul>

            <p style="font-size: 13px; color: #64748B; line-height: 1.5; margin-top: 24px; border-top: 1px dashed #E2E8F0; padding-top: 16px;">
              <strong>Why am I receiving this?</strong><br>
              You are receiving this notification because you were added as a trusted contact in SafeNet.
            </p>
          </div>
          <div class="footer">
            SafeNet Personal Safety Network © 2026. Automated trusted contact communication.
          </div>
        </div>
      </body>
      </html>
    `;

    if (useSendGrid) {
      try {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER || process.env.GMAIL_USER;
        
        const bodyData = {
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }]
          }],
          from: {
            email: fromEmail,
            name: 'SafeNet Safety Alerts'
          },
          subject: `SafeNet Check-in Update — Timer Concluded`,
          content: [
            {
              type: 'text/plain',
              value: textFallback
            },
            {
              type: 'text/html',
              value: html
            }
          ]
        };

        await sendGridPost(apiKey, bodyData);
        console.log(`Check-in email sent successfully via SendGrid to ${contact.name} (${contact.email})`);
        results.push({ contactName: contact.name, email: contact.email, sentAt: new Date() });
      } catch (err) {
        console.error(`Error sending SendGrid check-in alert to ${contact.email}:`, err);
      }
    } else {
      // Fallback to standard Nodemailer SMTP
      try {
        const transporter = await createTransporter();
        await transporter.sendMail({
          from: `"SafeNet Safety Alerts" <${process.env.EMAIL_USER || process.env.GMAIL_USER || 'safenet-alert@ethereal.email'}>`,
          to: contact.email,
          subject: `SafeNet Check-in Update — Timer Concluded`,
          text: textFallback,
          html
        });
        console.log(`Check-in alert email sent successfully to ${contact.name} (${contact.email})`);
        results.push({ contactName: contact.name, email: contact.email, sentAt: new Date() });
      } catch (err) {
        console.error(`Error sending check-in alert email to ${contact.email}:`, err);
      }
    }
  }

  return results;
};
