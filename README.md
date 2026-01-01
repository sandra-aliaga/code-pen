# ShDraw - Gesture-Based Routine Automation for VS Code

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/YOUR_PUBLISHER.shdraw)](https://marketplace.visualstudio.com/items?itemName=YOUR_PUBLISHER.shdraw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ShDraw** transforms the way you interact with VS Code by letting you **draw custom gestures** to trigger powerful automation routines. Stop memorizing complex keyboard shortcuts — just draw a shape and watch your workflow execute automatically.

> *"Draw an 'L' to save, format, and run tests. Draw a circle to enter Zen mode. Your gestures, your rules."*

![ShDraw Demo](images/demo.gif)

---

## Why ShDraw?

- **Intuitive**: Drawing gestures is more natural than remembering keyboard shortcuts
- **Powerful**: Chain multiple commands into a single gesture
- **Fast**: Execute complex workflows in under a second
- **Customizable**: Create unlimited routines tailored to your workflow
- **Non-intrusive**: Dedicated canvas that doesn't interfere with your code

---

## Features

### Execution Canvas
Open a dedicated drawing canvas where you can execute your gestures without affecting your code editor.

- Real-time gesture recognition with visual feedback
- Statistics tracking (gestures drawn vs. recognized)
- Support for mouse, trackpad, and touch input

![Execution Canvas](images/execution-canvas.png)

### Routine Configuration
Create powerful automation routines with an intuitive visual interface.

- **Predefined command blocks**: Common VS Code actions ready to use
- **Custom VS Code commands**: Access any command from VS Code's command palette
- **Terminal commands**: Run shell commands (npm, git, docker, etc.)
- **Configurable delays**: Add timing between commands
- **Drag & drop reordering**: Organize your command sequence easily
- **Test before saving**: Try your routine before committing

![Configuration Panel](images/configuration-panel.png)

### Intelligent Gesture Validation
ShDraw uses the [$1 Recognizer algorithm](https://depts.washington.edu/acelab/proj/dollar/index.html) to ensure reliable gesture detection.

- Automatic detection of similar gestures to prevent conflicts
- Draw the same gesture 3 times to register (ensures consistency)
- 80% recognition threshold for accurate matching

---

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "ShDraw"
4. Click **Install**

### From VSIX
1. Download the `.vsix` file from [Releases](https://github.com/YOUR_USERNAME/shdraw/releases)
2. In VS Code, go to Extensions
3. Click `...` menu → "Install from VSIX..."
4. Select the downloaded file

---

## Quick Start

### Step 1: Create a Routine

1. Open the configuration panel:
   - Press `Ctrl+Alt+A` (Windows/Linux) or `Cmd+Alt+A` (Mac)
   - Or run command: `ShDraw: Configure Routines`

2. Click **"New Routine"**

3. Configure your routine:
   - Enter a name (e.g., "Focus Mode")
   - Add commands from predefined blocks or search for any VS Code command
   - Optionally add terminal commands or delays
   - Click **"Next"**

4. Draw your gesture:
   - Draw the same pattern **3 times** to register it
   - The system validates it's unique
   - Click **"Save"**

### Step 2: Execute Your Routine

1. Open the execution canvas:
   - Press `Ctrl+Alt+D` (Windows/Linux) or `Cmd+Alt+D` (Mac)
   - Or run command: `ShDraw: Execute Gestures`

2. Draw your gesture on the canvas

3. Watch your routine execute automatically!

---

## Available Command Blocks

### Files
| Command | Description |
|---------|-------------|
| Save | Save current file |
| Save All | Save all open files |
| Format Document | Format the current file |
| Close Editor | Close current tab |
| Close All | Close all tabs |

### Focus
| Command | Description |
|---------|-------------|
| Zen Mode | Toggle distraction-free mode |
| Toggle Sidebar | Show/hide the sidebar |
| Toggle Panel | Show/hide the bottom panel |
| Fullscreen | Toggle fullscreen mode |
| Toggle Minimap | Show/hide the minimap |

### Appearance
| Command | Description |
|---------|-------------|
| Change Theme | Open theme selector |
| Increase Font | Make text larger |
| Decrease Font | Make text smaller |
| Reset Font | Reset to default size |

### Terminal
| Command | Description |
|---------|-------------|
| New Terminal | Open a new terminal |
| Toggle Terminal | Show/hide terminal |
| Clear Terminal | Clear terminal output |
| *Custom commands* | Run any shell command |

### Git
| Command | Description |
|---------|-------------|
| Commit | Open commit dialog |
| Push | Push to remote |
| Pull | Pull from remote |
| Stash | Stash changes |
| Stash Pop | Apply stashed changes |

### Utilities
| Command | Description |
|---------|-------------|
| Delay | Wait N milliseconds |
| *Any VS Code command* | Search and add any command |

---

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Execute Gestures | `Ctrl+Alt+D` | `Cmd+Alt+D` |
| Configure Routines | `Ctrl+Alt+A` | `Cmd+Alt+A` |

---

## Example Routines

### "Quick Save & Format"
1. Save file
2. Format document

*Suggested gesture: Checkmark (✓)*

### "Focus Mode"
1. Toggle Zen Mode
2. Hide Sidebar
3. Hide Panel

*Suggested gesture: Circle (○)*

### "Deploy"
1. Save All
2. Terminal: `npm run build`
3. Delay: 2000ms
4. Terminal: `npm run deploy`

*Suggested gesture: Arrow up (↑)*

### "Git Commit Flow"
1. Save All
2. Git: Stage All
3. Git: Commit

*Suggested gesture: Letter "G"*

---

## Extension Settings

This extension contributes the following commands:

* `shdraw.openExecutionCanvas`: Open the gesture execution canvas
* `shdraw.openConfigPanel`: Open the routine configuration panel

---

## Known Issues

- Gestures with very few points (less than 5) may not be recognized
- Very similar gestures might cause recognition conflicts (use the validation system)
- The canvas requires mouse/trackpad input (keyboard gestures not supported)

---

## Release Notes

### 0.0.1 - Initial Release
- Gesture-based routine automation
- Execution canvas for drawing gestures
- Configuration panel for creating routines
- Support for VS Code commands, terminal commands, and delays
- $1 Recognizer algorithm for gesture recognition
- Internationalization support (English, Spanish)

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## Contributing

Contributions are welcome! Here are some ways you can help:

### Feature Ideas
- [ ] Export/Import routines
- [ ] Share routines with team members
- [ ] Multi-touch gesture support
- [ ] Usage analytics and suggestions
- [ ] Cloud sync for routines

### Development
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/shdraw.git

# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run tests
npm run test

# Lint
npm run lint
```

---

## Acknowledgments

- Gesture recognition powered by the [$1 Recognizer](https://depts.washington.edu/acelab/proj/dollar/index.html) algorithm by the University of Washington
- Inspired by the need to automate repetitive tasks in VS Code

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/shdraw/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/shdraw/discussions)

---

<p align="center">
  <strong>Make your workflow more efficient with gestures!</strong><br>
  If you find ShDraw useful, please consider giving it a ⭐ on GitHub!
</p>
