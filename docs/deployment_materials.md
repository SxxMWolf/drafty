# Chrome Web Store Listing for Drafty

## Title
Drafty - AI Writer & Digest

## Summary (Max 132 chars)
Instantly enhance your writing and extract key info from any page. Choose your tone, summarize long text, and boost productivity.

## Single Purpose Description (Max 1000 chars)

Drafty's sole purpose is to improve your digital communication and information consumption through AI-powered text processing. It provides a non-intrusive, context-aware interface to rewrite selected text for clarity and tone, or summarize lengthy content into digestible key points. By integrating these capabilities directly into the browser, Drafty eliminates context switching, helping you write better emails and understand complex information faster.

## Permission Justifications (for Chrome Web Store)

### 1. Storage Permission Justification (Max 1000 chars)
**Reason**: To save user preferences for the "Tone" setting (e.g., Neutral, Professional, Casual).
**Explanation**: When a user selects a preferred writing tone from the extension popup, this setting is stored using `chrome.storage.sync` so that it persists across browser sessions and applies automatically to future "Enhance" requests. No personal data is stored.

### 2. Host Permission Justification (Max 1000 chars)
**Reason**: To display the floating action button on text selection and communicate with the AI processing server.
**Explanation**: 
1. **Content Script Injection (`<all_urls>`)**: The extension needs to inject a content script into every page to listen for text selection events. This allows the "Enhance" floating button to appear immediately near the user's cursor when they select text, providing a seamless user experience. It does not read page content until the user explicitly selects text and interacts with the button.
2. **Backend Communication (`https://drafty-ssa4.onrender.com/*`)**: The extension sends the *user-selected text only* to our secure backend server to perform the AI rewriting and summarization, as this processing cannot be done locally in the browser.

### 3. Remote Code Justification
**Answer**: No, I am not using remote code.

## Detailed Description (Max 16,000 chars)

**Elevate Your Web Experience with Drafty: Your Intelligent Writing & Reading Companion**

Drafty is the ultimate browser extension designed to seamlessly integrate advanced AI writing and summarization capabilities directly into your daily web browsing. Whether you're crafting an important email, posting on social media, or researching complex topics, Drafty empowers you to write better and read faster—without ever leaving your current tab.

### 🚀 Why Install Drafty?

Drafty isn't just another AI tool; it's a productivity booster that lives where you work. By eliminating the need to copy-paste text back and forth between ChatGPT and your browser, Drafty saves you time and keeps you in the flow. It’s perfect for professionals, students, content creators, and anyone who wants to communicate more effectively online.

### ✨ Key Features

#### 1. ✍️ **Smart Writing Enhancement (Enhance)**
Struggling to find the right words? Select any text in an input field or text area, click the floating **"✨ Enhance"** button, and watch Drafty transform your writing instantly.
*   **Context-Aware Rewriting**: Drafty understands the context and improves grammar, clarity, and flow.
*   **Customizable Tones**: Tailor your message to the perfect audience with 5 distinct styles:
    *   **Neutral (Default)**: Balanced and clear.
    *   **Professional**: Perfect for business emails and reports.
    *   **Casual**: Ideal for chats and social media.
    *   **Witty**: Add a touch of humor and personality.
    *   **Concise**: Shorten your text for maximum impact.
    *   *(Select your preferred tone easily from the extension popup menu!)*

#### 2. 🧠 **Instant Information Extraction (Extract)**
Overwhelmed by long articles or dense reports? Select any block of text on a webpage and use the **"Extract"** feature to get the gist in seconds.
*   **Bullet-Point Summaries**: Drafty condenses long paragraphs into easy-to-read bullet points.
*   **Floating Card UI**: The summary appears in a draggable, non-intrusive card right next to your selection.
*   **Quick Actions**:
    *   **One-Click Copy**: Copy the summary to your clipboard instantly.
    *   **Font Size Control**: Adjust text size (`-` / `+`) for comfortable reading.
    *   **Retry Logic**: Network issues? Retry with a single click.

#### 3. 🌙 **Seamless & Native Design**
Drafty is built to feel like a natural part of your browser, not a clunky add-on.
*   **Dark Mode Support**: Automatically detects your system's theme (Light/Dark) and adjusts the interface for eye comfort.
*   **Unobtrusive Interface**: The floating button only appears when you select text and disappears when you don't need it.
*   **Privacy-First**: Drafty processes text securely and does not store your data. Your privacy is our priority.

### 🎯 Use Cases

*   **For Professionals**: Polish your emails to sound more authoritative or summarize lengthy industry news.
*   **For Students**: Quickly digest research papers and improve essay drafts.
*   **For Creators**: Generate witty captions or concise tweets in seconds.
*   **For Everyone**: Read faster, write better, and save time on the web.

---

**How to Use:**
1.  **Install** the extension.
2.  **Select** text on any webpage.
    *   If you select editable text (like an email draft), click **"Enhance"** to rewrite it in place.
    *   If you select readable text (like an article), click **"Extract"** to see a summary.
3.  **Customize** your tone by clicking the Drafty icon in your browser toolbar.

**Upgrade your browsing today with Drafty.**

---

## Privacy Policy URL
(Link to your privacy policy page)

## Category
Productivity / Communication
