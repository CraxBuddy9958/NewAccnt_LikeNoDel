// run.js - Multi-Account Bot v2.4 - With Configurable Link Removal
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const ONE_HOUR_MS = 60 * 60 * 1000;
const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS = 5;
const IDLE_TIMEOUT_MS = 30 * 1000;  // 🔧 CHANGED: 30 seconds (was 3 minutes)

function sleep(ms) { 
    return new Promise(resolve => setTimeout(resolve, ms)); 
}

function loadScript(filename) {
    const fullPath = path.join(__dirname, filename);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null;
}

function normalizeCookie(c) {
    const cookie = {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        httpOnly: !!c.httpOnly,
        secure: !!c.secure
    };
    if (c.expirationDate && !c.session) cookie.expires = Math.floor(Number(c.expirationDate));
    if (c.sameSite) {
        const s = String(c.sameSite).toLowerCase();
        if (['lax', 'strict', 'none'].includes(s)) cookie.sameSite = s;
    }
    return cookie;
}

// ============================================
// SINGLE SESSION RUNNER
// ============================================
async function runSession(account, scripts, sessionId) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 SESSION #${sessionId}: ${account.name}`);
    console.log(`${'='.repeat(50)}`);
    
    let browser = null;
    let page = null;
    let cycleCount = 0;
    let lastActivity = Date.now();
    let sessionStartTime = Date.now();

    try {
        // Create browser
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-translate',
                '--disable-sync',
                '--metrics-recording-only',
                '--disable-background-networking'
            ]
        });

        page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        // Set cookies
        if (Array.isArray(account.cookies) && account.cookies.length) {
            await page.setCookie(...account.cookies.map(normalizeCookie));
            console.log(`[runner] 🍪 Set ${account.cookies.length} cookies`);
        }

        // Event handlers
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Step1') || text.includes('Step2') || text.includes('Liked') || text.includes('Removed') || text.includes('REMOVE_LINKS')) {
                console.log(`[page] 📜`, text);
                lastActivity = Date.now();
            }
        });

        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                const url = frame.url();
                console.log(`[page] 📍`, url);
                lastActivity = Date.now();
                await sleep(1000);
                await injectScripts(url);
            }
        });

        async function injectScripts(url) {
            try {
                if (scripts.autoReload) {
                    try { await page.addScriptTag({ content: scripts.autoReload }); } catch (e) {}
                }

                const isThreadsPage = /https:\/\/craxpro\.to\/threads\//.test(url);
                const isPostThreadPage = url.includes("craxpro.to/forums/") && url.includes("post-thread");

                if (isThreadsPage && scripts.step2) {
                    console.log('[runner] 🎯 THREAD → Step2 (Like)');
                    await sleep(1500);
                    await page.addScriptTag({ content: scripts.step2 });
                    cycleCount++;
                    console.log(`[runner] ✅ Cycle #${cycleCount}`);
                } else if (!isPostThreadPage && scripts.step1) {
                    console.log('[runner] 🎯 GENERAL → Step1 (Fetch)');
                    await sleep(1500);
                    await page.addScriptTag({ content: scripts.step1 });
                }
            } catch (e) {
                console.log('[runner] ⚠️ Inject error:', e.message.substring(0, 60));
            }
        }

        // Navigate to start
        console.log('[runner] 🌐 Loading:', account.startUrl || "https://craxpro.to");
        await page.goto(account.startUrl || "https://craxpro.to", { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });
        console.log('[runner] ✅ Page loaded, running...\n');

        // Main loop - run until error or timeout
        while (Date.now() - sessionStartTime < ONE_HOUR_MS) {
            const elapsed = Math.floor((Date.now() - sessionStartTime) / 60000);
            const idle = Math.floor((Date.now() - lastActivity) / 1000);
            
            console.log(`[runner] ⏰ ${elapsed}min | Cycles: ${cycleCount} | Idle: ${idle}s`);
            
            // Check for idle timeout (30 seconds)
            if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
                console.log('[runner] ⚠️ Idle timeout (30s), reloading...');
                await page.reload({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                lastActivity = Date.now();
            }
            
            await sleep(10000);  // Check every 10 seconds instead of 60
        }

    } catch (e) {
        console.log('[runner] 💥 Session error:', e.message.substring(0, 80));
    } finally {
        try { if (page) await page.close(); } catch (e) {}
        try { if (browser) await browser.close(); } catch (e) {}
    }

    return cycleCount;
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 MULTI-ACCOUNT BOT v2.4 - Configurable Link Removal');
    console.log('🔧 IDLE TIMEOUT: 30 seconds');
    console.log('='.repeat(60) + '\n');

    let accounts;
    if (process.env.ACCOUNTS_JSON) {
        accounts = JSON.parse(process.env.ACCOUNTS_JSON);
    } else if (fs.existsSync('./accounts.json')) {
        accounts = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    } else {
        console.error('[runner] ❌ No accounts found');
        process.exit(1);
    }

    const scripts = {
        step1: loadScript('step1_v3.js'),
        step2: loadScript('step2_v3.js'),
        autoReload: loadScript('auto_reload_v2.js')
    };

    console.log(`[runner] 👥 ${accounts.length} account(s)`);
    console.log(`[runner] 📜 Scripts: step1=${scripts.step1?'✓':'✗'} step2=${scripts.step2?'✓':'✗'}\n`);

    const totalStartTime = Date.now();
    let sessionId = 0;
    let totalCycles = 0;
    let restarts = 0;

    // Run sessions until time is up
    while (Date.now() - totalStartTime < ONE_HOUR_MS && restarts < MAX_RESTARTS) {
        sessionId++;
        
        for (const account of accounts) {
            const cycles = await runSession(account, scripts, sessionId);
            totalCycles += cycles;
            
            if (cycles === 0) {
                restarts++;
                console.log(`\n[runner] 📊 Restarts: ${restarts}/${MAX_RESTARTS}`);
                console.log(`[runner] ⏳ Waiting ${RESTART_DELAY_MS/1000}s before restart...\n`);
                await sleep(RESTART_DELAY_MS);
            } else {
                restarts = 0; // Reset restart count on successful session
            }
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ FINISHED`);
    console.log(`📊 Total cycles: ${totalCycles}`);
    console.log(`📊 Total sessions: ${sessionId}`);
    console.log(`📊 Restarts used: ${restarts}/${MAX_RESTARTS}`);
    console.log(`${'='.repeat(60)}\n`);
}

main().catch(e => {
    console.error('[runner] 💥 FATAL:', e.message);
    process.exit(1);
});
