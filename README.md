# Drafty - AI Writer & Digest

Drafty is an intelligent Chrome extension that enhances your writing and extracts key insights from any webpage instantly.

## Key Features

### Enhance (AI Writer)
Select text in any input field (email, chat, docs) and click **Enhance** to rewrite it.
- **5 Tones**: Neutral, Professional, Casual, Witty, Concise.
- **Context-Aware**: Improves grammar, clarity, and flow based on the content.

### Extract (AI Summarizer)
Select any text on a webpage and click **Extract** to get a concise summary.
- **Bullet Points**: Breaks down complex information into easy-to-read points.
- **Floating Card**: Draggable, non-intrusive UI.
- **Tools**: Copy to clipboard, adjust font size, and retry on failure.

### Customizable UI
- **Dark Mode**: Automatically adapts to your system theme.
- **Settings Popup**: Choose your preferred tone directly from the toolbar.

---

## Installation

### Chrome Extension (Developer Mode)
1. Clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `extension` folder from this repository.

### iOS Keyboard (Beta)
The iOS app provides a custom keyboard for on-the-go rewriting.
1. Open `DraftyKeyboard/DraftyKeyboard.xcodeproj` in Xcode.
2. Sign the project with your Apple ID.
3. Run on a simulator or device.
4. Enable "Full Access" in Settings to allow API communication.

---

## Server Setup (Optional)

The extension is configured to use our production server (`https://drafty-ssa4.onrender.com`) by default.
If you want to run the backend locally:

1. Navigate to the server directory:
   ```bash
   cd rewrite-server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   PORT=8080
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Update `extension/content.js`:
   Change `API_BASE_URL` to `http://localhost:8080`.

---

## Tech Stack

- **Frontend**: Chrome Extension Manifest V3, Vanilla JS, HTML5, CSS3.
- **Backend**: Node.js, Express, OpenAI API (GPT-4o / GPT-3.5-turbo).
- **Deployment**: Render (Web Service).

## Privacy

Drafty processes text securely via HTTPS and does not store user data. The text is sent to the AI server solely for processing and is discarded immediately after the response is generated.
