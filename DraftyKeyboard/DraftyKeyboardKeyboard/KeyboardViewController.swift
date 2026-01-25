import UIKit

class KeyboardViewController: UIInputViewController {
  private let maxCharacters = 500
  private let topBar = UIView()
  private let appLabel = UILabel()
  private let polishButton = UIButton(type: .system)
  private var heightConstraint: NSLayoutConstraint?
  private let activityIndicator = UIActivityIndicatorView(style: .medium)
  private let statusLabel = UILabel()

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    // Keep the custom keyboard at a consistent height.
    if heightConstraint == nil {
      let constraint = view.heightAnchor.constraint(equalToConstant: 220)
      constraint.priority = .required
      constraint.isActive = true
      heightConstraint = constraint
    }
  }

  private func setupUI() {
    view.backgroundColor = .systemBackground

    topBar.translatesAutoresizingMaskIntoConstraints = false
    topBar.backgroundColor = .secondarySystemBackground
    topBar.layer.cornerRadius = 12

    appLabel.translatesAutoresizingMaskIntoConstraints = false
    appLabel.text = "drafty"
    appLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
    appLabel.textColor = .label

    polishButton.translatesAutoresizingMaskIntoConstraints = false
    polishButton.setTitle("Polish", for: .normal)
    polishButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
    polishButton.setTitleColor(.white, for: .normal)
    polishButton.backgroundColor = .systemBlue
    polishButton.layer.cornerRadius = 10
    polishButton.contentEdgeInsets = UIEdgeInsets(top: 6, left: 14, bottom: 6, right: 14)
    polishButton.addTarget(self, action: #selector(didTapPolish), for: .touchUpInside)

    activityIndicator.translatesAutoresizingMaskIntoConstraints = false
    activityIndicator.hidesWhenStopped = true

    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.textAlignment = .center
    statusLabel.font = UIFont.systemFont(ofSize: 12)
    statusLabel.textColor = .secondaryLabel
    statusLabel.numberOfLines = 2

    view.addSubview(topBar)
    topBar.addSubview(appLabel)
    topBar.addSubview(polishButton)
    topBar.addSubview(activityIndicator)
    view.addSubview(statusLabel)

    NSLayoutConstraint.activate([
      topBar.topAnchor.constraint(equalTo: view.topAnchor, constant: 10),
      topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
      topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
      topBar.heightAnchor.constraint(equalToConstant: 48),

      appLabel.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 12),
      appLabel.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),

      polishButton.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -12),
      polishButton.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),

      activityIndicator.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
      activityIndicator.trailingAnchor.constraint(equalTo: polishButton.leadingAnchor, constant: -10),

      statusLabel.topAnchor.constraint(equalTo: topBar.bottomAnchor, constant: 10),
      statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
      statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12)
    ])
  }

  @objc private func didTapPolish() {
    let text = selectedTextOrCurrentSentence()
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !trimmed.isEmpty else {
      showStatus("No text to polish.")
      return
    }

    guard trimmed.count <= maxCharacters else {
      showStatus("Keep it under \(maxCharacters) characters.")
      return
    }

    showStatus("Polishing...")
    setLoading(true)
    rewrite(text: trimmed)
  }

  private func selectedTextOrCurrentSentence() -> String {
    if let selectedText = textDocumentProxy.selectedText, !selectedText.isEmpty {
      return selectedText
    }

    let before = textDocumentProxy.documentContextBeforeInput ?? ""
    let after = textDocumentProxy.documentContextAfterInput ?? ""
    return extractSentence(before: before, after: after)
  }

  private func extractSentence(before: String, after: String) -> String {
    let boundaries = CharacterSet(charactersIn: ".!?\n")
    let beforeParts = before.components(separatedBy: boundaries)
    let afterParts = after.components(separatedBy: boundaries)

    let left = beforeParts.last ?? ""
    let right = afterParts.first ?? ""
    let sentence = (left + right).trimmingCharacters(in: .whitespacesAndNewlines)

    return sentence.isEmpty ? before.trimmingCharacters(in: .whitespacesAndNewlines) : sentence
  }

  private func setLoading(_ isLoading: Bool) {
    polishButton.isEnabled = !isLoading
    polishButton.alpha = isLoading ? 0.6 : 1.0
    if isLoading {
      activityIndicator.startAnimating()
    } else {
      activityIndicator.stopAnimating()
    }
  }

  private func showStatus(_ message: String) {
    statusLabel.text = message
  }

  private func rewrite(text: String) {
    guard let url = URL(string: "http://localhost:8080/api/rewrite") else {
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
