// run.js - Multi-Account Bot v2.2 - Full Browser Recovery
// Version: 2.2 - Restarts browser on crash

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// ============================================
// CONFIGURATION
// ============================================
const ONE_HOUR_MS = 60 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = 30 * 1000;
const MAX_BROWSER_RESTARTS = 10;

const SCRIPTS_FOLDER = __dirname;

function sleep(ms) { 
    return new Promise(resolve => setTimeout(resolve, ms)); 
}

function loadScript(filename) {
    const fullPath = path.join(SCRIPTS_FOLDER, filename);
    if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
    }
    return null;
}

function normalizeCookieForPuppeteer(c) {
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
// BROWSER MANAGER
// ============================================
let browser = null;
let browserRestartCount = 0;

async function createBrowser() {
    if (browser) {
        try { await browser.close(); } catch (e) {}
    }
    
    browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-translate',
            '--disable-sync'
        ]
    });
    
    browser.on('disconnected', () => {
        console.log('[browser] ⚠️ Browser disconnected');
    });
    
    return browser;
}

async function isBrowserAlive() {
    if (!browser) return false;
    try {
        const pages = await browser.pages();
        return pages.length >= 0;
    } catch (e) {
        return false;
    }
}

// ============================================
// ACCOUNT RUNNER
// ============================================
async function runAccount(account, scripts, totalStartTime) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 RUNNING: ${account.name}`);
    console.log(`${'='.repeat(50)}`);
    
    let page = null;
    let lastActivity = Date.now();
    let cycleCount = 0;
    let lastInjectedUrl = '';
    
    const touch = () => lastActivity = Date.now();

    async function createPage() {
        if (!await isBrowserAlive()) {
            console.log('[runner] ⚠️ Browser dead, recreating...');
            browserRestartCount++;
            console.log(`[runner] 📊 Browser restart: ${browserRestartCount}/${MAX_BROWSER_RESTARTS}`);
            await createBrowser();
        }
        
        if (page) {
            try { await page.close(); } catch (e) {}
        }
        
        page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        if (Array.isArray(account.cookies) && account.cookies.length) {
            const normalized = account.cookies.map(normalizeCookieForPuppeteer);
            await page.setCookie(...normalized);
            console.log(`[runner] 🍪 Set ${normalized.length} cookies`);
        }

        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Step1') || text.includes('Step2')) {
                console.log(`[page] 📜`, text);
            }
            touch();
        });

        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                const url = frame.url();
                console.log(`\n[page] 📍`, url);
                touch();
                await sleep(500);
                await injectScripts(url);
            }
        });

        return page;
    }

    async function injectScripts(url) {
        try {
            if (scripts.autoReload) {
                try { await page.addScriptTag({ content: scripts.autoReload }); } catch (e) {}
            }

            const isThreadsPage = /https:\/\/craxpro\.to\/threads\//.test(url);
            const isPostThreadPage = url.includes("craxpro.to/forums/") && url.includes("post-thread");

            if (isThreadsPage && scripts.step2) {
                console.log('[runner] 🎯 THREAD → Step2');
                await sleep(1000);
                await page.addScriptTag({ content: scripts.step2 });
                cycleCount++;
                lastInjectedUrl = url;
                console.log(`[runner] ✅ Cycle: ${cycleCount}`);
            } else if (!isPostThreadPage && scripts.step1) {
                console.log('[runner] 🎯 GENERAL → Step1');
                await sleep(1000);
                await page.addScriptTag({ content: scripts.step1 });
                lastInjectedUrl = url;
            }
        } catch (e) {
            console.log('[runner] ❌ Inject failed:', e.message.substring(0, 50));
        }
    }

    // ============================================
    // WATCHDOG & HEARTBEAT
    // ============================================
    const watchdog = setInterval(async () => {
        const idle = Date.now() - lastActivity;
        if (idle > IDLE_TIMEOUT_MS) {
            console.log(`[watchdog] ⚠️ Idle ${Math.floor(idle/1000)}s, restarting...`);
            if (browserRestartCount < MAX_BROWSER_RESTARTS) {
                await createPage();
                try {
                    await page.goto(account.startUrl || "https://craxpro.to", { waitUntil: 'networkidle2', timeout: 30000 });
                } catch (e) {}
                touch();
            }
        }
    }, WATCHDOG_INTERVAL_MS);

    const heartbeat = setInterval(async () => {
        if (!await isBrowserAlive()) {
            console.log('[heartbeat] ❌ Browser dead');
            if (browserRestartCount < MAX_BROWSER_RESTARTS) {
                await createPage();
            }
        }
    }, HEARTBEAT_MS);

    // ============================================
    // MAIN LOOP
    // ============================================
    try {
        await createPage();
        await page.goto(account.startUrl || "https://craxpro.to", { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('[runner] ✅ Page loaded');

        while (Date.now() - totalStartTime < ONE_HOUR_MS && browserRestartCount < MAX_BROWSER_RESTARTS) {
            const elapsed = Math.floor((Date.now() - totalStartTime) / 60000);
            const remaining = 60 - elapsed;
            console.log(`\n[runner] ⏰ ${elapsed}m/${remaining}m | Cycles: ${cycleCount} | Browser restarts: ${browserRestartCount}`);
            await sleep(60000);
        }
    } catch (e) {
        console.log('[runner] 💥 Error:', e.message.substring(0, 50));
    } finally {
        clearInterval(watchdog);
        clearInterval(heartbeat);
        try { if (page) await page.close(); } catch (e) {}
    }

    return cycleCount;
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 MULTI-ACCOUNT BOT v2.2 - Full Browser Recovery');
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

    console.log(`[runner] 👥 ${accounts.length} account(s)\n`);
    console.log(`[runner] Scripts: step1=${scripts.step1?'✓':'✗'} step2=${scripts.step2?'✓':'✗'}\n`);

    await createBrowser();
    const startTime = Date.now();
    let totalCycles = 0;

    while (Date.now() - startTime < ONE_HOUR_MS && browserRestartCount < MAX_BROWSER_RESTARTS) {
        for (const account of accounts) {
            const cycles = await runAccount(account, scripts, startTime);
            totalCycles += cycles;
        }
    }

    if (browser) try { await browser.close(); } catch (e) {}
    console.log(`\n✅ Done | Total cycles: ${totalCycles} | Browser restarts: ${browserRestartCount}`);
}

main().catch(e => {
    console.error('[runner] 💥 FATAL:', e.message);
    process.exit(1);
});
