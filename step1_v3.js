// userscripts/step1_V3.js - Step 1: Fetch Link from Firebase & Redirect (NO deletion)
(function() {
    'use strict';

    // Prevent multiple executions
    if (window.__step1Running) {
        console.log('[Step1] Already running, skipping');
        return;
    }
    window.__step1Running = true;

    console.log('[Step1] 🚀 Starting fetch & redirect process...');

    // ============================================
    // CONFIGURATION
    // ============================================
    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";
    const REDIRECT_DELAY = 3000;  // 3 seconds before redirect

    // Store used links in sessionStorage to avoid repeats in same session
    function getUsedLinks() {
        try {
            const stored = sessionStorage.getItem('__usedLinks');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function saveUsedLink(link) {
        try {
            const used = getUsedLinks();
            used.push(link);
            sessionStorage.setItem('__usedLinks', JSON.stringify(used));
        } catch (e) {
            console.error('[Step1] Error saving used link:', e);
        }
    }

    // ============================================
    // FETCH LINK FROM FIREBASE (NO DELETION)
    // ============================================
    async function fetchAndRedirect() {
        try {
            console.log('[Step1] 📡 Fetching links from Firebase...');

            const response = await fetch(DB_URL, {
                cache: 'no-cache',
                headers: {
                    'Accept': 'text/plain,*/*'
                }
            });

            if (!response.ok) {
                console.error('[Step1] ❌ Failed to fetch DB. Status:', response.status);
                return;
            }

            const data = await response.text();
            console.log('[Step1] 📥 Raw data received');

            // Parse data - handle both string and JSON formats
            let links = [];
            try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') {
                    links = parsed.trim().split(/\s+/);
                } else if (Array.isArray(parsed)) {
                    links = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    // Handle object format {link1: url1, link2: url2}
                    links = Object.keys(parsed).map(key => {
                        if (typeof parsed[key] === 'string' && parsed[key].startsWith('http')) {
                            return parsed[key];
                        }
                        return null;
                    }).filter(link => link !== null);
                }
            } catch (e) {
                // If not JSON, treat as whitespace-separated string
                links = data.trim().split(/\s+/);
            }

            if (!links || links.length === 0) {
                console.log('[Step1] ⚠️ No links found in DB');
                return;
            }

            console.log(`[Step1] 📋 Found ${links.length} total links`);

            // Get used links from this session
            const usedLinks = getUsedLinks();
            console.log(`[Step1] 📝 ${usedLinks.length} links already used this session`);

            // Find first unused link
            let targetLink = null;
            for (const link of links) {
                if (!link || usedLinks.includes(link)) {
                    continue;
                }
                targetLink = link;
                break;
            }

            if (!targetLink) {
                console.log('[Step1] ⚠️ All links already used this session');
                console.log('[Step1] ℹ️ Clearing session history for fresh start...');
                sessionStorage.removeItem('__usedLinks');
                return;
            }

            console.log(`[Step1] ✅ Found target link: ${targetLink}`);

            // Mark as used locally (NOT in Firebase)
            saveUsedLink(targetLink);
            console.log('[Step1] 📝 Link marked as used (local session only)');

            // ============================================
            // REDIRECT TO LINK (NO Firebase deletion)
            // ============================================
            console.log(`[Step1] ⏳ Redirecting in ${REDIRECT_DELAY/1000} seconds...`);
            
            setTimeout(() => {
                console.log(`[Step1] → Redirecting to: ${targetLink}`);
                window.location.href = targetLink;
            }, REDIRECT_DELAY);

        } catch (error) {
            console.error('[Step1] 💥 Error:', error.message);
        }
    }

    // ============================================
    // START EXECUTION
    // ============================================
    setTimeout(fetchAndRedirect, 1000);

})();
