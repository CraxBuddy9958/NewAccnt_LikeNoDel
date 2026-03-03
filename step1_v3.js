// step1_v3.js - FAST + DELETE + FULL LINK LOG
(function() {
    'use strict';

    if (window.__step1Running) return;
    window.__step1Running = true;

    console.log('[Step1] 🚀 Fetching & deleting...');

    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";

    async function fetchDeleteRedirect() {
        try {
            const response = await fetch(DB_URL, { cache: 'no-cache' });
            if (!response.ok) {
                console.error('[Step1] ❌ Fetch failed');
                return;
            }

            const data = await response.json();
            let firstKey = null;
            let firstLink = null;

            if (typeof data === 'string') {
                const links = data.trim().split(/\s+/).filter(l => l.startsWith('http'));
                firstLink = links[0];
                if (links.length > 1) {
                    const remaining = links.slice(1).join('\n');
                    await fetch(DB_URL, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'text/plain' },
                        body: remaining
                    });
                    console.log('[Step1] 🗑️ Deleted from DB');
                }
            } else if (Array.isArray(data)) {
                firstLink = data.find(l => l && l.startsWith('http'));
                const idx = data.indexOf(firstLink);
                if (idx > -1) {
                    data.splice(idx, 1);
                    await fetch(DB_URL, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    console.log('[Step1] 🗑️ Deleted from DB');
                }
            } else if (data && typeof data === 'object') {
                const keys = Object.keys(data);
                for (const key of keys) {
                    const val = data[key];
                    if (typeof val === 'string' && val.startsWith('http')) {
                        firstKey = key;
                        firstLink = val;
                        break;
                    } else if (val && val.url) {
                        firstKey = key;
                        firstLink = val.url;
                        break;
                    }
                }
                
                if (firstKey) {
                    const deleteUrl = `https://craxlinks-bb690-default-rtdb.firebaseio.com/links/${firstKey}.json`;
                    await fetch(deleteUrl, { method: 'DELETE' });
                    console.log('[Step1] 🗑️ Deleted from DB');
                }
            }

            if (!firstLink) {
                console.log('[Step1] ⚠️ No links found');
                return;
            }

            // FULL LINK SHOWN HERE
            console.log('[Step1] ✅ FOUND:', firstLink);

            setTimeout(() => {
                console.log('[Step1] → Redirecting...');
                window.location.href = firstLink;
            }, 1000);

        } catch (error) {
            console.error('[Step1] 💥 Error:', error.message);
        }
    }

    setTimeout(fetchDeleteRedirect, 500);
})();
