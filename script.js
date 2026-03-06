/* ============================================
   LoFi Studio — Audio Engine & UI Controller
   ============================================ */

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────────────
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const removeFile = document.getElementById('removeFile');
  const uploadSection = document.getElementById('uploadSection');
  const studioSection = document.getElementById('studioSection');

  const vinylRecord = document.getElementById('vinylRecord');
  const tonearm = document.getElementById('tonearm');
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  const btnStop = document.getElementById('btnStop');
  const btnDownload = document.getElementById('btnDownload');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');

  const waveformCanvas = document.getElementById('waveformCanvas');
  const waveformCtx = waveformCanvas.getContext('2d');
  const particlesCanvas = document.getElementById('particlesCanvas');
  const particlesCtx = particlesCanvas.getContext('2d');

  const downloadOverlay = document.getElementById('downloadOverlay');
  const cancelDownload = document.getElementById('cancelDownload');

  // Sliders
  const sliderLopass = document.getElementById('sliderLopass');
  const sliderCrackle = document.getElementById('sliderCrackle');
  const sliderWarmth = document.getElementById('sliderWarmth');
  const sliderReverb = document.getElementById('sliderReverb');
  const sliderWobble = document.getElementById('sliderWobble');
  const valLopass = document.getElementById('valLopass');
  const valCrackle = document.getElementById('valCrackle');
  const valWarmth = document.getElementById('valWarmth');
  const valReverb = document.getElementById('valReverb');
  const valWobble = document.getElementById('valWobble');

  // ── State ───────────────────────────────────────────────────
  let audioContext = null;
  let audioBuffer = null;
  let sourceNode = null;
  let isPlaying = false;
  let startTime = 0;
  let pauseOffset = 0;
  let animFrameId = null;
  let downloadRecorder = null;
  let downloadCancelled = false;

  // Audio nodes
  let lowpassFilter = null;
  let crackleGain = null;
  let crackleSource = null;
  let reverbGain = null;
  let dryGain = null;
  let convolver = null;
  let saturation = null;
  let wobbleLfo = null;
  let wobbleGain = null;
  let wobbleDelay = null;
  let analyser = null;
  let masterGain = null;

  // ── Particles ───────────────────────────────────────────────
  const particles = [];
  const PARTICLE_COUNT = 60;

  function initParticles() {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * particlesCanvas.width,
        y: Math.random() * particlesCanvas.height,
        r: Math.random() * 2.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: -(Math.random() * 0.2 + 0.05),
        opacity: Math.random() * 0.35 + 0.1,
      });
    }
  }

  function drawParticles() {
    particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    for (const p of particles) {
      particlesCtx.beginPath();
      particlesCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      particlesCtx.fillStyle = `rgba(245, 230, 200, ${p.opacity})`;
      particlesCtx.fill();

      p.x += p.dx;
      p.y += p.dy;

      if (p.y < -10) {
        p.y = particlesCanvas.height + 10;
        p.x = Math.random() * particlesCanvas.width;
      }
      if (p.x < -10) p.x = particlesCanvas.width + 10;
      if (p.x > particlesCanvas.width + 10) p.x = -10;
    }
    requestAnimationFrame(drawParticles);
  }

  window.addEventListener('resize', () => {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
  });

  initParticles();
  drawParticles();

  // ── Drag & Drop ─────────────────────────────────────────────
  // Only trigger file dialog when clicking the zone itself, not when
  // the <label for="fileInput"> "Browse Files" button is clicked (it
  // already opens the dialog natively).
  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('label[for="fileInput"]')) return; // label handles it
    fileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  removeFile.addEventListener('click', () => {
    resetAudio();
    fileInfo.classList.add('hidden');
    studioSection.classList.add('hidden');
    dropZone.style.display = '';
    fileInput.value = '';
  });

  // ── File Handling ───────────────────────────────────────────
  function handleFile(file) {
    if (!file.type.match(/audio\/(mpeg|wav|mp3|x-wav)/)) {
      alert('Please upload an MP3 or WAV file.');
      return;
    }

    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
    dropZone.style.display = 'none';

    const reader = new FileReader();
    reader.onload = async (e) => {
      await initAudioContext();
      try {
        audioBuffer = await audioContext.decodeAudioData(e.target.result);
        totalTimeEl.textContent = formatTime(audioBuffer.duration);
        studioSection.classList.remove('hidden');
        setupAudioGraph();
      } catch (err) {
        alert('Could not decode audio file. Please try a different file.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Audio Context & Graph ───────────────────────────────────
  async function initAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  }

  function setupAudioGraph() {
    // Analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Lo-pass filter
    lowpassFilter = audioContext.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = parseFloat(sliderLopass.value);
    lowpassFilter.Q.value = 1.0;

    // Tape saturation (waveshaper)
    saturation = audioContext.createWaveShaper();
    updateSaturation(parseInt(sliderWarmth.value));

    // Reverb (convolver)
    convolver = audioContext.createConvolver();
    convolver.buffer = createReverbIR(2.5, 3.0);
    reverbGain = audioContext.createGain();
    reverbGain.gain.value = parseInt(sliderReverb.value) / 100 * 0.7;
    dryGain = audioContext.createGain();
    dryGain.gain.value = 1.0;

    // Wobble (LFO → delay)
    wobbleDelay = audioContext.createDelay(0.05);
    wobbleDelay.delayTime.value = 0.003;
    wobbleLfo = audioContext.createOscillator();
    wobbleLfo.type = 'sine';
    wobbleLfo.frequency.value = 0.4;
    wobbleGain = audioContext.createGain();
    wobbleGain.gain.value = parseInt(sliderWobble.value) / 100 * 0.003;
    wobbleLfo.connect(wobbleGain);
    wobbleGain.connect(wobbleDelay.delayTime);
    wobbleLfo.start();

    // Vinyl crackle — starts MUTED; unmuted only during playback
    const crackleBuffer = createCrackleBuffer();
    crackleSource = audioContext.createBufferSource();
    crackleSource.buffer = crackleBuffer;
    crackleSource.loop = true;
    crackleGain = audioContext.createGain();
    crackleGain.gain.value = 0; // silent until user presses play
    crackleSource.connect(crackleGain);
    crackleGain.connect(audioContext.destination);
    crackleSource.start();

    // Master gain
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.85;

    // Update waveform canvas size
    waveformCanvas.width = waveformCanvas.offsetWidth * window.devicePixelRatio;
    waveformCanvas.height = waveformCanvas.offsetHeight * window.devicePixelRatio;
    waveformCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  function connectSourceToGraph(src, dest) {
    // source → lowpass → saturation → wobbleDelay → dry branch + reverb branch → analyser → master → dest
    src.connect(lowpassFilter);
    lowpassFilter.connect(saturation);
    saturation.connect(wobbleDelay);

    // Dry path
    wobbleDelay.connect(dryGain);
    dryGain.connect(analyser);

    // Reverb path
    wobbleDelay.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(analyser);

    analyser.connect(masterGain);
    masterGain.connect(dest);
  }

  // ── Audio Effects Generators ────────────────────────────────
  function createCrackleBuffer() {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * 4; // 4 seconds, looped
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      // Sparse, subtle pops and crackles
      if (Math.random() < 0.001) {
        data[i] = (Math.random() - 0.5) * 0.8;
      } else if (Math.random() < 0.008) {
        data[i] = (Math.random() - 0.5) * 0.15;
      } else {
        data[i] = (Math.random() - 0.5) * 0.008;
      }
    }
    return buffer;
  }

  function createReverbIR(duration, decay) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function updateSaturation(warmthValue) {
    const amount = warmthValue / 100;
    const samples = 8192;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping with adjustable drive
      const drive = 1 + amount * 4;
      curve[i] = (Math.PI + drive) * x / (Math.PI + drive * Math.abs(x));
    }
    saturation.curve = curve;
    saturation.oversample = '4x';
  }

  // ── Playback Controls ──────────────────────────────────────
  btnPlay.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    play();
  });

  btnPause.addEventListener('click', () => {
    if (!isPlaying) return;
    pause();
  });

  btnStop.addEventListener('click', () => {
    stop();
  });

  function play() {
    if (isPlaying) return;

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.onended = () => {
      if (isPlaying) {
        stop();
      }
    };

    connectSourceToGraph(sourceNode, audioContext.destination);
    sourceNode.start(0, pauseOffset);
    startTime = audioContext.currentTime - pauseOffset;
    isPlaying = true;

    // Unmute crackle while playing
    if (crackleGain) crackleGain.gain.setTargetAtTime(parseInt(sliderCrackle.value) / 100 * 0.08, audioContext.currentTime, 0.01);

    btnPlay.classList.add('hidden');
    btnPause.classList.remove('hidden');
    vinylRecord.classList.add('spinning');
    tonearm.classList.add('active');

    drawWaveform();
    updateProgress();
  }

  function pause() {
    if (!isPlaying) return;
    pauseOffset = audioContext.currentTime - startTime;
    sourceNode.onended = null;
    sourceNode.stop();
    sourceNode.disconnect();
    isPlaying = false;

    // Mute crackle while paused so no audio leaks
    if (crackleGain) crackleGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);

    btnPause.classList.add('hidden');
    btnPlay.classList.remove('hidden');
    vinylRecord.classList.remove('spinning');
    tonearm.classList.remove('active');

    cancelAnimationFrame(animFrameId);
  }

  function stop() {
    if (sourceNode) {
      sourceNode.onended = null;
      try { sourceNode.stop(); } catch (e) { /* already stopped */ }
      sourceNode.disconnect();
    }
    isPlaying = false;
    pauseOffset = 0;

    // Mute crackle on stop
    if (crackleGain) crackleGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);

    btnPause.classList.add('hidden');
    btnPlay.classList.remove('hidden');
    vinylRecord.classList.remove('spinning');
    tonearm.classList.remove('active');

    progressFill.style.width = '0%';
    currentTimeEl.textContent = '0:00';
    cancelAnimationFrame(animFrameId);

    // Clear waveform
    const w = waveformCanvas.offsetWidth;
    const h = waveformCanvas.offsetHeight;
    waveformCtx.clearRect(0, 0, w, h);
  }

  function resetAudio() {
    stop();
    if (crackleSource) {
      try { crackleSource.stop(); } catch (e) { }
    }
    if (wobbleLfo) {
      try { wobbleLfo.stop(); } catch (e) { }
    }
    audioBuffer = null;
    // Reset the audio nodes — they'll be recreated on next file load
    lowpassFilter = null;
    crackleGain = null;
    crackleSource = null;
    reverbGain = null;
    dryGain = null;
    convolver = null;
    saturation = null;
    wobbleLfo = null;
    wobbleGain = null;
    wobbleDelay = null;
    analyser = null;
    masterGain = null;
  }

  // ── Progress ────────────────────────────────────────────────
  function updateProgress() {
    if (!isPlaying) return;
    const elapsed = audioContext.currentTime - startTime;
    const duration = audioBuffer.duration;
    const pct = Math.min((elapsed / duration) * 100, 100);
    progressFill.style.width = pct + '%';
    currentTimeEl.textContent = formatTime(elapsed);

    animFrameId = requestAnimationFrame(updateProgress);
  }

  progressBar.addEventListener('click', (e) => {
    if (!audioBuffer) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTime = pct * audioBuffer.duration;

    const wasPlaying = isPlaying;
    if (isPlaying) {
      sourceNode.onended = null;
      sourceNode.stop();
      sourceNode.disconnect();
      isPlaying = false;
    }

    pauseOffset = seekTime;
    progressFill.style.width = (pct * 100) + '%';
    currentTimeEl.textContent = formatTime(seekTime);

    if (wasPlaying) {
      play();
    }
  });

  // ── Waveform Visualizer ─────────────────────────────────────
  function drawWaveform() {
    if (!isPlaying || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const w = waveformCanvas.offsetWidth;
    const h = waveformCanvas.offsetHeight;

    waveformCtx.clearRect(0, 0, w, h);

    const barCount = Math.min(bufferLength, 64);
    const barWidth = (w / barCount) * 0.7;
    const gap = (w / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      const val = dataArray[i] / 255;
      const barHeight = val * h * 0.85;
      const x = i * (barWidth + gap) + gap / 2;

      // Gradient from amber to rose
      const gradient = waveformCtx.createLinearGradient(0, h, 0, h - barHeight);
      gradient.addColorStop(0, 'rgba(232, 160, 69, 0.8)');
      gradient.addColorStop(0.5, 'rgba(201, 115, 138, 0.6)');
      gradient.addColorStop(1, 'rgba(201, 115, 138, 0.2)');

      waveformCtx.fillStyle = gradient;
      waveformCtx.beginPath();
      waveformCtx.roundRect(x, h - barHeight, barWidth, barHeight, 3);
      waveformCtx.fill();

      // Glow
      waveformCtx.shadowColor = 'rgba(232, 160, 69, 0.3)';
      waveformCtx.shadowBlur = 8;
    }
    waveformCtx.shadowBlur = 0;

    requestAnimationFrame(drawWaveform);
  }

  // ── Slider Event Handlers ──────────────────────────────────
  sliderLopass.addEventListener('input', () => {
    const val = parseFloat(sliderLopass.value);
    valLopass.textContent = val >= 1000 ? (val / 1000).toFixed(1) + ' kHz' : val + ' Hz';
    if (lowpassFilter) {
      lowpassFilter.frequency.setTargetAtTime(val, audioContext.currentTime, 0.02);
    }
  });

  sliderCrackle.addEventListener('input', () => {
    const val = parseInt(sliderCrackle.value);
    valCrackle.textContent = val + '%';
    // Only apply gain change if currently playing; otherwise it stays muted
    if (crackleGain && isPlaying) {
      crackleGain.gain.setTargetAtTime(val / 100 * 0.08, audioContext.currentTime, 0.02);
    }
  });

  sliderWarmth.addEventListener('input', () => {
    const val = parseInt(sliderWarmth.value);
    valWarmth.textContent = val + '%';
    if (saturation) {
      updateSaturation(val);
    }
  });

  sliderReverb.addEventListener('input', () => {
    const val = parseInt(sliderReverb.value);
    valReverb.textContent = val + '%';
    if (reverbGain) {
      reverbGain.gain.setTargetAtTime(val / 100 * 0.7, audioContext.currentTime, 0.02);
    }
  });

  sliderWobble.addEventListener('input', () => {
    const val = parseInt(sliderWobble.value);
    valWobble.textContent = val + '%';
    if (wobbleGain) {
      wobbleGain.gain.setTargetAtTime(val / 100 * 0.003, audioContext.currentTime, 0.02);
    }
  });

  // ── Download (Offline Rendering — instant) ─────────────────
  btnDownload.addEventListener('click', async () => {
    if (!audioBuffer) return;
    downloadCancelled = false;

    // Stop current playback
    stop();

    // Show overlay
    downloadOverlay.classList.remove('hidden');

    try {
      // Create an offline context matching the source audio
      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length;
      const channels = audioBuffer.numberOfChannels;
      const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);

      // ── Rebuild the effect chain in the offline context ──

      // Lo-pass
      const offLopass = offlineCtx.createBiquadFilter();
      offLopass.type = 'lowpass';
      offLopass.frequency.value = parseFloat(sliderLopass.value);
      offLopass.Q.value = 1.0;

      // Saturation
      const offSaturation = offlineCtx.createWaveShaper();
      const warmthAmt = parseInt(sliderWarmth.value) / 100;
      const satSamples = 8192;
      const satCurve = new Float32Array(satSamples);
      for (let i = 0; i < satSamples; i++) {
        const x = (i * 2) / satSamples - 1;
        const drive = 1 + warmthAmt * 4;
        satCurve[i] = (Math.PI + drive) * x / (Math.PI + drive * Math.abs(x));
      }
      offSaturation.curve = satCurve;
      offSaturation.oversample = '4x';

      // Wobble
      const offWobbleDelay = offlineCtx.createDelay(0.05);
      offWobbleDelay.delayTime.value = 0.003;
      const offWobbleLfo = offlineCtx.createOscillator();
      offWobbleLfo.type = 'sine';
      offWobbleLfo.frequency.value = 0.4;
      const offWobbleGain = offlineCtx.createGain();
      offWobbleGain.gain.value = parseInt(sliderWobble.value) / 100 * 0.003;
      offWobbleLfo.connect(offWobbleGain);
      offWobbleGain.connect(offWobbleDelay.delayTime);
      offWobbleLfo.start();

      // Reverb
      const offConvolver = offlineCtx.createConvolver();
      const irDuration = 2.5, irDecay = 3.0;
      const irLen = sampleRate * irDuration;
      const irBuf = offlineCtx.createBuffer(2, irLen, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = irBuf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, irDecay);
        }
      }
      offConvolver.buffer = irBuf;
      const offReverbGain = offlineCtx.createGain();
      offReverbGain.gain.value = parseInt(sliderReverb.value) / 100 * 0.7;
      const offDryGain = offlineCtx.createGain();
      offDryGain.gain.value = 1.0;

      // Crackle — subtle vinyl texture
      const crackleLen = sampleRate * 4;
      const crackleBuf = offlineCtx.createBuffer(1, crackleLen, sampleRate);
      const crackleData = crackleBuf.getChannelData(0);
      for (let i = 0; i < crackleLen; i++) {
        if (Math.random() < 0.001) crackleData[i] = (Math.random() - 0.5) * 0.8;
        else if (Math.random() < 0.008) crackleData[i] = (Math.random() - 0.5) * 0.15;
        else crackleData[i] = (Math.random() - 0.5) * 0.008;
      }
      const offCrackleSource = offlineCtx.createBufferSource();
      offCrackleSource.buffer = crackleBuf;
      offCrackleSource.loop = true;
      const offCrackleGain = offlineCtx.createGain();
      offCrackleGain.gain.value = parseInt(sliderCrackle.value) / 100 * 0.08;
      offCrackleSource.connect(offCrackleGain);
      offCrackleGain.connect(offlineCtx.destination);

      // Master
      const offMaster = offlineCtx.createGain();
      offMaster.gain.value = 0.85;

      // Source
      const offSource = offlineCtx.createBufferSource();
      offSource.buffer = audioBuffer;

      // Connect: source → lopass → saturation → wobble → dry + reverb → master → dest
      offSource.connect(offLopass);
      offLopass.connect(offSaturation);
      offSaturation.connect(offWobbleDelay);
      offWobbleDelay.connect(offDryGain);
      offDryGain.connect(offMaster);
      offWobbleDelay.connect(offConvolver);
      offConvolver.connect(offReverbGain);
      offReverbGain.connect(offMaster);
      offMaster.connect(offlineCtx.destination);

      // Start sources
      offSource.start(0);
      offCrackleSource.start(0);

      // Render offline (instant!)
      const renderedBuffer = await offlineCtx.startRendering();

      if (downloadCancelled) return;

      // Encode to MP3 and trigger download
      const mp3Blob = audioBufferToMp3(renderedBuffer);
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lofi-version.mp3';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed. Please try again.');
    } finally {
      downloadOverlay.classList.add('hidden');
    }
  });

  cancelDownload.addEventListener('click', () => {
    downloadCancelled = true;
    downloadOverlay.classList.add('hidden');
  });

  // ── MP3 Encoder (using lamejs) ──────────────────────────────
  function audioBufferToMp3(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const kbps = 192; // good quality
    const samples = buffer.length;

    // Convert float samples to Int16
    const left = floatTo16Bit(buffer.getChannelData(0));
    const right = numChannels > 1 ? floatTo16Bit(buffer.getChannelData(1)) : left;

    const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
    const mp3Data = [];
    const blockSize = 1152; // must be multiple of 576 for lamejs

    for (let i = 0; i < samples; i += blockSize) {
      const leftChunk = left.subarray(i, i + blockSize);
      const rightChunk = right.subarray(i, i + blockSize);

      let mp3buf;
      if (numChannels === 1) {
        mp3buf = mp3Encoder.encodeBuffer(leftChunk);
      } else {
        mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      }
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // Flush remaining
    const end = mp3Encoder.flush();
    if (end.length > 0) {
      mp3Data.push(end);
    }

    return new Blob(mp3Data, { type: 'audio/mpeg' });
  }

  function floatTo16Bit(floatArray) {
    const int16 = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArray[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  // ── Utilities ───────────────────────────────────────────────
  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + ':' + s.toString().padStart(2, '0');
  }

})();
