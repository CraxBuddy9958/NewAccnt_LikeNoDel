// userscripts/step2_v3.js - Step 2: Auto Like + Final Redirect
(function() {
    'use strict';

    // Only run on thread pages (URLs like https://craxpro.to/threads/...)
    const THREADS_PATTERN = /https:\/\/craxpro\.to\/threads\//;
    if (!THREADS_PATTERN.test(window.location.href)) {
        console.log('[Step2] Skipping - not on threads page');
        return;
    }

    console.log('[Step2] Running on threads page:', window.location.href);

    // Prevent multiple executions
    if (window.__step2Running) {
        console.log('[Step2] Already running, skipping');
        return;
    }
    window.__step2Running = true;

    // ============================================
    // CONFIGURATION - Adjust these if needed
    // ============================================
    const LIKE_SELECTOR = 'a.reaction[data-reaction-id="1"]';  // Like button selector
    const MAX_RETRIES = 20;                                      // Max attempts to find like button
    const RETRY_DELAY = 500;                                     // Delay between retries (ms)
    const REDIRECT_DELAY = 1000;                                 // Delay before redirect (ms)

    let retryCount = 0;

    function clickLike() {
        const btn = document.querySelector(LIKE_SELECTOR);

        if (!btn) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
                console.log(`[Step2] ❌ Like button not found (attempt ${retryCount}/${MAX_RETRIES}), retrying…`);
                setTimeout(clickLike, RETRY_DELAY);
            } else {
                console.log("[Step2] ❌ Like button not found after max retries.");
                console.log("[Step2] Available reactions on page:");
                
                // Debug: Log all reaction buttons found
                const allReactions = document.querySelectorAll('a.reaction');
                allReactions.forEach((r, i) => {
                    console.log(`[Step2]   Reaction ${i}:`, r.getAttribute('data-reaction-id'), r);
                });
                
                console.log("[Step2] Redirecting anyway…");
                redirectToHome();
            }
            return;
        }

        console.log("[Step2] ✔ Like button found!");
        console.log("[Step2] Button element:", btn);
        
        // Check if already liked (optional - has 'is-active' or similar class)
        if (btn.classList.contains('is-active') || btn.classList.contains('active')) {
            console.log("[Step2] ⚠️ Post already liked, skipping click.");
        } else {
            try {
                btn.click();
                console.log("[Step2] 👍 Liked the post!");
            } catch (e) {
                console.error("[Step2] Error clicking like:", e);
            }
        }

        // Redirect after delay
        setTimeout(redirectToHome, REDIRECT_DELAY);
    }

    function redirectToHome() {
        console.log("[Step2] 🔄 Redirecting to craxpro.to homepage in 1 second…");
        setTimeout(() => {
            console.log("[Step2] → Redirecting now: https://craxpro.to");
            window.location.href = "https://craxpro.to";
        }, 1000);
    }

    // ============================================
    // START EXECUTION
    // ============================================
    console.log("[Step2] 🚀 Starting auto-like process…");
    console.log("[Step2] Looking for selector:", LIKE_SELECTOR);
    
    // Run after small delay for page to fully load
    setTimeout(clickLike, 1500);

})();
