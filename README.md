# drafty

## Installation
### Desktop extension
1. Open `chrome://extensions` (Brave: `brave://extensions`).
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select `drafty/extension`.

### Rewrite server (local)
1. `cd rewrite-server`
2. `npm install`
3. `node server.js`

### iOS keyboard
1. Open `DraftyKeyboard/DraftyKeyboard.xcodeproj` in Xcode.
2. Set your signing team and bundle IDs.
3. Run on device or simulator.
4. On iOS: Settings → General → Keyboard → Keyboards → Add New Keyboard → DraftyKeyboard.
5. Enable Full Access for network calls.

## How to Use

- **Desktop**: Select text → click `Enhance` (rewrite) or `Extract` (summarize).
- **iOS**: Open keyboard → tap `Enhance` to rewrite selected text or current sentence.

## Features

- **Desktop browser extension**: Full experience (Enhance + Extract).
- **iOS keyboard**: Enhance only.
  
> Note: Extract is not supported on mobile because iOS keyboard extensions have limited screen real estate for displaying summaries.
strict UI and data-access limits, and cannot read large document content
for summaries without breaking the typing flow.
