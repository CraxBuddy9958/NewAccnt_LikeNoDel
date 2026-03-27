// step1_v3.js - FAST VERSION with Optional Link Removal + Smart IP Detection
// ============================================
// CONFIGURATION - Set REMOVE_LINKS to true/false
// ============================================
const REMOVE_LINKS = true;  // <-- SET TO true TO REMOVE LINKS FROM FIREBASE
                            // <-- SET TO false TO KEEP LINKS IN FIREBASE

// ============================================
(function() {
    'use strict';

    if (window.__step1Running) return;
    window.__step1Running = true;

    console.log('[Step1] 🚀 Starting...');
    console.log(`[Step1] ⚙️ REMOVE_LINKS = ${REMOVE_LINKS}`);
    console.log(`[Step1] 📍 Current URL: ${window.location.href}`);

    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";
    const FAKE_PAGE_TIMEOUT = 30000; // 30 seconds max wait for fake page to redirect

    // ============================================
    // CHECK FOR FAKE DNSPROXY PAGE
    // These elements are UNIQUE to the fake page
    // ============================================
    function isFakeDNSProxyPage() {
        // Check 1: Look for DNSPROXY ANTIBOT header (most reliable)
        const allH1 = document.querySelectorAll('h1');
        for (const h1 of allH1) {
            if (h1.textContent && h1.textContent.toUpperCase().includes('DNSPROXY')) {
                console.log('[Step1] 🔍 Found DNSPROXY in H1 - FAKE PAGE');
                return true;
            }
            if (h1.textContent && h1.textContent.toUpperCase().includes('ANTIBOT')) {
                console.log('[Step1] 🔍 Found ANTIBOT in H1 - FAKE PAGE');
                return true;
            }
        }

        // Check 2: Look for verification-card class
        const verificationCard = document.querySelector('.verification-card');
        if (verificationCard) {
            console.log('[Step1] 🔍 Found .verification-card - FAKE PAGE');
            return true;
        }

        // Check 3: Look for "DNSProxy" branding
        const pageText = document.body ? document.body.innerText : '';
        if (pageText.includes('DNSProxy') || pageText.includes('dnsproxy')) {
            console.log('[Step1] 🔍 Found DNSProxy in page text - FAKE PAGE');
            return true;
        }

        // Check 4: Look for specific combination of elements
        // Fake page has: .container > .verification-card > .info-row > #ip
        const hasContainer = document.querySelector('.container');
        const hasInfoRow = document.querySelector('.info-row');
        const hasIP = document.querySelector('#ip');
        const hasProgressBar = document.querySelector('.progress-bar-fill, .progress-bar-track');
        const hasSecureBadge = document.querySelector('.secure-badge');
        
        // If it has container + verification card style layout + IP = likely fake page
        if (hasContainer && hasIP && (hasInfoRow || hasProgressBar || hasSecureBadge)) {
            console.log('[Step1] 🔍 Found container + IP + info elements - FAKE PAGE');
            return true;
        }

        // Check 5: Look for "Verification complete! Redirecting..." text
        if (pageText.includes('Verification complete') || pageText.includes('Redirecting...')) {
            // Make sure it's not the real page with this text in a different context
            const footer = document.querySelector('.footer');
            if (footer && footer.textContent.includes('Redirecting')) {
                console.log('[Step1] 🔍 Found "Verification complete" + "Redirecting" - FAKE PAGE');
                return true;
            }
        }

        // Check 6: Look for abuse@dnsproxy.org link
        const links = document.querySelectorAll('a');
        for (const link of links) {
            if (link.href && link.href.includes('dnsproxy.org')) {
                console.log('[Step1] 🔍 Found dnsproxy.org link - FAKE PAGE');
                return true;
            }
        }

        return false;
    }

    // ============================================
    // EXTRACT IP FROM FAKE PAGE
    // ============================================
    function extractIPFromFakePage() {
        // Method 1: Direct #ip element
        const ipEl = document.querySelector('#ip');
        if (ipEl && ipEl.textContent) {
            const ip = ipEl.textContent.trim();
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                return ip;
            }
        }

        // Method 2: Find by label "IP Address"
        const infoRows = document.querySelectorAll('.info-row');
        for (const row of infoRows) {
            const label = row.querySelector('.info-label');
            if (label && label.textContent.toLowerCase().includes('ip address')) {
                const valueEl = row.querySelector('.info-value, #ip');
                if (valueEl) {
                    const ip = valueEl.textContent.trim();
                    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                        return ip;
                    }
                }
            }
        }

        // Method 3: Any .info-value that looks like IP
        const infoValues = document.querySelectorAll('.info-value');
        for (const el of infoValues) {
            const text = el.textContent.trim();
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(text)) {
                return text;
            }
        }

        return null;
    }

    // ============================================
    // HANDLE FAKE PAGE - Extract IP and Wait for Redirect
    // ============================================
    async function handleFakePage() {
        console.log('[Step1] ⚠️ FAKE DNSPROXY PAGE DETECTED!');
        
        // Extract IP
        const ip = extractIPFromFakePage();
        if (ip) {
            console.log('[Step1] 🌐 Scraped IP from fake page:', ip);
            
            // Store IP in sessionStorage for later use
            try {
                const scrapedIPs = JSON.parse(sessionStorage.getItem('__scrapedIPs') || '[]');
                scrapedIPs.push({
                    ip: ip,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                });
                sessionStorage.setItem('__scrapedIPs', JSON.stringify(scrapedIPs));
                console.log('[Step1] 💾 IP saved to sessionStorage');
            } catch (e) {
                console.log('[Step1] ⚠️ Could not save IP:', e.message);
            }

            // Try to pass IP to Puppeteer if available
            if (typeof window.__IP_DETECTED === 'function') {
                try {
                    window.__IP_DETECTED(ip, window.location.href);
                    console.log('[Step1] 📤 IP sent to Puppeteer');
                } catch (e) {}
            }
        }

        // Wait for the page to auto-redirect
        console.log('[Step1] 🔄 Waiting for fake page to auto-redirect...');
        console.log('[Step1] ⏳ Will wait up to 30 seconds for redirect...');
        
        await new Promise(resolve => setTimeout(resolve, FAKE_PAGE_TIMEOUT));
        
        console.log('[Step1] ⏰ Wait complete');
        return true;
    }

    // ============================================
    // STORAGE HELPERS
    // ============================================
    function getUsedLinks() {
        try {
            return JSON.parse(sessionStorage.getItem('__usedLinks') || '[]');
        } catch (e) { return []; }
    }

    function saveUsedLink(link) {
        try {
            const used = getUsedLinks();
            used.push(link);
            sessionStorage.setItem('__usedLinks', JSON.stringify(used));
        } catch (e) {}
    }

    // ============================================
    // REMOVE LINK FROM FIREBASE
    // ============================================
    async function removeLinkFromFirebase(linkToRemove, allLinks) {
        try {
            // Filter out the link we're using
            const remainingLinks = allLinks.filter(link => link !== linkToRemove);
            
            // Format as space-separated string (same format as original)
            const newContent = remainingLinks.join(' ');
            
            // Update Firebase with PUT request
            const response = await fetch(DB_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newContent)
            });
            
            if (response.ok) {
                console.log(`[Step1] 🗑️ Removed from Firebase: ${linkToRemove.substring(0, 50)}...`);
                console.log(`[Step1] 📊 Remaining links: ${remainingLinks.length}`);
            } else {
                console.log(`[Step1] ⚠️ Failed to remove from Firebase: ${response.status}`);
            }
        } catch (e) {
            console.log(`[Step1] 💥 Remove error: ${e.message}`);
        }
    }

    // ============================================
    // MAIN FETCH AND REDIRECT
    // ============================================
    async function fetchAndRedirect() {
        try {
            // ============================================
            // FIRST: Check if this is a fake DNSPROXY page
            // ============================================
            if (isFakeDNSProxyPage()) {
                const handled = await handleFakePage();
                if (handled) {
                    console.log('[Step1] 🛑 Fake page handled, STOPPING - waiting for page refresh');
                    window.__step1Running = false;
                    return;
                }
            }

            // ============================================
            // We're on a REAL page - proceed with fetch/redirect
            // ============================================
            console.log('[Step1] ✅ REAL page confirmed - proceeding with fetch...');
            
            const response = await fetch(DB_URL, { cache: 'no-cache' });
            if (!response.ok) { console.log('[Step1] ❌ Fetch failed'); return; }

            const data = await response.text();
            let links = [];

            try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') links = parsed.trim().split(/\s+/);
                else if (Array.isArray(parsed)) links = parsed;
                else if (parsed && typeof parsed === 'object') {
                    links = Object.keys(parsed).map(k => {
                        const v = parsed[k];
                        return typeof v === 'string' && v.startsWith('http') ? v : null;
                    }).filter(l => l);
                }
            } catch (e) {
                links = data.trim().split(/\s+/);
            }

            // Clean up links (remove empty strings)
            links = links.filter(l => l && l.startsWith('http'));

            if (!links.length) { 
                console.log('[Step1] ⚠️ No links'); 
                return; 
            }

            console.log(`[Step1] 📊 Total links in DB: ${links.length}`);

            const usedLinks = getUsedLinks();
            let targetLink = null;

            for (const link of links) {
                if (link && !usedLinks.includes(link)) {
                    targetLink = link;
                    break;
                }
            }

            if (!targetLink) {
                console.log('[Step1] ⚠️ All used, clearing session...');
                sessionStorage.removeItem('__usedLinks');
                return;
            }

            console.log(`[Step1] ✅ Found: ${targetLink}`);
            
            // Save to session storage (backup tracking)
            saveUsedLink(targetLink);

            // ============================================
            // REMOVE FROM FIREBASE IF ENABLED
            // ============================================
            if (REMOVE_LINKS) {
                console.log('[Step1] 🗑️ Removing link from Firebase...');
                await removeLinkFromFirebase(targetLink, links);
            } else {
                console.log('[Step1] ⏭️ Keeping link in Firebase (REMOVE_LINKS = false)');
            }

            // FAST REDIRECT - only 1 second
            setTimeout(() => {
                console.log('[Step1] → Redirecting now!');
                window.location.href = targetLink;
            }, 1000);

        } catch (e) {
            console.log('[Step1] 💥', e.message);
        }
    }

    // Start after a small delay
    setTimeout(fetchAndRedirect, 500);
})();
