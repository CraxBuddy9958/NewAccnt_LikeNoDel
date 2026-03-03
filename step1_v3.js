// step1_v3.js - FAST VERSION with Optional Link Removal
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

    console.log('[Step1] 🚀 Fetching link...');
    console.log(`[Step1] ⚙️ REMOVE_LINKS = ${REMOVE_LINKS}`);

    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";

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

    setTimeout(fetchAndRedirect, 500);
})();
