import UIKit

class ViewController: UIViewController {
  private let sharedDefaults = UserDefaults(suiteName: "group.com.drafty.shared")
  private let toneSelector = UISegmentedControl(items: ["Neutral", "Pro", "Casual", "Witty", "Short"])

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
  }

  private func setupUI() {
    view.backgroundColor = .systemBackground
    
    let stackView = UIStackView()
    stackView.axis = .vertical
    stackView.spacing = 24
    stackView.alignment = .fill
    stackView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stackView)

    // Header
    let titleLabel = UILabel()
    titleLabel.text = "✨ Welcome to Drafty"
    titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
    titleLabel.textAlignment = .center
    stackView.addArrangedSubview(titleLabel)

    // Onboarding Steps
    let stepsLabel = UILabel()
    stepsLabel.numberOfLines = 0
    stepsLabel.font = .systemFont(ofSize: 16)
    stepsLabel.text = """
    To start using the AI keyboard:
    
    1. Go to iPhone Settings
    2. General -> Keyboard -> Keyboards
    3. Add New Keyboard... -> Select 'Drafty'
    4. Tap 'Drafty' and Allow Full Access
    """
    stackView.addArrangedSubview(stepsLabel)

    // Settings Section
    let settingsHeader = UILabel()
    settingsHeader.text = "Default Tone"
    settingsHeader.font = .systemFont(ofSize: 18, weight: .semibold)
    stackView.addArrangedSubview(settingsHeader)

    let toneValues = ["neutral", "professional", "casual", "witty", "concise"]
    let currentTone = sharedDefaults?.string(forKey: "selectedTone") ?? "neutral"
    toneSelector.selectedSegmentIndex = toneValues.firstIndex(of: currentTone) ?? 0
    toneSelector.addTarget(self, action: #selector(toneChanged), for: .valueChanged)
    stackView.addArrangedSubview(toneSelector)

    // Footer Button
    let settingsButton = UIButton(type: .system)
    settingsButton.setTitle("Open iOS Settings", for: .normal)
    settingsButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
    settingsButton.backgroundColor = .systemBlue
    settingsButton.setTitleColor(.white, for: .normal)
    settingsButton.layer.cornerRadius = 12
    settingsButton.heightAnchor.constraint(equalToConstant: 50).isActive = true
    settingsButton.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
    stackView.addArrangedSubview(settingsButton)

    NSLayoutConstraint.activate([
      stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
    ])
  }

  @objc private func toneChanged() {
    let toneValues = ["neutral", "professional", "casual", "witty", "concise"]
    let selected = toneValues[toneSelector.selectedSegmentIndex]
    sharedDefaults?.set(selected, forKey: "selectedTone")
    sharedDefaults?.synchronize()
  }

  @objc private func openSettings() {
    if let url = URL(string: UIApplication.openSettingsURLString) {
      UIApplication.shared.open(url)
    }
  }
}
