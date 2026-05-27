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
  const user = process.env.GMAIL_USER;
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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>URGENT SAFETY ALERT - SafeNet</title>
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #FFF7F7; color: #1A1A2E; margin: 0; padding: 20px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #F1D5D8; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
          .header { background-color: #F43F5E; padding: 24px; text-align: center; color: #FFFFFF; font-weight: 600; font-size: 22px; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1A1A2E; }
          .alert-box { background-color: #FFF7F7; border-left: 4px solid #F43F5E; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .alert-msg { font-style: italic; color: #4A4A6A; font-size: 16px; margin: 0; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { background-color: #F43F5E; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(244, 63, 94, 0.3); transition: all 200ms ease; }
          .info-list { list-style: none; padding: 0; margin: 24px 0; }
          .info-item { padding: 8px 0; border-bottom: 1px solid #F1D5D8; color: #4A4A6A; font-size: 15px; }
          .info-label { font-weight: 600; color: #1A1A2E; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #8888A8; border-top: 1px solid #F1D5D8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ⚠️ URGENT SAFETY ALERT
          </div>
          <div class="content">
            <div class="greeting">Hello ${contact.name},</div>
            <p>Your trusted contact, <strong>${user.name}</strong>, has triggered an emergency SOS alert. They need your assistance immediately.</p>
            
            <div class="alert-box">
              <p class="info-label" style="margin-top:0; margin-bottom: 6px;">Their Emergency Message:</p>
              <p class="alert-msg">"${user.emergencyMessage || 'I need help. This is my live location.'}"</p>
            </div>

            <div class="btn-container">
              <a href="${trackingLink}" class="btn" target="_blank">View Live Location</a>
            </div>

            <ul class="info-list">
              <li class="info-item"><span class="info-label">Triggered At:</span> ${timeString}</li>
              <li class="info-item"><span class="info-label">Last Known GPS:</span> <a href="https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}" style="color: #F43F5E; text-decoration: underline; font-weight: 600;" target="_blank">lat: ${location.lat}, lng: ${location.lng} (Click to open Google Maps)</a></li>
              <li class="info-item"><span class="info-label">Contact User:</span> <a href="tel:${user.phone}" style="color: #8B5CF6; text-decoration: none; font-weight: 600;">Call ${user.phone}</a></li>
            </ul>

            <p style="font-size: 14px; color: #4A4A6A;">Please click the button above to track their live movement in real time on the SafeNet Portal. If the tracking portal is inaccessible or you are experiencing connection issues, you can instantly view their exact location on <a href="https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}" style="color: #F43F5E; text-decoration: underline; font-weight: 600;" target="_blank">Google Maps Here</a>.</p>
          </div>
          <div class="footer">
            SafeNet Personal Safety Network © 2026. This is an automated emergency communication.
          </div>
        </div>
      </body>
      </html>
    `;

    if (useSendGrid) {
      try {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_USER;
        
        const bodyData = {
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }]
          }],
          from: {
            email: fromEmail,
            name: 'SafeNet Emergency Alert'
          },
          subject: `⚠️ URGENT: Emergency SOS Alert from ${user.name}`,
          content: [{
            type: 'text/html',
            value: html
          }]
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
          from: `"SafeNet Emergency Alert" <${process.env.GMAIL_USER || 'safenet-alert@ethereal.email'}>`,
          to: contact.email,
          subject: `⚠️ URGENT: Emergency SOS Alert from ${user.name}`,
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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>MISSED CHECK-IN ALERT - SafeNet</title>
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #FFF7F7; color: #1A1A2E; margin: 0; padding: 20px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #F1D5D8; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
          .header { background-color: #8B5CF6; padding: 24px; text-align: center; color: #FFFFFF; font-weight: 600; font-size: 22px; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1A1A2E; }
          .alert-box { background-color: #FFF7F7; border-left: 4px solid #8B5CF6; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .alert-msg { font-style: italic; color: #4A4A6A; font-size: 16px; margin: 0; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { background-color: #8B5CF6; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); transition: all 200ms ease; }
          .info-list { list-style: none; padding: 0; margin: 24px 0; }
          .info-item { padding: 8px 0; border-bottom: 1px solid #F1D5D8; color: #4A4A6A; font-size: 15px; }
          .info-label { font-weight: 600; color: #1A1A2E; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #8888A8; border-top: 1px solid #F1D5D8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ⚠️ MISSED CHECK-IN ALERT
          </div>
          <div class="content">
            <div class="greeting">Hello ${contact.name},</div>
            <p>Your trusted contact, <strong>${user.name}</strong>, started a safety check-in on SafeNet but **did not check in as safe** before the timer expired.</p>
            
            <div class="alert-box">
              <p class="info-label" style="margin-top:0; margin-bottom: 6px;">Status:</p>
              <p class="alert-msg">Safe check-in timer has expired without cancellation. This is a safety precaution.</p>
            </div>

            <div class="btn-container">
              <a href="${mapLink}" class="btn" target="_blank">View Last Known GPS Map</a>
            </div>

            <ul class="info-list">
              <li class="info-item"><span class="info-label">Alert Time:</span> ${timeString}</li>
              <li class="info-item"><span class="info-label">Last Known GPS:</span> lat: ${location.lat}, lng: ${location.lng}</li>
              <li class="info-item"><span class="info-label">Contact User:</span> <a href="tel:${user.phone}" style="color: #8B5CF6; text-decoration: none; font-weight: 600;">Call ${user.phone}</a></li>
            </ul>

            <p style="font-size: 14px; color: #4A4A6A;">Please contact ${user.name} immediately to ensure their safety. If you cannot reach them, consider checking their last known location details above.</p>
          </div>
          <div class="footer">
            SafeNet Personal Safety Network © 2026. This is an automated emergency communication.
          </div>
        </div>
      </body>
      </html>
    `;

    if (useSendGrid) {
      try {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_USER;
        
        const bodyData = {
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }]
          }],
          from: {
            email: fromEmail,
            name: 'SafeNet Emergency Alert'
          },
          subject: `⚠️ URGENT: ${user.name} check-in missed`,
          content: [{
            type: 'text/html',
            value: html
          }]
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
          from: `"SafeNet Emergency Alert" <${process.env.GMAIL_USER || 'safenet-alert@ethereal.email'}>`,
          to: contact.email,
          subject: `⚠️ URGENT: ${user.name} check-in missed`,
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
