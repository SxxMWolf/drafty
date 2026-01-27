// Content script runs on every page to detect selections and inject UI.
console.log("[AI Rewrite] content script loaded");

const API_BASE_URL = "https://drafty-ssa4.onrender.com";

// Default rewrite options for MVP (no UI yet).
const DEFAULT_OPTIONS = {
  type: "community",
  tone: "neutral",
  language: "auto"
};

const BUTTON_ID = "ai-rewrite-floating-button";
const EXTRACT_CARD_ID = "ai-rewrite-extract-card";

// Remove existing elements from previous extension loads to ensure updates apply.
[BUTTON_ID, EXTRACT_CARD_ID, "ai-rewrite-digest-card"].forEach(id => {
  const elements = document.querySelectorAll(`#${id}`);
  elements.forEach(el => el.remove());
});

let floatingButton = null;
let extractCard = null;
let currentSelection = null;
let hideTimer = null;
let isProcessing = false;
let isDraggingExtract = false;
let extractDragOffset = { x: 0, y: 0 };
let loadingInterval = null;

function startLoadingAnimation(button, baseText, secondaryElement = null) {
  if (loadingInterval) clearInterval(loadingInterval);
  let dots = 1;

  const updateText = (text) => {
    if (button) {
      button.textContent = text;
    }
    if (secondaryElement) {
      secondaryElement.textContent = text;
    }
  };

  updateText(baseText + ".");

  loadingInterval = setInterval(() => {
    dots = (dots % 3) + 1;
    updateText(baseText + ".".repeat(dots));
  }, 500);
}

function stopLoadingAnimation() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
}

function createFloatingButton() {
  // Double-check cleanup
  const existing = document.getElementById(BUTTON_ID);
  if (existing) {
    return existing;
  }

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.textContent = "✨ Enhance";
  button.type = "button";

  // Subtle styling for a native, non-intrusive feel.
  button.style.position = "absolute";
  button.style.zIndex = "2147483647";
  button.style.padding = "5px 9px";
  button.style.fontSize = "12px";
  button.style.border = "1px solid rgba(0,0,0,0.12)";
  button.style.borderRadius = "999px";
  button.style.background = "rgba(255,255,255,0.96)";
  button.style.color = "#111";
  button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
  button.style.cursor = "pointer";
  button.style.display = "none";
  button.style.opacity = "0";
  button.style.transition = "opacity 120ms ease, transform 120ms ease";
  button.style.transform = "translateY(-4px)";
  button.style.outline = "none"; // Prevent focus outline causing double-border effect

  // Prevent selection loss on click.
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  button.addEventListener("click", handleRewriteClick);

  document.body.appendChild(button);
  return button;
}

function getEditableRootFromSelection(selection) {
  if (!selection || !selection.anchorNode) {
    return null;
  }

  const node =
    selection.anchorNode.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection.anchorNode;

  if (!node || !(node instanceof Element)) {
    return null;
  }

  return node.closest('[contenteditable="true"]');
}

// Theme & Style Constants
let currentFontSize = 15;
const THEME = {
  light: {
    bg: "rgba(255,255,255,0.98)",
    text: "#111",
    border: "1px solid rgba(0,0,0,0.12)",
    bodyBg: "#f9f9fb",
    bodyBorder: "1px solid #e5e5ea",
    btnBg: "#f2f2f7",
    btnText: "#333",
    btnHover: "#e5e5ea",
    success: "#34c759"
  },
  dark: {
    bg: "rgba(30,30,30,0.98)",
    text: "#fff",
    border: "1px solid rgba(255,255,255,0.12)",
    bodyBg: "#2c2c2e",
    bodyBorder: "1px solid #3a3a3c",
    btnBg: "#3a3a3c",
    btnText: "#fff",
    btnHover: "#48484a",
    success: "#30d158"
  }
};

const getTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? THEME.dark : THEME.light;
};

function applyThemeToCard(card) {
  if (!card) return;
  const theme = getTheme();

  // Main Card
  card.style.background = theme.bg;
  card.style.color = theme.text;
  card.style.border = theme.border;

  // Body
  const body = card.querySelector('[data-role="extract-body"]');
  if (body) {
    body.style.backgroundColor = theme.bodyBg;
    body.style.border = theme.bodyBorder;
    body.style.color = theme.text;
  }

  // Buttons (generic update for Action buttons)
  const buttons = card.querySelectorAll('[data-role="action-btn"]');
  buttons.forEach(btn => {
    // Preserve success state color if active (simple check based on bg)
    if (btn.style.background !== "rgb(52, 199, 89)" && btn.style.background !== "#34c759") {
      btn.style.background = theme.btnBg;
      btn.style.color = theme.btnText;
    }
  });

  // Close button (special)
  const closeBtn = card.querySelector('[data-role="close-btn"]');
  if (closeBtn) {
    // Actually close button can inherit or contrast. Let's force it to text color slightly dimmed.
    closeBtn.style.color = theme.text;
    closeBtn.style.opacity = "0.6";
  }
}

