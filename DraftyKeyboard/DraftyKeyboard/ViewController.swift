import UIKit

class ViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground

    let label = UILabel()
    label.text = "DraftyKeyboard is running."
    label.textAlignment = .center
    label.textColor = .secondaryLabel
    label.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
    ])
  }
}
