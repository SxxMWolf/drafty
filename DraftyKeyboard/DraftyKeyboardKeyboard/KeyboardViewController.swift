import UIKit

class KeyboardViewController: UIInputViewController {
  private let maxCharacters = 500
  private let enhanceButton = UIButton(type: .system)
  private let toneButton = UIButton(type: .system)
  private let activityIndicator = UIActivityIndicatorView(style: .medium)
  private let statusLabel = UILabel()
  private let sharedDefaults = UserDefaults(suiteName: "group.com.drafty.shared")
  private let feedbackGenerator = UIImpactFeedbackGenerator(style: .medium)
  
  private var selectedTone = "neutral" {
    didSet {
      updateToneButtonTitle()
      sharedDefaults?.set(selectedTone, forKey: "selectedTone")
    }
  }

  private var isLoading = false {
    didSet {
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        if self.isLoading {
          self.activityIndicator.startAnimating()
          self.animatePulse(start: true)
        } else {
          self.activityIndicator.stopAnimating()
          self.animatePulse(start: false)
        }
        self.enhanceButton.isEnabled = !self.isLoading
        self.toneButton.isEnabled = !self.isLoading
        self.enhanceButton.alpha = self.isLoading ? 0.6 : 1.0
        self.toneButton.alpha = self.isLoading ? 0.6 : 1.0
      }
    }
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    feedbackGenerator.prepare()
    if let savedTone = sharedDefaults?.string(forKey: "selectedTone") {
      self.selectedTone = savedTone
    }
    setupUI()
    setupToneMenu()
  }

  private func setupUI() {
    // 1. Top Bar Container (Glassmorphism)
    let blurEffect = UIBlurEffect(style: .systemThinMaterial)
    let topBar = UIVisualEffectView(effect: blurEffect)
    topBar.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(topBar)

    let contentView = topBar.contentView

    // 2. Tone Button
    toneButton.translatesAutoresizingMaskIntoConstraints = false
    toneButton.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .medium)
    toneButton.setTitleColor(.systemBlue, for: .normal)
    toneButton.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.5)
    toneButton.layer.cornerRadius = 10
    toneButton.contentEdgeInsets = UIEdgeInsets(top: 5, left: 12, bottom: 5, right: 12)
    toneButton.layer.borderWidth = 0.5
    toneButton.layer.borderColor = UIColor.separator.cgColor
    updateToneButtonTitle()

    // 3. Enhance Button
    enhanceButton.translatesAutoresizingMaskIntoConstraints = false
    enhanceButton.setTitle("✨ Enhance", for: .normal)
    enhanceButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .bold)
    enhanceButton.setTitleColor(.white, for: .normal)
    enhanceButton.backgroundColor = UIColor.systemBlue
    enhanceButton.layer.cornerRadius = 12
    enhanceButton.contentEdgeInsets = UIEdgeInsets(top: 7, left: 16, bottom: 7, right: 16)
    enhanceButton.layer.shadowColor = UIColor.black.cgColor
    enhanceButton.layer.shadowOpacity = 0.1
    enhanceButton.layer.shadowOffset = CGSize(width: 0, height: 2)
    enhanceButton.layer.shadowRadius = 4
    enhanceButton.addTarget(self, action: #selector(didTapEnhance), for: .touchUpInside)
    
    // 4. Status Label
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.text = "Ready"
    statusLabel.font = UIFont.systemFont(ofSize: 11, weight: .medium)
    statusLabel.textColor = .secondaryLabel
    
    // 5. Activity Indicator
    activityIndicator.translatesAutoresizingMaskIntoConstraints = false
    activityIndicator.hidesWhenStopped = true
    
    contentView.addSubview(toneButton)
    contentView.addSubview(enhanceButton)
    contentView.addSubview(statusLabel)
    contentView.addSubview(activityIndicator)
    
    NSLayoutConstraint.activate([
      topBar.topAnchor.constraint(equalTo: view.topAnchor),
      topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      topBar.heightAnchor.constraint(equalToConstant: 50),
      
      enhanceButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
      enhanceButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      
      toneButton.trailingAnchor.constraint(equalTo: enhanceButton.leadingAnchor, constant: -10),
      toneButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),

      activityIndicator.trailingAnchor.constraint(equalTo: toneButton.leadingAnchor, constant: -10),
      activityIndicator.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      
      statusLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
      statusLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: activityIndicator.leadingAnchor, constant: -10)
    ])
  }

  private func setupToneMenu() {
    let tones = [
      ("Neutral", "neutral"),
      ("Professional", "professional"),
      ("Casual", "casual"),
      ("Witty", "witty"),
      ("Concise", "concise")
    ]
    
    let actions = tones.map { (display, value) in
      UIAction(title: display, state: self.selectedTone == value ? .on : .off) { [weak self] _ in
        self?.selectedTone = value
        self?.setupToneMenu()
      }
    }
    
    toneButton.menu = UIMenu(title: "Choose Tone", children: actions)
    toneButton.showsMenuAsPrimaryAction = true
  }

  private func updateToneButtonTitle() {
    let display = selectedTone.capitalized
    toneButton.setTitle("Tone: \(display)", for: .normal)
  }

  @objc private func didTapEnhance() {
    animateScaleDown(enhanceButton)
    
    let proxy = textDocumentProxy
    var textToEnhance = proxy.selectedText ?? ""
    if textToEnhance.isEmpty {
      if let before = proxy.documentContextBeforeInput {
        textToEnhance = before
      }
    }
    
    let safeText = textToEnhance.trimmingCharacters(in: .whitespacesAndNewlines)
    
    if safeText.isEmpty {
      showStatus("No text to enhance. ✏️")
      return
    }
    
    if safeText.count > maxCharacters {
      showStatus("Text too long (max 500). ✂️")
      return
    }
    
    setLoading(true)
    showStatus("Enhancing... ✨")
    rewrite(text: safeText)
  }

  private func setLoading(_ isLoading: Bool) {
    self.isLoading = isLoading
  }

  private func showStatus(_ message: String) {
    DispatchQueue.main.async {
      self.statusLabel.text = message
    }
  }

  private func rewrite(text: String) {
    guard let url = URL(string: "https://drafty-ssa4.onrender.com/enhance") else {
      setLoading(false)
      showStatus("URL Error. 🛑")
      return
    }

    let payload: [String: Any] = [
      "text": text,
      "tone": self.selectedTone,
      "platform": "ios-keyboard"
    ]

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 15
    config.timeoutIntervalForResource = 20
    let session = URLSession(configuration: config)

    session.dataTask(with: request) { [weak self] data, _, error in
      guard let self = self else { return }
      
      if let error = error as NSError? {
        DispatchQueue.main.async {
          self.setLoading(false)
          if error.code == NSURLErrorTimedOut {
            self.showStatus("Timeout. ⏳")
          } else if error.code == NSURLErrorNotConnectedToInternet {
            self.showStatus("No Connection. 📡")
          } else {
            self.showStatus("Error. 🛑")
          }
        }
        return
      }

      guard
        let data,
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let result = json["polishedText"] as? String
      else {
        DispatchQueue.main.async {
          self.setLoading(false)
          self.showStatus("Failed. 🛑")
        }
        return
      }

      DispatchQueue.main.async {
        self.feedbackGenerator.impactOccurred()
        self.textDocumentProxy.insertText(result)
        self.setLoading(false)
        self.showStatus("Done! ✨")
      }
    }.resume()
  }

  // MARK: - Animations
  private func animateScaleDown(_ view: UIView) {
    UIView.animate(withDuration: 0.1, animations: {
      view.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
    }) { _ in
      UIView.animate(withDuration: 0.1) {
        view.transform = .identity
      }
    }
  }

  private func animatePulse(start: Bool) {
    if start {
      let animation = CABasicAnimation(keyPath: "opacity")
      animation.fromValue = 1.0
      animation.toValue = 0.5
      animation.duration = 0.8
      animation.autoreverses = true
      animation.repeatCount = .infinity
      enhanceButton.layer.add(animation, forKey: "pulse")
    } else {
      enhanceButton.layer.removeAnimation(forKey: "pulse")
    }
  }
}
