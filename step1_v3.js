// step1_v3.js - FAST VERSION
(function() {
    'use strict';

    if (window.__step1Running) return;
    window.__step1Running = true;

    console.log('[Step1] 🚀 Fetching link...');

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

            if (!links.length) { console.log('[Step1] ⚠️ No links'); return; }

            const usedLinks = getUsedLinks();
            let targetLink = null;

            for (const link of links) {
                if (link && !usedLinks.includes(link)) {
                    targetLink = link;
                    break;
                }
            }

            if (!targetLink) {
                console.log('[Step1] ⚠️ All used, clearing...');
                sessionStorage.removeItem('__usedLinks');
                return;
            }

            console.log(`[Step1] ✅ ${targetLink}`);
            saveUsedLink(targetLink);

            // FAST REDIRECT - only 1 second
            setTimeout(() => {
                console.log('[Step1] → Go!');
                window.location.href = targetLink;
            }, 1000);

        } catch (e) {
            console.log('[Step1] 💥', e.message);
        }
    }

    setTimeout(fetchAndRedirect, 500);
})();
