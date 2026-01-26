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
const DIGEST_CARD_ID = "ai-rewrite-digest-card";

// Remove existing elements from previous extension loads to ensure updates apply.
[BUTTON_ID, DIGEST_CARD_ID].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.remove();
});

let floatingButton = null;
let digestCard = null;
let currentSelection = null;
let hideTimer = null;
let isProcessing = false;
let isDraggingDigest = false;
let digestDragOffset = { x: 0, y: 0 };

function createFloatingButton() {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) {
    return existing;
  }

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.textContent = "✨ Rewrite";
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

function createDigestCard() {
  const existing = document.getElementById(DIGEST_CARD_ID);
  if (existing) {
    return existing;
  }

  const card = document.createElement("div");
  card.id = DIGEST_CARD_ID;

  card.style.position = "absolute";
  card.style.zIndex = "2147483647";
  card.style.maxWidth = "720px";
  card.style.padding = "15px 18px";
  card.style.maxHeight = "420px";
  card.style.overflow = "auto";
  card.style.border = "1px solid rgba(0,0,0,0.12)";
  card.style.borderRadius = "12px";
  card.style.background = "rgba(255,255,255,0.98)";
  card.style.color = "#111";
  card.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  card.style.display = "none";
  card.style.minWidth = "300px";

  // Header Container for Title + Actions
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "12px";
  header.style.userSelect = "none";
  header.style.marginTop = "-4px"; // pulling it up slightly

  const title = document.createElement("div");
  title.textContent = "Digest";
  title.style.fontWeight = "600";
  title.style.fontSize = "16px";
  title.style.cursor = "move";
  title.style.marginRight = "auto"; // Push actions to the right

  // Draggable area on header
  header.addEventListener("mousedown", (e) => {
    // Only drag if not clicking buttons
    if (e.target.tagName !== "BUTTON") {
      isDraggingDigest = true;
      const rect = card.getBoundingClientRect();
      digestDragOffset.x = e.clientX - rect.left;
      digestDragOffset.y = e.clientY - rect.top;
      card.dataset.userPositioned = "true";
      e.preventDefault();
    }
  });

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.alignItems = "center";
  actions.style.gap = "8px";

  // 1. Copy Button
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.type = "button";
  copyBtn.style.padding = "4px 10px";
  copyBtn.style.fontSize = "12px";
  copyBtn.style.fontWeight = "500";
  copyBtn.style.background = "#f2f2f7";
  copyBtn.style.border = "none";
  copyBtn.style.borderRadius = "6px";
  copyBtn.style.cursor = "pointer";
  copyBtn.style.color = "#333";
  copyBtn.style.transition = "background 0.2s";

  copyBtn.addEventListener("mouseover", () => {
    copyBtn.style.background = "#e5e5ea";
  });
  copyBtn.addEventListener("mouseout", () => {
    copyBtn.style.background = "#f2f2f7";
  });


  copyBtn.addEventListener("click", () => {
    const text = body.textContent;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        copyBtn.style.background = "#34c759"; // Green success
        copyBtn.style.color = "white";
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = "#f2f2f7";
          copyBtn.style.color = "#333";
        }, 1500);
      });
    }
  });

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.style.border = "none";
  close.style.background = "transparent";
  close.style.cursor = "pointer";
  close.style.fontSize = "22px";
  close.style.color = "#8e8e93";
  close.style.padding = "0 4px";
  close.style.lineHeight = "1";
  close.style.marginTop = "-2px"; // Visual alignment

  close.addEventListener("mouseover", () => {
    close.style.color = "#111";
  });
  close.addEventListener("mouseout", () => {
    close.style.color = "#8e8e93";
  });

  close.addEventListener("click", () => {
    card.style.display = "none";
  });

  actions.appendChild(copyBtn);
  actions.appendChild(close);

  header.appendChild(title);
  header.appendChild(actions);

  const body = document.createElement("div");
  body.dataset.role = "digest-body";
  body.textContent = "Loading...";
  body.style.padding = "0px";
  body.style.fontSize = "15px";
  body.style.lineHeight = "1.5";
  body.style.color = "#1c1c1e";

  card.appendChild(header);
  card.appendChild(body);
  document.body.appendChild(card);
  return card;
}

