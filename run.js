// run.js - Multi-Account Bot with New Flow (Fetch → Like → Repeat)
// Version: 2.0
// 
// Flow:
// 1. Start at craxpro.to homepage
// 2. Step1: Fetch first link from Firebase, remove it, redirect to that link
// 3. Step2: If on thread page, like the post, redirect to homepage
// 4. Loop back to Step1

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
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = 30 * 1000;
const MAX_RESTARTS_PER_ACCOUNT = 5;

// ✅ FIX: Use root directory instead of 'userscripts' subfolder
const SCRIPTS_FOLDER = __dirname;

function sleep(ms) { 
    return new Promise(resolve => setTimeout(resolve, ms)); 
}

// ============================================
// SCRIPT LOADER
// ============================================
function loadScript(filename) {
    const fullPath = path.join(SCRIPTS_FOLDER, filename);
    if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
    }
    console.warn(`[runner] ⚠️ Script not found: ${fullPath}`);
    return null;
}

// ============================================
// COOKIE NORMALIZER
// ============================================
function normalizeCookieForPuppeteer(c) {
    const cookie = {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        httpOnly: !!c.httpOnly,
        secure: !!c.secure
    };

    if (c.expirationDate && !c.session) {
        cookie.expires = Math.floor(Number(c.expirationDate));
    }

    if (c.sameSite) {
        const s = String(c.sameSite).toLowerCase();
        if (['lax', 'strict', 'none'].includes(s)) cookie.sameSite = s;
    }

    return cookie;
}

