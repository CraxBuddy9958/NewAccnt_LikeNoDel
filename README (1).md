# Multi-Account Bot v2.0

## 📋 Overview

This bot automates the following flow:

```
┌─────────────────────────────────────────────────────────────┐
│                  Start: https://craxpro.to                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: Fetch Link from Firebase                │
│  • Runs on: Homepage & general pages (NOT threads)           │
│  • Action: Fetch first link from Firebase DB                 │
│  • Action: Remove that link from DB                          │
│  • Action: Redirect to that link after 3 seconds             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: On Thread Page (threads/*)              │
│  • Runs on: Thread pages only                                │
│  • Action: Find and click the like button                    │
│  • Action: Redirect to homepage after 1 second               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    [Loop back to Step 1]
```

## 🔄 How It Works

### The Cycle:

1. **Bot starts** at `craxpro.to` homepage
2. **Step 1 triggers** (because we're on homepage, not a thread)
   - Fetches the first link from Firebase
   - Deletes that link from Firebase (so it's not used again)
   - Waits 3 seconds
   - Redirects to that link
3. **If the link is a thread page**, Step 2 triggers:
   - Finds the like button (`a.reaction[data-reaction-id="1"]`)
   - Clicks it
   - Waits 1 second
   - Redirects to `craxpro.to` homepage
4. **Loop repeats** - Step 1 runs again on homepage

### Timing:

| Action | Delay |
|--------|-------|
| Step 1: Wait before fetch | 1 second |
| Step 1: Wait before redirect | 3 seconds |
| Step 2: Wait for like button | Up to 10 seconds (retries) |
| Step 2: Wait before redirect | 1 second |

## 📁 File Structure

```
multi-account-bot-v2/
├── userscripts/
│   ├── step1_v3.js       # Fetch link & redirect
│   ├── step2_v3.js       # Like post & redirect
│   └── auto_reload_v2.js # Keep-alive mechanism
├── run.js                # Main bot execution
├── scheduler.js          # 25-hour cycle scheduler
├── package.json          # Dependencies
├── accounts.json.example # Account template
├── Procfile              # Heroku deployment
├── railway.toml          # Railway deployment
└── nixpacks.toml         # Build configuration
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Accounts

Copy the example file and add your cookies:

```bash
cp accounts.json.example accounts.json
```

Edit `accounts.json` with your actual cookies:

```json
[
  {
    "name": "MyAccount",
    "startUrl": "https://craxpro.to",
    "cookies": [
      {
        "name": "xf_user",
        "value": "your_actual_cookie_value",
        "domain": ".craxpro.to",
        "path": "/",
        "secure": true,
        "httpOnly": true
      }
    ]
  }
]
```

### 3. Configure Scheduler (Optional)

Edit `scheduler.js` to set your preferred launch time:

```javascript
const LAUNCH_HOUR_IST = 23;      // Hour (0-23)
const LAUNCH_MINUTE_IST = 36;    // Minute (0-59)
```

### 4. Run the Bot

**Run once (for testing):**
```bash
npm run bot
```

**Run with scheduler (production):**
```bash
npm start
```

## 🔧 Configuration

### Firebase Database

The bot uses this Firebase URL:
```
https://craxlinks-bb690-default-rtdb.firebaseio.com/links.json
```

Make sure this database contains thread links in space-separated format:
```
https://craxpro.to/threads/thread-1 https://craxpro.to/threads/thread-2 https://craxpro.to/threads/thread-3
```

### Like Button Selector

If the like button isn't being found, you may need to update the selector in `step2_v3.js`:

```javascript
const LIKE_SELECTOR = 'a.reaction[data-reaction-id="1"]';
```

## ☁️ Deployment

### Railway

1. Connect your GitHub repo to Railway
2. Set environment variables:
   - `ACCOUNTS_JSON` - JSON string of your accounts
3. Deploy

### Heroku

1. Create a new Heroku app
2. Push the code
3. Set the worker dyno:
   ```bash
   heroku ps:scale worker=1
   ```

## ⚠️ Troubleshooting

### "No links found in database"
- Check that your Firebase database has links
- Verify the URL is correct

### "Like button not found"
- The selector might have changed
- Check the browser console for available reactions
- Update `LIKE_SELECTOR` in `step2_v3.js`

### Bot keeps redirecting in loops
- This is normal! The flow is: Homepage → Thread → Homepage → Thread
- Each cycle likes one thread and removes one link from Firebase

## 📊 Monitoring

Check logs:
```bash
# Local
node run.js

# Railway/Heroku
# Check the logs in your dashboard
```

The bot logs:
- Navigation events
- Script injections
- Link fetches
- Like actions
- Cycle counts
