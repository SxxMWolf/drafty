# Walkthrough - Feature Updates

I have implemented several improvements to content format, UI, and functionality.

## Core Features

### Tone & Style Settings
- **Popup UI**: Users can now select their preferred writing tone from the extension popup.
- **Options**: `Neutral`, `Professional`, `Casual`, `Witty`, `Concise`.
- **Persistence**: Tone selection is saved in `chrome.storage.sync` and applied to all future requests.

### Extract Card Enhancements
- **Dark Mode**: The card automatically adapts to system dark mode settings.
- **Font Size Control**: Added `+` and `-` buttons to adjust text size for better readability.
- **Retry Logic**: A "Retry" button appears if the API request fails.
- **Improved Layout**: Cleaner header with Flexbox alignment.

## Server Updates (rewrite-server)

### [rewrite-server/server.js](file:///Users/sxxm/Documents/GitHub/drafty/rewrite-server/server.js)
-   **Prompt Engineering**: Updated prompts to respect the selected `tone`.
-   **Digest Format**: Modified to provide a summary sentence followed by **3-5 bullet points**.
-   **Token Limit**: Increased `maxTokens` to **450** for comprehensive summaries.

## Extension Updates (extension/content.js)

### [extension/content.js](file:///Users/sxxm/Documents/GitHub/drafty/extension/content.js)
-   **Robustness**: Added safety checks for `chrome.storage` permissions.
-   **Bug Fixes**: Resolved issues with button visibility and race conditions.
-   **Cleanup**: UI elements are properly removed and re-initialized on reload.

## Verification

### Automated Checks
-   **Manifest V3**: Confirmed compliance with `manifest_version: 3`.
-   **Permissions**: Justified `storage` and `host_permissions` usage.

### Manual Testing
-   **Tone Selection**: Confirmed changes in tone affect the AI output.
-   **Dark Mode**: Verified card appearance changes with system settings.
-   **Error Handling**: Simulated network failure to test Retry button visibility.
