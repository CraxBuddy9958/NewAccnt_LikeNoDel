// step2_v3.js - FAST Like
(function() {
    'use strict';

    if (window.__step2Running) return;
    window.__step2Running = true;

    const LIKE_SELECTOR = 'a.reaction[data-reaction-id="1"]';
    let tries = 0;

    function clickLike() {
        const btn = document.querySelector(LIKE_SELECTOR);

        if (!btn) {
            tries++;
            if (tries < 10) {
                setTimeout(clickLike, 300);
            } else {
                console.log("[Step2] ❌ No button, next!");
                window.location.href = "https://craxpro.to";
            }
            return;
        }

        console.log("[Step2] ✔ Found!");
        
        if (!btn.classList.contains('is-active')) {
            btn.click();
            console.log("[Step2] 👍 LIKED!");
        } else {
            console.log("[Step2] ⏭️ Already liked");
        }

        setTimeout(() => {
            window.location.href = "https://craxpro.to";
        }, 500);
    }

    setTimeout(clickLike, 800);
})();
