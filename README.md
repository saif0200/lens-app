# Lens

A lightweight, AI-powered desktop assistant with screen capture capabilities. Get instant AI help with what's on your screen using OpenAI or Google Gemini.

[![Build](https://github.com/saif/lens-app/actions/workflows/build.yml/badge.svg)](https://github.com/saif/lens-app/actions/workflows/build.yml)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)

## About

Lens is a floating desktop application that provides quick access to AI assistants. Capture your screen, attach files, and get intelligent responses - all from a minimal, always-accessible overlay window.

**Key highlights:**
- **Multi-provider support** - Switch between OpenAI (GPT-5) and Google Gemini models
- **Screen capture** - Share your screen with AI for visual context
- **Privacy-focused** - Content protection mode makes the window invisible in screenshots
- **Keyboard-first** - Global shortcuts for quick access without touching the mouse

## Features

### AI Capabilities
- **Multiple AI Providers** - OpenAI GPT-5 (nano, mini, 5.1, Codex) and Google Gemini (2.5 Flash, Flash-Lite, 3 Pro Preview)
- **Web Search** - AI can search the web for current information (auto-detects when needed)
- **Reasoning Modes** - Adjustable thinking depth (low, medium, high) for complex problems
- **Extended Thinking** - View the AI's reasoning process with expandable thought sections

### Input Methods
- **Screen Capture** - Capture and analyze your entire screen
- **File Attachments** - Attach code files, images, PDFs, and documents
- **Paste Support** - Paste images directly from clipboard

### User Experience
- **Floating Window** - Always-on-top overlay that stays accessible
- **Content Protection** - Hide the window from screen recordings and screenshots
- **Markdown Rendering** - Rich formatting with syntax highlighting and math equations
- **Copy Support** - One-click copy for AI responses and code blocks

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Tauri 2, Rust |
| AI SDKs | OpenAI SDK, Google GenAI SDK |
| UI | React Markdown, React Syntax Highlighter, MathJax |

## Getting Started

### Prerequisites

- **Node.js** 20 or higher
- **Rust** (stable toolchain) - Install via [rustup](https://rustup.rs/)
- **API Keys** - At least one of:
  - [OpenAI API Key](https://platform.openai.com/api-keys)
  - [Google Gemini API Key](https://aistudio.google.com/apikey)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/saif/lens-app.git
   cd lens-app
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:
   ```env
   VITE_OPENAI_API_KEY=your-openai-api-key
   VITE_GOOGLE_GENAI_API_KEY=your-gemini-api-key
   ```

4. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

## Configuration

### API Keys

You can configure API keys in two ways:

1. **Environment variables** (`.env` file) - Set at build time
2. **Settings window** - Configure at runtime via the app's settings panel

Open settings with the menu button or `Ctrl+S` (Windows) / `Cmd+S` (macOS).

### Content Protection

Enable **Content Protection** in settings to make the Lens window invisible in:
- Screenshots
- Screen recordings
- Screen sharing applications

This is useful when you want to use Lens while sharing your screen without revealing the AI conversation.

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+\` / `Cmd+\` | Toggle window visibility |
| `Ctrl+Enter` / `Cmd+Enter` | Send message / Ask |
| `Ctrl+S` / `Cmd+S` | Open settings |
| `Ctrl++` / `Cmd++` | Zoom in |
| `Ctrl+-` / `Cmd+-` | Zoom out |
| `Ctrl+0` / `Cmd+0` | Reset zoom |

### Capturing Your Screen

1. Click the screen share button or press `Ctrl+S`
2. Your screen will be captured automatically
3. Type your question about what's on screen
4. Press `Ctrl+Enter` or click Ask

### Attaching Files

- **Drag and drop** files onto the window
- **Paste** images from clipboard (`Ctrl+V`)
- **Click** the attachment area to browse files

Supported formats: Images, code files (.js, .ts, .py, .rs, etc.), text files, PDFs

### Switching AI Providers

Click the provider toggle in the toolbar to switch between:
- **Gemini** - Google's Gemini models
- **OpenAI** - GPT-5 models

Each provider has its own model selector for choosing specific models.

### Using Web Search

Web search is **automatically enabled** when your message:
- Contains URLs
- Includes phrases like "search for", "look up", "what's the latest"

You can also manually toggle web search using the search button.

### Reasoning Modes

Cycle through reasoning effort levels by clicking the brain icon:
- **Low** - Quick responses
- **Medium** - Balanced thinking
- **High** - Deep analysis for complex problems

Some models (like Gemini 3 Pro) display their thinking process in expandable sections.

## Building for Production

### Build Command

```bash
npm run tauri build
```

This compiles the frontend and Rust backend, then bundles everything into platform-specific installers.

### Build Output

| Platform | Output Location | Formats |
|----------|-----------------|---------|
| Windows | `src-tauri/target/release/bundle/` | MSI, NSIS installer |
| macOS | `src-tauri/target/release/bundle/` | DMG, APP bundle |

### Platform-Specific Notes

**Windows:**
- Requires Visual Studio Build Tools with C++ workload
- Produces both MSI and NSIS installers

**macOS:**
- Requires Xcode Command Line Tools
- App runs as an accessory (no dock icon)

## Project Structure

```
lens-app/
├── src/                    # Frontend (React/TypeScript)
│   ├── App.tsx            # Main chat interface
│   ├── Settings.tsx       # Settings panel
│   ├── ai.ts              # AI provider routing
│   ├── openai.ts          # OpenAI integration
│   ├── gemini.ts          # Gemini integration
│   ├── types.ts           # TypeScript interfaces
│   └── *.css              # Styles
├── src-tauri/             # Backend (Rust/Tauri)
│   ├── src/
│   │   ├── lib.rs         # Tauri commands & window management
│   │   └── main.rs        # Entry point
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── index.html             # Main window entry
├── settings.html          # Settings window entry
├── package.json           # Node dependencies
├── vite.config.ts         # Vite build config
└── .env                   # Environment variables (create this)
```

## Contributing

Contributions are welcome! Here's how to get started:

### Development Workflow

1. **Fork the repository** and clone your fork
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and test thoroughly
4. **Commit** with clear, descriptive messages
5. **Push** to your fork and open a Pull Request

### Code Style

- **TypeScript** - Follow existing patterns, use strict types
- **Rust** - Run `cargo fmt` before committing
- **CSS** - Use existing class naming conventions

### Running Tests

```bash
# Frontend type checking
npm run build

# Rust checks
cd src-tauri && cargo check
```

### Reporting Issues

When reporting bugs, please include:
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## Acknowledgments

Built with these excellent open-source projects:

- [Tauri](https://tauri.app/) - Desktop application framework
- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [React Markdown](https://github.com/remarkjs/react-markdown) - Markdown rendering
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) - Code highlighting
- [MathJax](https://www.mathjax.org/) - Math equation rendering
