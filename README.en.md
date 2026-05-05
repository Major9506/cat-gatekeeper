# Cat Gatekeeper

> A Tauri-based desktop app that reminds you to take breaks with cute cat videos. This project is a refactoring of the original Electron app, featuring a Rust backend and React frontend.

When your work time ends, a cute cat slides in from the side of the screen and then lies down to sleep—this adorable cat guardian will enforce HSE-recommended screen break times.

**Contributions are welcome!** Whether you want to fix bugs, add features, improve documentation, or share your favorite cat videos—all contributions are welcome. See [Contributing Guidelines](#contributing) below.

## ✨ Features

- **Cat Overlay** — Fun fullscreen break reminders with animated cats
- **Dual Video Lifecycle** — Active cat slides in, then transitions to sleeping cat
- **HSE Compliant** — Default 50-minute work / 5-minute break intervals
- **Customizable** — Adjust work/break intervals to your preference
- **System Tray** — Runs quietly in background with pause/resume controls
- **Multi-Monitor Support** — Works on all displays
- **Custom Videos** — Use your own cat videos (in development)
- **Snooze Feature** — Add 5 minutes when you're focused

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development mode
npm run tauri:dev
```

The app will start in your system tray. The cat will appear after 50 minutes (default) and rest for 5 minutes.

> The application includes real cat videos (`neko1.webm`, `neko2.webm`) and all required resources in the `assets/` directory by default. No additional setup required.

## 📥 Installation

### Download from Releases

For most users, we recommend downloading the latest version:

1. Visit the [Releases page](https://github.com/Major9506/cat-gatekeeper/releases)
2. Download the installer for your platform:
   - **Windows**: `.exe` installer
   - **macOS**: `.dmg` disk image
   - **Linux**: `.AppImage` file

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run dev` | Start development server (with hot reload) |
| `npm run build` | Build frontend application |
| `npm run tauri:dev` | Start Tauri development mode |
| `npm run tauri:build` | Build Tauri application |
| `npm run preview` | Preview build result |

## 🎮 How It Works

1. The app runs in the system tray with a background timer
2. When work time ends, fullscreen overlays are opened
3. The active cat video plays **once**, sliding in from the right side of the screen
4. When the active video ends, the cat transitions to a **sleeping** loop while showing a large countdown timer for remaining break time
5. Reminder text and controls appear at the bottom of the screen
6. After the break ends, overlays close and the timer resets
7. You can snooze (+5 minutes) or end the break early

## 🌍 Language Switching

The app supports both Chinese and English languages. You can switch languages as needed:

### Via Settings Interface
1. Right-click the tray icon and open **Settings**
2. Find the **Language** option
3. Select **Chinese** or **English**
4. Click **Save Settings**

The language setting takes effect immediately, and interface text will update to your chosen language.

## 📚 Document Language Switching

This documentation is available in two languages:
- **English**: [README.en.md](README.en.md) (this file)
- **Chinese**: [README.md](README.md)

You can switch between language versions by:
1. Opening `README.md` for Chinese documentation
2. Opening `README.en.md` for English documentation
3. Using the language switcher script: `node README.switch.js <language>`

### Using the Language Switcher Script
```bash
# Switch to Chinese
node README.switch.js zh

# Switch to English
node README.switch.js en

# View current language
node README.switch.js
```

## 🎨 Custom Cat Videos 🚧

### Through Settings Interface
1. Right-click the tray icon and open **Settings**
2. Scroll to **Custom Cat Video** and click **Browse...**
3. Select your MP4/WEBM/AVI/MOV file
4. Click **Save Settings**

> **Note:** This feature is currently in development. Basic video selection is implemented, but advanced features may be limited.

### By Replacing Default Files
The active cat video defaults to `src/assets/neko1.webm`. You can replace it with your own file (keeping the same name) or use the settings interface to select any video file. The sleeping cat (`neko2.webm`) is always bundled with the application.

### Video Guidelines
- **Best:** Dark or black background videos (blend with overlay)
- **Good:** Close-up cat faces without distracting backgrounds
- **Avoid:** Green screen videos — chroma key removal feature is in development
- **Active Cat:** WEBM or MP4 (ideally short, 5-15 seconds, plays once)
- **Recommendation:** Active video uses walking cat, sleeping video uses resting cat

### Processing green screen videos to dark background using ffmpeg:

```bash
ffmpeg -i your_greenscreen.mp4 -vf "colorkey=0x00FF00:0.3:0.1,format=yuv420p" \
  -c:v libx264 -pix_fmt yuv420p src/assets/cat_processed.mp4
```

## 💻 Tech Stack

- **Tauri** — Cross-platform desktop framework with Rust backend
- **React** — Frontend UI library
- **TypeScript** — Type-safe JavaScript
- **Vite** — Fast build tool
- **i18next** — Internationalization support
- **Tailwind CSS** — Utility-first CSS framework

## 📁 Project Structure

```
cat-gatekeeper/
├── src/                    # React Frontend
│   ├── components/         # React Components
│   │   ├── BreakOverlay.tsx    # Break Overlay
│   │   ├── SettingsPanel.tsx   # Settings Panel
│   │   └── TrayApp.tsx         # System Tray Component
│   ├── i18n/              # Internationalization Files
│   │   ├── index.ts            # i18n Initialization
│   │   └── locales/            # Translation Files
│   │       ├── zh.json         # Chinese Translation
│   │       └── en.json         # English Translation
│   ├── tauri/             # Tauri API Integration
│   ├── App.tsx            # Main App Component
│   ├── main.tsx           # App Entry Point
│   └── index.css          # Global Styles
├── src-tauri/             # Tauri Backend
│   ├── src/
│   │   ├── main.rs           # Main Rust Code
│   │   └── lib.rs            # Rust Library
│   ├── Cargo.toml         # Rust Dependencies
│   └── tauri.conf.json    # Tauri Configuration
├── assets/                # Static Resources
│   ├── neko1.webm        # Active Cat Video
│   ├── neko2.webm        # Sleeping Cat Video
│   └── icon.png          # App Icon
├── package.json           # Node.js Dependencies
├── vite.config.ts        # Vite Configuration
├── tailwind.config.js    # Tailwind CSS Configuration
├── tsconfig.json         # TypeScript Configuration
├── README.md              # Chinese Documentation
├── README.en.md           # English Documentation
└── README.switch.js       # Language Switcher Script
```

## ⚙️ Default Settings

| Setting | Default Value | Range |
|---------|---------------|-------|
| Work Interval | 50 minutes | 5-120 minutes |
| Break Duration | 5 minutes (300 seconds) | 1-10 minutes (60-600 seconds) |
| Snooze Duration | 5 minutes (300 seconds) | Configurable |
| Sound Effect | Disabled | On/Off |
| Multi-Monitor | Enabled | On/Off |
| Cat Video | Bundled neko1.webm (active) + neko2.webm (sleeping) | User-selectable |

## 📦 Building for Distribution

### Windows
```bash
npm run tauri:build -- --target x86_64-pc-windows-msvc
```
Generates NSIS installer in `src-tauri/target/release/bundle/msi/`.

### macOS
```bash
npm run tauri:build -- --target x86_64-apple-darwin
```
Generates DMG in `src-tauri/target/release/bundle/dmg/`.

### Linux
```bash
npm run tauri:build -- --target x86_64-unknown-linux-gnu
```
Generates AppImage in `src-tauri/target/release/bundle/appimage/`.

## 🧪 Development Mode

For quick testing:

```bash
npm run tauri:dev
```

This will start the app in development mode.

## 🤝 Contributing

We welcome all contributions! Whether you're fixing bugs, adding features, improving documentation, or sharing cat videos—every contribution matters.

### How to Contribute

- 🐛 **Report Bugs** — Found something wrong? [Open an issue](https://github.com/Major9506/cat-gatekeeper/issues)
- 💡 **Suggest Features** — Got an idea? We'd love to hear it
- 📝 **Improve Documentation** — Better docs help everyone
- 🎨 **Design** — UI/UX improvements, icons, animations
- 🐱 **Cat Videos** — Share your cat videos for the overlay
- 💻 **Code** — Fix bugs, build features, optimize performance

### Getting Started

1. **Fork** this repository
2. **Create your feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly** — Use `npm run tauri:dev` for quick testing
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test on multiple platforms when possible (Windows, macOS, Linux)
- Update documentation when adding features
- Keep Pull Requests focused — one feature/fix per PR

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[ぞくぞく](https://x.com/konekone2026)** — Creator of the original [Cat Gatekeeper Chrome extension](https://chromewebstore.google.com/detail/cat-gatekeeper/elbikiflgfhjdjmficnigpeegjbhdidh) designed to limit social media use. This Tauri desktop app is inspired by their brilliant idea, adapted to follow HSE screen break guidelines.
- HSE (Health and Safety Executive) screen break recommendations
- All the cats who inspired this project 🐱

## 📬 Contact & Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Major9506/cat-gatekeeper/issues)
- 💬 **Questions**: [Discussions](https://github.com/Major9506/cat-gatekeeper/discussions)

---

**Made with ❤️ for cats and healthy screen habits**