function updateExtractCard(text, isError = false) {
  if (!extractCard) {
    extractCard = createExtractCard();
  }
  const body = extractCard.querySelector('[data-role="extract-body"]');
  if (body) {
    body.textContent = text;
  }

  const retryContainer = extractCard.querySelector('[data-role="retry-container"]');
  if (retryContainer) {
    retryContainer.style.display = isError ? "block" : "none";
  }
}

function createExtractCard() {
  const existing = document.getElementById(EXTRACT_CARD_ID);
  if (existing) {
    return existing;
  }

  const card = document.createElement("div");
  card.id = EXTRACT_CARD_ID;

  // Base styles
  card.style.position = "absolute";
  card.style.zIndex = "2147483647";
  card.style.maxWidth = "720px";
  card.style.padding = "15px 18px";
  card.style.maxHeight = "420px";
  card.style.overflow = "auto";
  card.style.borderRadius = "12px";
  card.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  card.style.display = "none";
  card.style.minWidth = "300px";
  card.style.transition = "background 0.3s, color 0.3s";

  // Header Container for Title + Actions
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "12px";
  header.style.userSelect = "none";
  header.style.marginTop = "-4px";

  const title = document.createElement("div");
  title.textContent = "Extract";
  title.style.fontWeight = "600";
  title.style.fontSize = "16px";
  title.style.cursor = "move";
  title.style.marginRight = "auto";

  // Draggable area on header
  header.addEventListener("mousedown", (e) => {
    if (e.target.tagName !== "BUTTON") {
      isDraggingExtract = true;
      const rect = card.getBoundingClientRect();
      extractDragOffset.x = e.clientX - rect.left;
      extractDragOffset.y = e.clientY - rect.top;
      card.dataset.userPositioned = "true";
      e.preventDefault();
    }
  });

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.alignItems = "center";
  actions.style.gap = "8px";

  // Helper to create action buttons
  const createActionBtn = (text, onClick) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.type = "button";
    btn.dataset.role = "action-btn";
    btn.style.padding = "4px 10px";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "500";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";
    btn.style.transition = "background 0.2s";

    // Hover effect relies on theme, will add simple listener
    btn.addEventListener("mouseover", () => {
      const t = getTheme();
      if (btn.textContent !== "Copied!") btn.style.background = t.btnHover;
    });
    btn.addEventListener("mouseout", () => {
      const t = getTheme();
      if (btn.textContent !== "Copied!") btn.style.background = t.btnBg;
    });

    btn.addEventListener("click", onClick);
    return btn;
  };

  // Font Size -
  const fontDown = createActionBtn("-", () => {
    currentFontSize = Math.max(12, currentFontSize - 1);
    const b = card.querySelector('[data-role="extract-body"]');
    if (b) b.style.fontSize = `${currentFontSize}px`;
  });

  // Font Size +
  const fontUp = createActionBtn("+", () => {
    currentFontSize = Math.min(24, currentFontSize + 1);
    const b = card.querySelector('[data-role="extract-body"]');
    if (b) b.style.fontSize = `${currentFontSize}px`;
  });

  // Copy Button
  const copyBtn = createActionBtn("Copy", () => {
    const body = card.querySelector('[data-role="extract-body"]');
    const text = body ? body.textContent : "";
    if (text && text !== "Loading..." && !text.includes("Failed")) {
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        const theme = getTheme();
        copyBtn.textContent = "Copied!";
        copyBtn.style.background = theme.success;
        copyBtn.style.color = "#fff";
        setTimeout(() => {
          copyBtn.textContent = originalText;
          const t = getTheme();
          copyBtn.style.background = t.btnBg;
          copyBtn.style.color = t.btnText;
        }, 1500);
      });
    }
  });

  // Close Button
  const close = document.createElement("button");
  close.type = "button";
  close.dataset.role = "close-btn";
  close.textContent = "×";
  close.style.border = "none";
  close.style.background = "transparent";
  close.style.cursor = "pointer";
  close.style.fontSize = "22px";
  close.style.padding = "0 4px";
  close.style.lineHeight = "1";
  close.style.marginTop = "-2px";
  close.addEventListener("click", () => {
    card.style.display = "none";
  });

  // Assemble Actions
  actions.appendChild(fontDown);
  actions.appendChild(fontUp);
  actions.appendChild(copyBtn);
  actions.appendChild(close);

  header.appendChild(title);
  header.appendChild(actions);

  const body = document.createElement("div");
  body.dataset.role = "extract-body";
  body.textContent = "Loading...";
  body.style.padding = "0px";
  body.style.fontSize = `${currentFontSize}px`;
  body.style.lineHeight = "1.5";
  body.style.marginTop = "10px";
  body.style.padding = "12px";
  body.style.borderRadius = "8px";
  body.style.transition = "background 0.3s, color 0.3s";

  // Retry Container (Hidden by default)
  const retryContainer = document.createElement("div");
  retryContainer.dataset.role = "retry-container";
  retryContainer.style.display = "none";
  retryContainer.style.marginTop = "12px";
  retryContainer.style.textAlign = "center";

  const retryBtn = createActionBtn("Retry", () => {
    // Retry logic will be handled by calling handleRewriteClick again
    // We need to re-trigger the process. 
    // Since handleRewriteClick relies on global state (currentSelection, floatingButton mode), 
    // we can just call it if we ensure the state is preserved.
    handleRewriteClick();
  });
  retryContainer.appendChild(retryBtn);


  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(retryContainer);

  document.body.appendChild(card);

  // Apply initial theme
  applyThemeToCard(card);

  // Listen for theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyThemeToCard(card);
  });

  return card;
}



