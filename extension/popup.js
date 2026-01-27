document.addEventListener("DOMContentLoaded", () => {
    // Load saved settings
    chrome.storage.sync.get(["drafty_tone"], (result) => {
        const savedTone = result.drafty_tone || "neutral";
        const radio = document.querySelector(`input[value="${savedTone}"]`);
        if (radio) {
            radio.checked = true;
            updateVisualSelection(radio);
        }
    });

    // Handle selection changes
    const options = document.querySelectorAll(".option");
    options.forEach(option => {
        option.addEventListener("click", () => {
            const radio = option.querySelector("input");
            radio.checked = true;
            updateVisualSelection(radio);

            // Save immediately
            chrome.storage.sync.set({ drafty_tone: radio.value }, () => {
                // Optional: Flash success or just silent save
            });
        });
    });
});

function updateVisualSelection(selectedRadio) {
    document.querySelectorAll(".option").forEach(opt => {
        opt.classList.remove("selected");
    });
    selectedRadio.parentElement.classList.add("selected");
}
