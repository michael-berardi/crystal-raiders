export class SoundSystem {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private sounds = new Map<string, AudioBuffer>();
  
  initialize(): void {
    try {
      this.audioContext = new AudioContext();
    } catch {
      console.warn('Web Audio API not supported');
    }
  }
  
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
    } catch (err) {
      console.warn(`Failed to load sound: ${name}`, err);
    }
  }
  
  play(name: string, volume: number = 1.0): void {
    if (!this.enabled || !this.audioContext) return;
    
    const buffer = this.sounds.get(name);
    if (buffer) {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      source.buffer = buffer;
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start();
    } else {
      // Generate synthetic sound as fallback
      this.playSynthetic(name, volume);
    }
  }
  
  private playSynthetic(name: string, volume: number): void {
    if (!this.audioContext) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    switch (name) {
      case 'drill':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.3);
        gain.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
        break;
        
      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
        break;
        
      case 'select':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
        gain.gain.setValueAtTime(volume * 0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.1);
        break;
        
      case 'build':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.2);
        gain.gain.setValueAtTime(volume * 0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
        break;
        
      case 'alert':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
        osc.frequency.setValueAtTime(880, this.audioContext.currentTime + 0.1);
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime + 0.2);
        gain.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.4);
        break;
        
      case 'win':
        this.playToneSequence([523, 659, 784, 1047], volume * 0.3);
        break;
        
      case 'lose':
        this.playToneSequence([400, 350, 300, 200], volume * 0.3);
        break;
    }
  }
  
  private playToneSequence(frequencies: number[], volume: number): void {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(volume, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.2);
    });
  }
  
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  dispose(): void {
    this.audioContext?.close();
  }
}
