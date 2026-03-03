// step2_v3.js - FAST VERSION
(function() {
    'use strict';

    if (!/https:\/\/craxpro\.to\/threads\//.test(window.location.href)) return;
    if (window.__step2Running) return;
    window.__step2Running = true;

    console.log('[Step2] 🚀 Looking for like button...');

    const LIKE_SELECTOR = 'a.reaction[data-reaction-id="1"]';
    let tries = 0;

    function clickLike() {
        const btn = document.querySelector(LIKE_SELECTOR);

        if (!btn) {
            tries++;
            if (tries < 10) {  // Reduced from 20
                setTimeout(clickLike, 300);  // Faster retry
            } else {
                console.log("[Step2] ❌ No button, redirecting...");
                window.location.href = "https://craxpro.to";
            }
            return;
        }

        console.log("[Step2] ✔ Found button!");
        
        if (!btn.classList.contains('is-active')) {
            btn.click();
            console.log("[Step2] 👍 LIKED!");
        } else {
            console.log("[Step2] ⏭️ Already liked");
        }

        // FAST REDIRECT - only 500ms
        setTimeout(() => {
            console.log("[Step2] → Next!");
            window.location.href = "https://craxpro.to";
        }, 500);
    }

    setTimeout(clickLike, 800);  // Faster start
})();
