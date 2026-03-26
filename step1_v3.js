// step1_v3.js - FAST VERSION with Optional Link Removal + IP Detection for Fake Pages
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

    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";

    // ============================================
    // IP ADDRESS DETECTION (For Fake Cloudflare Pages)
    // ============================================
    function detectIPAddress() {
        // Try multiple selectors to find the IP address element
        const selectors = [
            '#ip',
            '.info-value#ip',
            '.info-row #ip',
            'span[id="ip"]',
            '[id*="ip"]',
            '.ip-address',
            '#ip-address',
            'span.ip'
        ];

        for (const selector of selectors) {
            try {
                const el = document.querySelector(selector);
                if (el && el.textContent) {
                    const ip = el.textContent.trim();
                    // Validate IP format
                    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                        console.log('[Step1] 🌐 IP Address detected:', ip);
                        return ip;
                    }
                }
            } catch (e) {}
        }

        // Fallback: search by label text
        try {
            const infoRows = document.querySelectorAll('.info-row');
            for (const row of infoRows) {
                const label = row.querySelector('.info-label');
                if (label && label.textContent.toLowerCase().includes('ip address')) {
                    const valueEl = row.querySelector('.info-value, #ip');
                    if (valueEl) {
                        const ip = valueEl.textContent.trim();
                        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                            console.log('[Step1] 🌐 IP Address detected:', ip);
                            return ip;
                        }
                    }
                }
            }
        } catch (e) {}

        // Additional fallback: search entire page text for IP pattern
        try {
            const pageText = document.body.innerText || document.body.textContent || '';
            const ipMatch = pageText.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
            if (ipMatch && ipMatch[1]) {
                // Verify it's a valid IP (not 0.0.0.0 or similar)
                const parts = ipMatch[1].split('.').map(Number);
                if (parts.every(p => p >= 0 && p <= 255) && !(parts[0] === 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0)) {
                    console.log('[Step1] 🌐 IP found in page text:', ipMatch[1]);
                    return ipMatch[1];
                }
            }
        } catch (e) {}

        return null;
    }

    // ============================================
    // CHECK FOR FAKE CLOUDFLARE PAGE
    // ============================================
    function isFakeCloudflarePage() {
        // Check for common fake Cloudflare indicators
        const indicators = [
            // Check for IP display
            () => detectIPAddress() !== null,
            
            // Check for specific text patterns
            () => {
                const pageText = document.body.innerText.toLowerCase();
                return pageText.includes('checking your browser') ||
                       pageText.includes('please wait') ||
                       pageText.includes('cloudflare') ||
                       pageText.includes('ddos protection') ||
                       pageText.includes('security check');
            },
            
            // Check for specific elements
            () => {
                const cfElements = document.querySelectorAll('[class*="cloudflare"], [id*="cloudflare"], .challenge-form, #challenge-form');
                return cfElements.length > 0;
            },
            
            // Check for redirect meta tags
            () => {
                const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
                return metaRefresh !== null;
            }
        ];

        for (const check of indicators) {
            try {
                if (check()) {
                    return true;
                }
            } catch (e) {}
        }

        return false;
    }

    // ============================================
    // HANDLE FAKE PAGE - Extract IP and Wait/Reload
    // ============================================
    async function handleFakePage() {
        console.log('[Step1] ⚠️ Fake Cloudflare-type page detected!');
        
        const ip = detectIPAddress();
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

        // Wait for the page to potentially redirect itself
        console.log('[Step1] ⏳ Waiting for page to redirect or load...');
        
        // Check for form submission or auto-redirect
        const challengeForm = document.querySelector('form#challenge-form, form.challenge-form, input[type="submit"]');
        if (challengeForm) {
            console.log('[Step1] 📝 Found challenge form, attempting to submit...');
            try {
                // Try to submit the form
                const form = challengeForm.closest('form') || challengeForm;
                if (form && form.submit) {
                    form.submit();
                    return true;
                }
            } catch (e) {}
        }

        // Check for JavaScript redirect
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const content = script.textContent || '';
            if (content.includes('location.href') || content.includes('window.location') || content.includes('redirect')) {
                console.log('[Step1] 🔄 Found redirect script, waiting...');
                // Let the script handle the redirect
                return false;
            }
        }

        return false;
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
            // FIRST: Check if current page is a fake Cloudflare page
            if (isFakeCloudflarePage()) {
                const handled = await handleFakePage();
                if (handled) {
                    // Form was submitted, wait for redirect
                    return;
                }
                // Otherwise, continue with normal flow
            }

            // Check for IP on any page (even non-fake ones)
            const currentIP = detectIPAddress();
            if (currentIP) {
                console.log('[Step1] 🌐 Current page IP:', currentIP);
                // Store it
                try {
                    sessionStorage.setItem('__lastDetectedIP', currentIP);
                } catch (e) {}
            }

            // NOW: Fetch link from Firebase
            console.log('[Step1] 🚀 Fetching link...');
            
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
