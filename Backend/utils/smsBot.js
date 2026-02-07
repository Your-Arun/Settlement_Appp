const cron = require('node-cron');
const twilio = require('twilio');
const MapSnapshot = require('../models/MapSnapshot');
const Member = require('../models/Member');
const Settings = require('../models/Settings');
require('dotenv').config();

let client = null;

// Only enable Twilio if proper credentials are configured
if (
  process.env.TWILIO_SID &&
  process.env.TWILIO_SID.startsWith('AC') &&
  process.env.TWILIO_AUTH_TOKEN
) {
  client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.warn(
    '⚠️ Twilio is not fully configured (TWILIO_SID must start with AC). SMS sending is disabled.'
  );
}

let morningTask = null;
let eveningTask = null;

// Helper to create WhatsApp/SMS text
function formatMessage(date, shift, assignments, caption) {
    let msg = `⛽ *PUMP DUTY LIST*\n📅 ${date} (${shift})\n\n`;
    
    // Define display labels for keys
    const labels = {
        'Supervisor': '👮 Supervisor',
        'N1': '⛽ Nozzle 1', 'N2': '⛽ Nozzle 2', 'N3': '⛽ Nozzle 3', 'N4': '⛽ Nozzle 4',
        'N5': '🪝 Nozzle 5', 'N6': '🪝 Nozzle 6',
        'Extra': '👷 Extra', 'Air': '💨 Air Boy'
    };

    Object.keys(labels).forEach(key => {
        const staff = assignments[key];
        msg += `${labels[key]}: ${staff ? staff.name : '❌ Empty'}\n`;
    });

    if (assignments.absent && assignments.absent.length > 0) {
        const absentNames = assignments.absent.map(m => m.name).join(', ');
        msg += `\n🚫 Absent: ${absentNames}`;
    }

    if (caption) msg += `\n\n📝 Note: ${caption}`;
    return msg;
}

async function sendShiftReport(shiftName) {
    try {
        if (!client) {
            console.log('SMS send skipped: Twilio client not configured.');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const report = await MapSnapshot.findOne({ date: today, shift: shiftName });

        if (!report) {
            console.log(`⚠️ No map found for ${shiftName} today.`);
            return;
        }

        const messageBody = formatMessage(today, shiftName, report.assignments, report.caption);
        const members = await Member.find({});

        // Send to everyone with a phone number
        for (const member of members) {
            if (member.phoneNumber) {
                try {
                    await client.messages.create({
                        body: messageBody,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: member.phoneNumber
                    });
                    console.log(`✅ Sent to ${member.name}`);
                } catch (e) {
                    console.error(`❌ Failed: ${member.name}`);
                }
            }
        }
    } catch (e) {
        console.error("SMS Error:", e);
    }
}

async function restartScheduler() {
    // Stop old
    if (morningTask) morningTask.stop();
    if (eveningTask) eveningTask.stop();

    // Get Settings from DB
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const [mH, mM] = settings.morningTime.split(':');
    const [eH, eM] = settings.eveningTime.split(':');

    console.log(`⏰ Scheduler set: Morning ${settings.morningTime}, Evening ${settings.eveningTime}`);

    morningTask = cron.schedule(`${mM} ${mH} * * *`, () => sendShiftReport('Morning'), { timezone: "Asia/Kolkata" });
    eveningTask = cron.schedule(`${eM} ${eH} * * *`, () => sendShiftReport('Evening'), { timezone: "Asia/Kolkata" });
}

module.exports = { restartScheduler, sendShiftReport };