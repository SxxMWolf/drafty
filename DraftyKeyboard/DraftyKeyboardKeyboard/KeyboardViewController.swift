import UIKit

class KeyboardViewController: UIInputViewController {
  private let maxCharacters = 500
  private let enhanceButton = UIButton(type: .system)
  private let activityIndicator = UIActivityIndicatorView(style: .medium)
  private let statusLabel = UILabel()
  
  private var isLoading = false {
    didSet {
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        if self.isLoading {
          self.activityIndicator.startAnimating()
        } else {
          self.activityIndicator.stopAnimating()
        }
        self.enhanceButton.isEnabled = !self.isLoading
        self.enhanceButton.alpha = self.isLoading ? 0.6 : 1.0
      }
    }
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
  }

  private func setupUI() {
    // 1. Top Bar Container
    let topBar = UIView()
    topBar.backgroundColor = UIColor.systemGray6
    topBar.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(topBar)

    // 2. Enhance Button
    enhanceButton.translatesAutoresizingMaskIntoConstraints = false
    enhanceButton.setTitle("Enhance", for: .normal)
    enhanceButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
    enhanceButton.setTitleColor(.white, for: .normal)
    enhanceButton.backgroundColor = .systemBlue
    enhanceButton.layer.cornerRadius = 10
    enhanceButton.contentEdgeInsets = UIEdgeInsets(top: 6, left: 14, bottom: 6, right: 14)
    enhanceButton.addTarget(self, action: #selector(didTapEnhance), for: .touchUpInside)
    
    // 3. Status Label
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.text = "Ready"
    statusLabel.font = UIFont.systemFont(ofSize: 12)
    statusLabel.textColor = .secondaryLabel
    
    // 4. Activity Indicator
    activityIndicator.translatesAutoresizingMaskIntoConstraints = false
    activityIndicator.hidesWhenStopped = true
    
    topBar.addSubview(enhanceButton)
    topBar.addSubview(statusLabel)
    topBar.addSubview(activityIndicator)
    
    NSLayoutConstraint.activate([
      topBar.topAnchor.constraint(equalTo: view.topAnchor),
      topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      topBar.heightAnchor.constraint(equalToConstant: 44),
      
      enhanceButton.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -12),
      enhanceButton.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
      
      activityIndicator.trailingAnchor.constraint(equalTo: enhanceButton.leadingAnchor, constant: -10),
      activityIndicator.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
      
      statusLabel.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 12),
      statusLabel.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
      statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: activityIndicator.leadingAnchor, constant: -10)
    ])
  }

  @objc private func didTapEnhance() {
    print("[Keyboard] Enhance tapped")
    let proxy = textDocumentProxy
    
    var textToEnhance = proxy.selectedText ?? ""
    if textToEnhance.isEmpty {
      if let before = proxy.documentContextBeforeInput {
        textToEnhance = before
      }
    }
    
    guard !textToEnhance.isEmpty else {
      showStatus("No text to enhance.")
      return
    }
    
    setLoading(true)
    rewrite(text: textToEnhance)
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
      showStatus("Invalid server URL.")
      return
    }

    let payload: [String: Any] = [
      "text": text,
      "type": "community",
      "tone": "neutral",
      "language": "auto"
    ]

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 10
    config.timeoutIntervalForResource = 12
    let session = URLSession(configuration: config)

    session.dataTask(with: request) { [weak self] data, _, error in
      guard
        let self,
        let data,
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let result = json["result"] as? String
      else {
        DispatchQueue.main.async {
          self?.setLoading(false)
          if let error = error as NSError?, error.code == NSURLErrorTimedOut {
            self?.showStatus("Timed out. Please try again.")
          } else {
            self?.showStatus("Failed to polish.")
          }
        }
        return
      }

      DispatchQueue.main.async {
        self.textDocumentProxy.insertText(result)
        self.setLoading(false)
        self.showStatus("Done.")
      }
    }.resume()
  }
}
