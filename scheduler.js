// ============================================
// SCHEDULER - 25-Hour Cycle Launcher
// ============================================
// 
// This scheduler:
// 1. Waits until the configured launch time (IST)
// 2. Runs the bot for 1 hour
// 3. Waits 25 hours before running again
//
// ============================================

const { spawn } = require('child_process');
const fs = require('fs');

// ============================================
// ⚙️ CONFIGURATION - SET YOUR LAUNCH TIME HERE
// ============================================
const LAUNCH_HOUR_IST = 4;      // 23 = 11 PM IST
const LAUNCH_MINUTE_IST = 15;    // Minutes (0-59)

// ============================================
// CONSTANTS
// ============================================
const ONE_HOUR_MS = 60 * 60 * 1000;
const CYCLE_HOURS_MS = 25 * 60 * 60 * 1000;  // 25 hours
const SAFETY_TIMEOUT_MS = 65 * 60 * 1000;    // 65 minutes safety

// ============================================
// LOGGING
// ============================================
function log(message, emoji = '') {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const logMsg = `${emoji ? emoji + ' ' : ''}[${timestamp} IST] ${message}`;
    console.log(logMsg);
    
    try {
        fs.appendFileSync('/tmp/scheduler.log', logMsg + '\n');
    } catch (e) {}
}

// ============================================
// RUN BOT
// ============================================
function runBot() {
    return new Promise((resolve) => {
        log('Starting bot for 1 hour session...', '🚀');
        
        const bot = spawn('node', ['run.js'], {
            stdio: 'inherit',
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        // Safety kill after 65 minutes (in case bot hangs)
        const safetyTimeout = setTimeout(() => {
            log('Safety timeout - terminating bot', '⏰');
            bot.kill('SIGTERM');
        }, SAFETY_TIMEOUT_MS);

        bot.on('close', (code) => {
            clearTimeout(safetyTimeout);
            log(`Bot finished with code ${code}`, code === 0 ? '✅' : '⚠️');
            resolve();
        });

        bot.on('error', (err) => {
            clearTimeout(safetyTimeout);
            log(`Bot error: ${err.message}`, '❌');
            resolve();
        });
    });
}

// ============================================
// SLEEP UTILITY
// ============================================
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// CALCULATE TIME UNTIL LAUNCH
// ============================================
function getTimeUntilLaunch() {
    const now = new Date();
    
    // Get current time in IST
    const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Create target time for today in IST
    const targetIST = new Date(nowIST);
    targetIST.setHours(LAUNCH_HOUR_IST, LAUNCH_MINUTE_IST, 0, 0);
    
    // If target time already passed today, schedule for tomorrow
    if (targetIST <= nowIST) {
        targetIST.setDate(targetIST.getDate() + 1);
    }
    
    // Calculate wait time in milliseconds
    const waitMs = targetIST.getTime() - nowIST.getTime();
    
    return { waitMs, targetIST };
}

// ============================================
// FORMAT TIME DURATION
// ============================================
function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// ============================================
// MAIN SCHEDULER
// ============================================
async function main() {
    console.log('\n' + '='.repeat(50));
    console.log('📅 25-HOUR CYCLE SCHEDULER');
    console.log('='.repeat(50) + '\n');
    
    log(`Launch time configured: ${LAUNCH_HOUR_IST}:${LAUNCH_MINUTE_IST.toString().padStart(2, '0')} IST`, '⚡');
    
    // Calculate time until first launch
    const { waitMs, targetIST } = getTimeUntilLaunch();
    
    log(`First launch in ${formatDuration(waitMs)}`, '⏳');
    log(`Launch scheduled for: ${targetIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, '📅');
    
    // Wait until launch time
    await sleep(waitMs);
    
    // Main loop - run, then wait 25 hours
    let cycleNumber = 1;
    
    while (true) {
        log(`\n${'='.repeat(40)}`, '');
        log(`CYCLE #${cycleNumber}`, '🔄');
        log(`${'='.repeat(40)}`, '');
        
        // Run the bot
        await runBot();
        
        // Calculate next run time
        const nextRun = new Date(Date.now() + CYCLE_HOURS_MS);
        
        log('Bot session completed. Sleeping for 25 hours...', '😴');
        log(`Next run scheduled: ${nextRun.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, '⏰');
        
        cycleNumber++;
        
        // Wait 25 hours before next run
        await sleep(CYCLE_HOURS_MS);
    }
}

// ============================================
// START
// ============================================
main().catch(error => {
    log(`Fatal error: ${error.message}`, '💥');
    console.error(error);
    process.exit(1);
});
