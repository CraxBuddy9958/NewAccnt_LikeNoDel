// userscripts/auto_reload_v2.js - Auto Reload / Keep-Alive Mechanism
(function() {
    'use strict';

    // Prevent multiple executions
    if (window.__autoReloadRunning) {
        return;
    }
    window.__autoReloadRunning = true;

    console.log('[AutoReload] Keep-alive mechanism initialized');

    // Configuration
    const CHECK_INTERVAL = 60000;  // Check every 1 minute
    const MAX_IDLE_TIME = 5 * 60 * 1000;  // Max 5 minutes idle

    let lastActivity = Date.now();

    // Track user activity
    ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, () => {
            lastActivity = Date.now();
        }, { passive: true });
    });

    // Periodic check
    setInterval(() => {
        const idleTime = Date.now() - lastActivity;
        const idleMinutes = Math.floor(idleTime / 60000);
        
        console.log(`[AutoReload] Idle time: ${idleMinutes} minutes`);

        // If page seems stuck (idle for too long), try to recover
        if (idleTime > MAX_IDLE_TIME) {
            console.log('[AutoReload] Page seems stuck, attempting recovery…');
            
            // Try to ping the page
            try {
                const title = document.title;
                console.log('[AutoReload] Page title:', title);
                lastActivity = Date.now();
            } catch (e) {
                console.error('[AutoReload] Page unresponsive:', e);
            }
        }
    }, CHECK_INTERVAL);

    console.log('[AutoReload] Keep-alive active');

})();
