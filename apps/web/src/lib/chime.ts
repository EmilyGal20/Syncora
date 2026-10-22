let audioContext: AudioContext | null = null

export function playReminderChime() {
  const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  audioContext ??= new AudioCtor()
  const audio = audioContext
  if (audio.state === 'suspended') void audio.resume()
  const startedAt = audio.currentTime
  ;[880, 1174].forEach((frequency, index) => {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, startedAt)
    gain.gain.exponentialRampToValueAtTime(0.12, startedAt + 0.02 + index * 0.18)
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.28 + index * 0.22)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start(startedAt + index * 0.16)
    oscillator.stop(startedAt + 0.4 + index * 0.22)
  })
}
