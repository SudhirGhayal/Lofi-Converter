# ♫ LoFi Studio

> **Transform any song into a warm, vintage lo-fi version — entirely in your browser.**

🌐 **Live Demo**: [lofi-converter.netlify.app](https://lofi-converter.netlify.app)

---

## ✨ What is LoFi Studio?

LoFi Studio is a browser-based audio converter that takes any MP3 or WAV file and applies a suite of lo-fi effects — giving your music that warm, nostalgic, bedroom-studio sound. No sign-up. No uploads to a server. Everything happens locally on your device.

---

## 🎛️ Features

- 🎵 **Drag & Drop Upload** — supports MP3 and WAV files up to 50 MB
- 🔊 **Real-time Lo-Fi Effects** powered by the Web Audio API:
  - **Lo-Pass Filter** — muffles high frequencies for that muted lo-fi tone
  - **Vinyl Crackle** — adds authentic record noise
  - **Warmth** — tape saturation simulation
  - **Reverb** — adds room echo and depth
  - **Wobble** — subtle pitch variation like a worn cassette tape
- 📊 **Live Waveform Visualizer** — animated canvas that reacts to your audio
- 🎚️ **Adjustable FX Sliders** — fine-tune every effect to your taste
- ⬇️ **Download Your Lo-Fi Track** — export the processed audio directly to your device
- 🔒 **100% Private** — your audio never leaves your device

---

## 🚀 Getting Started

### Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/lofi-studio.git

# Navigate into the project
cd lofi-studio

# Open in browser (no build step needed)
open index.html
```

> No dependencies or build tools required — it's plain HTML, CSS, and JavaScript.

---

## 🛠️ How It Works

LoFi Studio uses the **Web Audio API** to build a real-time audio processing pipeline:

```
Your Song (MP3/WAV)
       ↓
AudioContext decodes the file
       ↓
Signal passes through FX chain:
  → BiquadFilterNode    (Lo-Pass)
  → ConvolverNode       (Reverb)
  → WaveShaperNode      (Warmth/Saturation)
  → OscillatorNode      (Wobble)
  → BufferSourceNode    (Vinyl Crackle)
       ↓
MediaRecorder captures processed output
       ↓
Download as audio file 🎵
```

---

## 🎨 UI & Design

- Dark, moody aesthetic inspired by late-night jazz and bedroom studios
- Warm amber and charcoal color palette
- Smooth animations and an intuitive slider-based controls panel
- Fully responsive for desktop and mobile

---

## 🧰 Tech Stack

| Technology | Usage |
|---|---|
| HTML / CSS / JavaScript | Core structure and styling |
| Web Audio API | Real-time audio effects engine |
| Canvas API | Live waveform visualizer |
| MediaRecorder API | Capturing and downloading processed audio |
| Netlify | Hosting and deployment |

---

## 📁 Project Structure

```
lofi-studio/
├── index.html        # Main app entry point
├── style.css         # Styles and animations
├── app.js            # Audio processing logic
└── README.md
```

---

## 🔮 Roadmap

- [ ] Add BPM slowdown slider
- [ ] Support YouTube URL input
- [ ] Preset packs (Rainy Day, Midnight Study, Café Vibes)
- [ ] Mobile app version (PWA)
- [ ] More export formats (MP3, OGG)

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "Add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- Built with the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- Deployed on [Netlify](https://netlify.com)
- Inspired by the lo-fi hip hop community 🎧

---

<p align="center">Made with ♥ and late-night coffee ☕</p>