function updateDigestCard(text) {
  if (!digestCard) {
    digestCard = createDigestCard();
  }
  const body = digestCard.querySelector('[data-role="digest-body"]');
  if (body) {
    body.textContent = text;
  }
}

function positionDigestCard(rect) {
  if (!digestCard) {
    digestCard = createDigestCard();
  }

  // Only set initial position if card is not already positioned by user drag
  if (!digestCard.dataset.userPositioned) {
    const top = rect.bottom + window.scrollY + 10;
    const left = rect.left + window.scrollX;

    digestCard.style.top = `${top}px`;
    digestCard.style.left = `${Math.max(left, 8)}px`;
  }
  digestCard.style.display = "block";
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

  const top = rect.bottom + window.scrollY + 6;
  const left = rect.right + window.scrollX - floatingButton.offsetWidth;

  floatingButton.style.top = `${top}px`;
  floatingButton.style.left = `${Math.max(left, 8)}px`;
  floatingButton.style.display = "block";
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
  const info = getSelectionInfo();
  currentSelection = info;

  if (!info) {
    hideButtonSoon();
    return;
  }

  const isPolish =
    info.kind === "input" || (info.kind === "range" && info.editableRoot);

  if (!floatingButton) {
    floatingButton = createFloatingButton();
  }
  floatingButton.textContent = isPolish ? "Polish" : "Digest";
  floatingButton.dataset.mode = isPolish ? "polish" : "digest";

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

  const mode = floatingButton?.dataset?.mode || "polish";
  isProcessing = true;
  floatingButton.textContent = mode === "digest" ? "Digesting..." : "Polishing...";
  floatingButton.disabled = true;

  try {
    if (mode === "digest") {
      updateDigestCard("Digesting...");
      positionDigestCard(currentSelection.rect);
    }

    const endpoint =
      mode === "digest" ? `${API_BASE_URL}/api/digest` : `${API_BASE_URL}/api/polish`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: currentSelection.text,
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

    if (mode === "digest") {
      updateDigestCard(resultText);
    } else {
      const replaced = replaceSelectionText(resultText);
      if (!replaced) {
        throw new Error("Failed to replace selection");
      }
    }

    // Reset label after a successful rewrite.
    floatingButton.textContent = mode === "digest" ? "Digest" : "Polish";
  } catch (error) {
    console.error("[AI Rewrite] fetch failed", error);
    if (error && error.message) {
      console.error("[AI Rewrite] fetch error message:", error.message);
    }
    if (mode === "digest") {
      updateDigestCard("Failed to digest. Please try again.");
    }
    floatingButton.textContent = "Error";
    setTimeout(() => {
      floatingButton.textContent = mode === "digest" ? "Digest" : "Polish";
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
  if (!isDraggingDigest) {
    hideButtonSoon();
    if (digestCard && !digestCard.contains(e.target)) {
      digestCard.style.display = "none";
    }
  }
});

// Handle digest card dragging
document.addEventListener("mousemove", (e) => {
  if (isDraggingDigest && digestCard) {
    const x = e.clientX - digestDragOffset.x + window.scrollX;
    const y = e.clientY - digestDragOffset.y + window.scrollY;
    digestCard.style.left = `${Math.max(0, x)}px`;
    digestCard.style.top = `${Math.max(0, y)}px`;
    digestCard.style.right = "auto";
  }
});

document.addEventListener("mouseup", () => {
  isDraggingDigest = false;
});

// 3. ESC Key Support
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (floatingButton) {
      hideButtonSoon();
    }
    if (digestCard && digestCard.style.display !== "none") {
      digestCard.style.display = "none";
    }
  }
});
