// step1_v3.js - FIXED DELETE (waits for completion)
(function() {
    'use strict';

    if (window.__step1Running) return;
    window.__step1Running = true;

    console.log('[Step1] 🚀 Fetching...');

    const DB_URL = "https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json";

    async function fetchDeleteRedirect() {
        try {
            // Step 1: Fetch all data
            const response = await fetch(DB_URL, { cache: 'no-cache' });
            if (!response.ok) {
                console.log('[Step1] ❌ Fetch failed');
                return;
            }

            const data = await response.json();
            
            if (!data) {
                console.log('[Step1] ⚠️ DB is empty');
                return;
            }

            let firstLink = null;
            let deletePromise = null;

            // Handle OBJECT format: {"-Nxabc": "link1", "-Nxdef": "link2", ...}
            if (typeof data === 'object' && !Array.isArray(data)) {
                const keys = Object.keys(data);
                console.log('[Step1] 📋 Format: Object, keys:', keys.length);
                
                if (keys.length === 0) {
                    console.log('[Step1] ⚠️ No keys found');
                    return;
                }

                const firstKey = keys[0];
                firstLink = data[firstKey];
                console.log('[Step1] 🔑 First key:', firstKey);

                if (firstLink && firstKey) {
                    // Delete this specific key
                    const deleteUrl = `https://craxlinks-bb690-default-rtdb.firebaseio.com/links/${encodeURIComponent(firstKey)}.json`;
                    console.log('[Step1] 🗑️ Deleting key:', firstKey);
                    
                    const delRes = await fetch(deleteUrl, { method: 'DELETE' });
                    if (delRes.ok) {
                        console.log('[Step1] ✅ DELETED from Firebase');
                    } else {
                        console.log('[Step1] ❌ Delete failed:', delRes.status);
                    }
                }
            }
            // Handle ARRAY format: ["link1", "link2", ...]
            else if (Array.isArray(data)) {
                console.log('[Step1] 📋 Format: Array, length:', data.length);
                
                if (data.length === 0) {
                    console.log('[Step1] ⚠️ Empty array');
                    return;
                }

                firstLink = data[0];
                
                // Remove first element and update
                const remaining = data.slice(1);
                const putRes = await fetch(DB_URL, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(remaining)
                });
                
                if (putRes.ok) {
                    console.log('[Step1] ✅ DELETED from Firebase');
                } else {
                    console.log('[Step1] ❌ Delete failed:', putRes.status);
                }
            }
            // Handle STRING format: "link1\nlink2\nlink3"
            else if (typeof data === 'string') {
                console.log('[Step1] 📋 Format: String');
                const links = data.trim().split(/\s+/).filter(l => l.startsWith('http'));
                
                if (links.length === 0) {
                    console.log('[Step1] ⚠️ No links in string');
                    return;
                }

                firstLink = links[0];
                
                if (links.length > 1) {
                    const remaining = links.slice(1).join('\n');
                    const putRes = await fetch(DB_URL, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'text/plain' },
                        body: remaining
                    });
                    
                    if (putRes.ok) {
                        console.log('[Step1] ✅ DELETED from Firebase');
                    } else {
                        console.log('[Step1] ❌ Delete failed:', putRes.status);
                    }
                }
            }

            if (!firstLink) {
                console.log('[Step1] ⚠️ No link found');
                return;
            }

            console.log('[Step1] ✅ LINK:', firstLink);

            // Redirect
            setTimeout(() => {
                console.log('[Step1] → Go!');
                window.location.href = firstLink;
            }, 1000);

        } catch (error) {
            console.log('[Step1] 💥 Error:', error.message);
        }
    }

    setTimeout(fetchDeleteRedirect, 500);
})();
