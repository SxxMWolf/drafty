// Content script runs on every page to detect selections and inject UI.
console.log("[AI Rewrite] content script loaded");

const API_BASE_URL = "https://cachinnatory-teodora-parasitic.ngrok-free.dev";

// Default rewrite options for MVP (no UI yet).
const DEFAULT_OPTIONS = {
  type: "community",
  tone: "neutral",
  language: "auto"
};

const BUTTON_ID = "ai-rewrite-floating-button";
const DIGEST_CARD_ID = "ai-rewrite-digest-card";
let floatingButton = null;
let digestCard = null;
let currentSelection = null;
let hideTimer = null;
let isProcessing = false;

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
  card.style.maxWidth = "480px";
  card.style.padding = "10px 12px";
  card.style.maxHeight = "280px";
  card.style.overflow = "auto";
  card.style.border = "1px solid rgba(0,0,0,0.12)";
  card.style.borderRadius = "12px";
  card.style.background = "rgba(255,255,255,0.98)";
  card.style.color = "#111";
  card.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  card.style.fontSize = "13px";
  card.style.lineHeight = "1.4";
  card.style.display = "none";

  const title = document.createElement("div");
  title.textContent = "Digest";
  title.style.fontWeight = "600";
  title.style.marginBottom = "6px";

  const body = document.createElement("div");
  body.dataset.role = "digest-body";
  body.textContent = "Loading...";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.style.position = "absolute";
  close.style.top = "6px";
  close.style.right = "8px";
  close.style.border = "none";
  close.style.background = "transparent";
  close.style.cursor = "pointer";
  close.style.fontSize = "16px";
  close.addEventListener("click", () => {
    card.style.display = "none";
  });

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(close);
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

  const top = rect.bottom + window.scrollY + 10;
  const left = rect.left + window.scrollX;

  digestCard.style.top = `${top}px`;
  digestCard.style.left = `${Math.max(left, 8)}px`;
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
document.addEventListener("mousedown", () => {
  hideButtonSoon();
  if (digestCard) {
    digestCard.style.display = "none";
  }
});