// ============================================
// MAIN ACCOUNT RUNNER
// ============================================
async function runAccount(browser, account) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 START ACCOUNT: ${account.name}`);
    console.log(`${'='.repeat(50)}`);
    
    let page;
    let lastActivity = Date.now();
    let restartCount = 0;
    let lastInjectedUrl = '';
    let cycleCount = 0;

    const touch = () => lastActivity = Date.now();

    // ============================================
    // LOAD SCRIPTS
    // ============================================
    console.log('[runner] 📂 Loading userscripts...');
    
    // ✅ FIX: Use correct filename with uppercase 'V' to match actual file
    const step1Script = loadScript('step1_v3.js');      // Fetch link & redirect
    const step2Script = loadScript('step2_v3.js');      // Like & redirect
    const autoReloadScript = loadScript('auto_reload_v2.js');
    
    console.log('[runner] ✅ Scripts loaded:');
    console.log(`   - step1_v3.js: ${step1Script ? '✓' : '✗'}`);
    console.log(`   - step2_v3.js: ${step2Script ? '✓' : '✗'}`);
    console.log(`   - auto_reload_v2.js: ${autoReloadScript ? '✓' : '✗'}`);

    // ============================================
    // OPEN PAGE & SETUP
    // ============================================
    async function openPage() {
        page = await browser.newPage();

        // Set user agent and viewport
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1366, height: 768 });

        // ============================================
        // EXPOSE FETCH PROXY (for CORS fallback)
        // ============================================
        await page.exposeFunction('__FETCH_PROXY', async (url) => {
            try {
                const result = await page.evaluate(async (fetchUrl) => {
                    try {
                        const res = await fetch(fetchUrl, {
                            cache: 'no-cache',
                            headers: {
                                'Accept': 'text/plain,*/*',
                                'Accept-Language': 'en-US,en;q=0.9'
                            }
                        });
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return { success: true, text: await res.text() };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                }, url);

                if (result.success) {
                    return result.text;
                } else {
                    throw new Error(result.error);
                }
            } catch (e) {
                console.error('[runner] __FETCH_PROXY error:', e.message);
                throw e;
            }
        });

        // ============================================
        // STEALTH EVASIONS
        // ============================================
        await page.evaluateOnNewDocument(() => {
            // Hide webdriver property
            Object.defineProperty(navigator, 'webdriver', { 
                get: () => undefined 
            });
            
            // Fake chrome object
            window.chrome = { 
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // Fake plugins
            Object.defineProperty(navigator, 'plugins', { 
                get: () => [1, 2, 3, 4, 5] 
            });
            
            // Fake languages
            Object.defineProperty(navigator, 'languages', { 
                get: () => ['en-US', 'en'] 
            });
            
            // Override permissions query
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);
        });

        // ============================================
        // SET COOKIES
        // ============================================
        if (Array.isArray(account.cookies) && account.cookies.length) {
            const normalized = account.cookies.map(normalizeCookieForPuppeteer);
            await page.setCookie(...normalized);
            console.log(`[runner] 🍪 Set ${normalized.length} cookies`);
        }

        // ============================================
        // EVENT LISTENERS
        // ============================================
        
        // Console logging
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            const prefix = `[page:${account.name}]`;
            
            if (type === 'error') {
                console.error(`${prefix} ❌`, text);
            } else if (text.includes('Step1') || text.includes('Step2')) {
                console.log(`${prefix} 📜`, text);
            } else {
                console.log(`${prefix}`, text);
            }
            touch();
        });

        // Page errors
        page.on('pageerror', err => {
            console.error(`[page:${account.name}] 💥 PAGE ERROR:`, err.message);
            touch();
        });

        // Failed requests
        page.on('requestfailed', req => {
            console.error(`[page:${account.name}] 🌐 REQUEST FAILED:`, req.url());
            touch();
        });

        // ============================================
        // NAVIGATION HANDLER - INJECT SCRIPTS
        // ============================================
        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                const url = frame.url();
                console.log(`\n[page:${account.name}] 📍 Navigated to:`, url);
                touch();
                
                // Small delay for page to settle
                await sleep(500);
                
                // Inject appropriate scripts
                await injectScriptsForUrl(url);
            }
        });
    }

    // ============================================
    // SCRIPT INJECTION LOGIC
    // ============================================
    async function injectScriptsForUrl(url) {
        // Always inject auto_reload first
        if (autoReloadScript) {
            try {
                await page.addScriptTag({ content: autoReloadScript });
            } catch (e) {
                console.error('[runner] Failed to inject auto_reload:', e.message);
            }
        }

        const isThreadsPage = /https:\/\/craxpro\.to\/threads\//.test(url);
        const isPostThreadPage = url.includes("craxpro.to/forums/") && url.includes("post-thread");
        const isHomePage = url === "https://craxpro.to" || url === "https://craxpro.to/";

        // ============================================
        // INJECTION LOGIC:
        // - Threads page → Step2 (Like & Redirect)
        // - Other pages (NOT post-thread) → Step1 (Fetch & Redirect)
        // ============================================
        
        if (isThreadsPage) {
            // STEP 2: On threads page → Like and redirect to home
            console.log('[runner] 🎯 Page type: THREAD → Injecting Step2 (Like & Redirect)');
            
            if (step2Script) {
                try {
                    await sleep(1000);  // Wait for page to load
                    await page.addScriptTag({ content: step2Script });
                    console.log('[runner] ✅ Step2 injected successfully');
                    lastInjectedUrl = url;
                    cycleCount++;
                    console.log(`[runner] 🔄 Cycle count: ${cycleCount}`);
                } catch (e) {
                    console.error('[runner] ❌ Failed to inject Step2:', e.message);
                }
            }
        } else if (!isPostThreadPage) {
            // STEP 1: On other pages → Fetch link from Firebase & Redirect
            console.log('[runner] 🎯 Page type: GENERAL → Injecting Step1 (Fetch & Redirect)');
            
            if (step1Script) {
                try {
                    await sleep(1000);
                    await page.addScriptTag({ content: step1Script });
                    console.log('[runner] ✅ Step1 injected successfully');
                    lastInjectedUrl = url;
                } catch (e) {
                    console.error('[runner] ❌ Failed to inject Step1:', e.message);
                }
            }
        } else {
            console.log('[runner] 🎯 Page type: POST-THREAD → No script injected');
        }
    }

    // ============================================
    // INITIAL NAVIGATION
    // ============================================
    async function initialNavigation() {
        // Start at homepage (or custom startUrl)
        const startUrl = account.startUrl || "https://craxpro.to";
        console.log('[runner] 🌐 Navigating to:', startUrl);

        await page.goto(startUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        console.log('[runner] ✅ Initial page loaded');
    }

    // ============================================
    // WATCHDOG - Auto restart if idle
    // ============================================
    const watchdog = setInterval(async () => {
        const idle = Date.now() - lastActivity;
        if (idle > IDLE_TIMEOUT_MS) {
            restartCount++;
            console.log(`[watchdog] ⚠️ Idle for ${Math.floor(idle/1000)}s, restarting... (${restartCount}/${MAX_RESTARTS_PER_ACCOUNT})`);
            
            try {
                await page.reload({ waitUntil: 'networkidle2' });
            } catch (e) {
                console.error('[watchdog] ❌ Reload failed:', e.message);
            }
            touch();

            if (restartCount >= MAX_RESTARTS_PER_ACCOUNT) {
                console.log('[watchdog] 🛑 Max restarts reached, stopping watchdog');
                clearInterval(watchdog);
            }
        }
    }, WATCHDOG_INTERVAL_MS);

    // ============================================
    // HEARTBEAT - Keep connection alive
    // ============================================
    const heartbeat = setInterval(async () => {
        if (page && !page.isClosed()) {
            try {
                await page.evaluate(() => document.title);
                touch();
            } catch (e) {
                console.error('[heartbeat] ❌ Error:', e.message);
            }
        }
    }, HEARTBEAT_MS);

    // ============================================
    // MAIN EXECUTION
    // ============================================
    try {
        await openPage();
        await initialNavigation();

        const startTime = Date.now();
        console.log('\n[runner] ⏱️ Running for 60 minutes...');
        console.log('[runner] 📊 Waiting for scripts to execute...\n');

        while (Date.now() - startTime < ONE_HOUR_MS) {
            const elapsed = Math.floor((Date.now() - startTime) / 60000);
            const remaining = 60 - elapsed;
            
            console.log(`\n[runner] ⏰ Status: ${elapsed}min elapsed | ${remaining}min remaining`);
            console.log(`[runner] 🔄 Cycles completed: ${cycleCount}`);
            console.log(`[runner] 🔗 Last URL: ${lastInjectedUrl || 'none'}`);
            
            await sleep(60000);  // Log every minute
        }

    } catch (e) {
        console.error('[runner] 💥 FATAL ERROR:', e.message);
    } finally {
        clearInterval(watchdog);
        clearInterval(heartbeat);
        
        try {
            await page.close();
        } catch (e) {}
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🏁 END ACCOUNT: ${account.name}`);
        console.log(`📊 Total cycles: ${cycleCount}`);
        console.log(`${'='.repeat(50)}\n`);
    }
}

// ============================================
// MAIN ENTRY POINT
// ============================================
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 MULTI-ACCOUNT BOT v2.0');
    console.log('📋 Flow: Fetch Link → Like Post → Repeat');
    console.log('='.repeat(60) + '\n');

    // Load accounts configuration
    let accounts;
    
    if (process.env.ACCOUNTS_JSON) {
        console.log('[runner] 📂 Loading accounts from ACCOUNTS_JSON env var');
        accounts = JSON.parse(process.env.ACCOUNTS_JSON);
    } else if (fs.existsSync('./accounts.json')) {
        console.log('[runner] 📂 Loading accounts from accounts.json');
        accounts = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    } else {
        console.error('[runner] ❌ ACCOUNTS_JSON missing and accounts.json not found');
        process.exit(1);
    }

    console.log(`[runner] 👥 Starting with ${accounts.length} account(s)\n`);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote'
        ]
    });

    // Run each account
    for (const account of accounts) {
        await runAccount(browser, account);
    }

    await browser.close();
    console.log('\n[runner] ✅ All accounts completed.');
}

// Start
main().catch(e => {
    console.error('[runner] 💥 FATAL ERROR:', e);
    process.exit(1);
});