function positionExtractCard(rect) {
  if (!extractCard) {
    extractCard = createExtractCard();
  }

  // Only set initial position if card is not already positioned by user drag
  if (!extractCard.dataset.userPositioned) {
    const top = rect.bottom + window.scrollY + 10;
    const left = rect.left + window.scrollX;

    extractCard.style.top = `${top}px`;
    extractCard.style.left = `${Math.max(left, 8)}px`;
  }
  extractCard.style.display = "block";
}

function getSelectionInfo() {
  const activeElement = document.activeElement;

  // Handle text selection inside input/textarea.
  if (
    activeElement &&
    (activeElement.tagName === "TEXTAREA" ||
      (activeElement.tagName === "INPUT" && activeElement.type === "text"))
  ) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    if (typeof start === "number" && typeof end === "number" && end > start) {
      return {
        kind: "input",
        element: activeElement,
        start,
        end,
        text: activeElement.value.slice(start, end),
        // Use the input's bounding box for button placement.
        rect: activeElement.getBoundingClientRect()
      };
    }
  }

  // Handle normal page selection (including contenteditable).
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString();
  if (!text.trim()) {
    return null;
  }

  // Ignore selections that are not inside the document body.
  if (!document.body.contains(range.commonAncestorContainer)) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) {
    return null;
  }

  return {
    kind: "range",
    range: range.cloneRange(),
    text,
    rect,
    editableRoot: getEditableRootFromSelection(selection)
  };
}

function positionButton(rect) {
  if (!floatingButton) {
    floatingButton = createFloatingButton();
  }

  // Ensure button is visible for measurement
  floatingButton.style.display = "block";

  const top = rect.bottom + window.scrollY + 6;
  const left = rect.right + window.scrollX - floatingButton.offsetWidth;

  floatingButton.style.top = `${top}px`;
  floatingButton.style.left = `${Math.max(left, 8)}px`;
  floatingButton.style.opacity = "1";
  floatingButton.style.transform = "translateY(0)";
}

