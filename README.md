# Typeless (Clone)

A voice-to-text transcription tool inspired by [Typeless](https://typeless.com). Press a hotkey to record your voice, and the transcribed text is automatically inserted at your cursor position.

## Features

- **Global Hotkey (F2)**: Toggle recording on/off from any application
- **Voice Transcription**: Uses OpenAI Whisper API for accurate speech-to-text
- **Auto Text Injection**: Transcribed text is automatically pasted at your cursor position
- **Floating Overlay**: Minimal status indicator shows recording/transcribing/done states
- **System Tray**: Runs in the background with tray icon and menu
- **Waveform Animation**: Visual feedback during recording with animated audio bars

## Prerequisites

- **Node.js** 18+
- **macOS** (currently macOS only for text injection via osascript)
- **OpenAI API Key** for Whisper transcription

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. **Set your OpenAI API Key**:
   - Copy your API key (starting with `sk-`) to your clipboard
   - Right-click the tray icon and select "Set OpenAI API Key..."
   - Click OK (the app reads the key from your clipboard)

## Usage

1. Place your cursor in any text input field
2. Press **F2** to start recording
3. Speak naturally
4. Press **F2** again to stop recording
5. Wait for transcription (you'll see "Transcribing..." in the overlay)
6. The transcribed text is automatically pasted at your cursor position

## macOS Permissions

The app requires:

- **Microphone**: For audio recording
- **Accessibility**: For simulating keyboard paste (Cmd+V)

Grant these in **System Preferences > Security & Privacy > Privacy**.

## Architecture

- **Electron** + **Vite** + **React** + **TypeScript**
- **Main Process**: Global shortcut management, Whisper API calls, text injection, system tray
- **Renderer Process**: Audio recording (MediaRecorder), overlay UI, state management (Zustand)
- **IPC Bridge**: Secure communication between main and renderer via contextBridge

## Project Structure

```
src/
├── main.ts                          # Main process entry
├── preload.ts                       # IPC bridge (contextBridge)
├── renderer.ts                      # Renderer entry (React bootstrap)
├── index.css                        # Styles (Typeless-inspired design)
├── main/
│   ├── shortcut-manager.ts          # Global hotkey (F2) management
│   ├── transcription-service.ts     # OpenAI Whisper API integration
│   ├── text-injector.ts             # Clipboard + paste simulation
│   ├── tray-manager.ts              # System tray icon and menu
│   ├── config-store.ts              # Persistent settings (electron-store)
│   ├── ipc-handlers.ts              # IPC event handlers
│   └── overlay-window.ts            # Floating status window config
├── renderer/
│   ├── App.tsx                      # Root React component
│   ├── components/
│   │   ├── Overlay.tsx              # Status overlay UI
│   │   └── WaveformAnimation.tsx    # Audio waveform visualization
│   ├── services/
│   │   └── audio-recorder.ts        # MediaRecorder wrapper
│   └── stores/
│       └── app-store.ts             # Zustand state management
└── shared/
    ├── constants.ts                 # IPC channel names, defaults
    └── types.ts                     # Shared TypeScript types
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop Framework | Electron 40 |
| Build Tool | Electron Forge + Vite |
| UI Framework | React 19 |
| Language | TypeScript 5 |
| State Management | Zustand |
| Speech-to-Text | OpenAI Whisper API |
| Storage | electron-store |