function hideButtonSoon() {
  if (isProcessing) {
    return;
  }
  if (!floatingButton) {
    return;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  hideTimer = setTimeout(() => {
    floatingButton.style.opacity = "0";
    floatingButton.style.transform = "translateY(-4px)";
    floatingButton.style.display = "none";
  }, 150);
}

function handleSelectionChange() {
  if (isProcessing) {
    return;
  }
  const info = getSelectionInfo();
  currentSelection = info;

  if (!info) {
    hideButtonSoon();
    return;
  }

  const isEnhance =
    info.kind === "input" || (info.kind === "range" && info.editableRoot);

  if (!floatingButton) {
    floatingButton = createFloatingButton();
  }
  floatingButton.textContent = isEnhance ? "Enhance" : "Extract";
  floatingButton.dataset.mode = isEnhance ? "enhance" : "extract";

  positionButton(info.rect);
}

function replaceSelectionText(resultText) {
  if (!currentSelection) {
    return false;
  }

  if (currentSelection.kind === "input") {
    currentSelection.element.setRangeText(
      resultText,
      currentSelection.start,
      currentSelection.end,
      "end"
    );
    return true;
  }

  const selection = window.getSelection();
  if (
    currentSelection.editableRoot &&
    selection &&
    selection.rangeCount > 0 &&
    currentSelection.editableRoot.contains(selection.anchorNode)
  ) {
    // Let the editor handle replacement when possible.
    if (document.execCommand("insertText", false, resultText)) {
      return true;
    }
  }

  if (currentSelection.range) {
    const range = currentSelection.range;
    const container = range.commonAncestorContainer;
    if (container && document.body.contains(container)) {
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      range.deleteContents();
      const textNode = document.createTextNode(resultText);
      range.insertNode(textNode);
      if (selection) {
        selection.removeAllRanges();
        selection.collapse(textNode, textNode.length);
      }
      return true;
    }
  }

  return false;
}

async function handleRewriteClick() {
  if (!currentSelection) {
    return;
  }

  const mode = floatingButton?.dataset?.mode || "enhance";
  isProcessing = true;
  if (hideTimer) clearTimeout(hideTimer);

  const baseLoadingText = mode === "extract" ? "Extracting" : "Enhancing";

  let secondaryElement = null;
  if (mode === "extract") {
    floatingButton.style.display = "none"; // Hide small button immediately
    updateExtractCard("Extracting...");
    positionExtractCard(currentSelection.rect);
    if (extractCard) {
      secondaryElement = extractCard.querySelector('[data-role="extract-body"]');
    }
  }

  startLoadingAnimation(mode === "extract" ? null : floatingButton, baseLoadingText, secondaryElement);

  floatingButton.disabled = true;

  try {
    const endpoint =
      mode === "extract" ? `${API_BASE_URL}/api/extract` : `${API_BASE_URL}/api/enhance`;

    // Retrieve stored tone (safely)
    let tone = "neutral";
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        const storage = await new Promise(resolve => {
          chrome.storage.sync.get(["drafty_tone"], resolve);
        });
        tone = storage.drafty_tone || "neutral";
      }
    } catch (e) {
      console.warn("[Drafty] Failed to load tone settings:", e);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: currentSelection.text,
        tone: tone,
        ...DEFAULT_OPTIONS
      })
    });

    if (!response.ok) {
      throw new Error(`Rewrite failed: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data && data.result ? String(data.result) : "";

    if (!resultText) {
      throw new Error("Empty rewrite result");
    }

    stopLoadingAnimation(); // Stop animation before showing result

    if (mode === "extract") {
      updateExtractCard(resultText);
    } else {
      const replaced = replaceSelectionText(resultText);
      if (!replaced) {
        throw new Error("Failed to replace selection");
      }
    }

    // Reset label after a successful rewrite.
    floatingButton.textContent = mode === "extract" ? "Extract" : "Enhance";
  } catch (error) {
    stopLoadingAnimation(); // Stop animation on error
    console.error("[AI Rewrite] fetch failed", error);
    if (error && error.message) {
      console.error("[AI Rewrite] fetch error message:", error.message);
    }
    if (mode === "extract") {
      updateExtractCard(
        `Failed to extract. ${error.message || "Please check your connection."}`,
        true // isError
      );
    }
    floatingButton.textContent = "Error";
    setTimeout(() => {
      floatingButton.textContent = mode === "extract" ? "Extract" : "Enhance";
    }, 1200);
  } finally {
    isProcessing = false;
    floatingButton.disabled = false;
    hideButtonSoon();
  }
}

// Listen for selection changes via mouse, keyboard, and DOM selection updates.
document.addEventListener("mouseup", handleSelectionChange);
document.addEventListener("keyup", handleSelectionChange);
document.addEventListener("selectionchange", handleSelectionChange);

// Hide the button when the user scrolls or clicks elsewhere.
document.addEventListener("scroll", hideButtonSoon, true);
document.addEventListener("mousedown", (e) => {
  if (isDraggingExtract) return;

  // Don't hide if clicking on the button itself or the extract card
  if (floatingButton && floatingButton.contains(e.target)) {
    return;
  }
  if (extractCard && extractCard.contains(e.target)) {
    return;
  }

  hideButtonSoon();

  if (extractCard && !extractCard.contains(e.target)) {
    extractCard.style.display = "none";
  }
});

// Handle extract card dragging
document.addEventListener("mousemove", (e) => {
  if (isDraggingExtract && extractCard) {
    const x = e.clientX - extractDragOffset.x + window.scrollX;
    const y = e.clientY - extractDragOffset.y + window.scrollY;
    extractCard.style.left = `${Math.max(0, x)}px`;
    extractCard.style.top = `${Math.max(0, y)}px`;
    extractCard.style.right = "auto";
  }
});

document.addEventListener("mouseup", () => {
  isDraggingExtract = false;
});

// 3. ESC Key Support
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (floatingButton) {
      hideButtonSoon();
    }
    if (extractCard && extractCard.style.display !== "none") {
      extractCard.style.display = "none";
    }
  }
});
