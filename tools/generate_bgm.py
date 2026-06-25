import os
import wave
import struct
import math
import random
import subprocess

# Chiptune Note Frequencies
NOTE_FREQS = {
    'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98, 'A6': 1760.00, 'B6': 1975.53, 'C7': 2093.00,
    '.': 0.0
}

def get_wave(wave_type, freq, phase):
    if wave_type == 'sine':
        return math.sin(phase)
    elif wave_type == 'triangle':
        p = (phase / (2.0 * math.pi)) % 1.0
        return 2.0 * abs(2.0 * p - 1.0) - 1.0
    elif wave_type == 'square':
        p = (phase / (2.0 * math.pi)) % 1.0
        return 1.0 if p < 0.5 else -1.0
    elif wave_type == 'sawtooth':
        p = (phase / (2.0 * math.pi)) % 1.0
        return 2.0 * p - 1.0
    return 0.0

def play_sequencer(melody_seq, bass_seq, rhythm_seq, tempo, wave_melody, wave_bass, filename, sidechain=False, steps_per_beat=2):
    sample_rate = 44100
    total_steps = len(melody_seq)
    
    if filename.endswith("bgm_powerup.wav"):
        total_samples = 441000  # exactly 10 seconds
    else:
        step_secs = 60.0 / tempo / steps_per_beat
        total_samples = int(sample_rate * step_secs * total_steps)
        
    base_samples = total_samples // total_steps
    remainder = total_samples % total_steps
    
    melody_phase = 0.0
    bass_phase = 0.0
    
    samples = []
    
    for step_idx in range(total_steps):
        melody_note = melody_seq[step_idx]
        bass_note = bass_seq[step_idx]
        rhythm_hit = rhythm_seq[step_idx]
        
        melody_freq = NOTE_FREQS.get(melody_note, 0.0)
        bass_freq = NOTE_FREQS.get(bass_note, 0.0)
        
        step_samples = base_samples + (1 if step_idx < remainder else 0)
        step_secs = step_samples / sample_rate
        
        for i in range(step_samples):
            t_step = i / sample_rate
            
            # 1. Melody channel
            val_melody = 0.0
            if melody_freq > 0.0:
                env_melody = math.exp(-2.5 * t_step / step_secs)
                val_melody = get_wave(wave_melody, melody_freq, melody_phase) * env_melody
                melody_phase += 2.0 * math.pi * melody_freq / sample_rate
            else:
                melody_phase = 0.0
                
            # 2. Bass channel
            val_bass = 0.0
            if bass_freq > 0.0:
                decay_rate = 1.2 if sidechain else 3.5
                env_bass = math.exp(-decay_rate * t_step / step_secs)
                val_bass = get_wave(wave_bass, bass_freq, bass_phase) * env_bass
                bass_phase += 2.0 * math.pi * bass_freq / sample_rate
                
                # Apply sidechain compression if enabled
                if sidechain:
                    if rhythm_hit == 'K':
                        ducking = 0.85 * math.exp(-18.0 * t_step)
                        val_bass *= (1.0 - ducking)
            else:
                bass_phase = 0.0
                
            # 3. Drum channel
            val_drum = 0.0
            if rhythm_hit == 'K':  # Kick Sweep
                if t_step < 0.09:
                    kick_freq = 140.0 - 100.0 * (t_step / 0.09)
                    kick_phase = 2.0 * math.pi * kick_freq * t_step
                    val_drum = math.sin(kick_phase) * math.exp(-5.0 * t_step / 0.09)
            elif rhythm_hit == 'H':  # Hi-hat (short noise)
                if t_step < 0.03:
                    val_drum = (random.random() * 2.0 - 1.0) * math.exp(-120.0 * t_step) * 0.3
            elif rhythm_hit == 'S':  # Snare
                if t_step < 0.08:
                    val_drum = (random.random() * 2.0 - 1.0) * math.exp(-35.0 * t_step) * 0.4
            
            # Mix
            mixed = (val_melody * 0.22) + (val_bass * 0.28) + (val_drum * 0.22)
            mixed = max(-1.0, min(1.0, mixed))
            
            val_int = int(mixed * 32767.0)
            samples.append(struct.pack('<h', val_int))
            
    with wave.open(filename, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b''.join(samples))
    print(f"Generated raw WAV: {filename}")

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "assets")
    
    # 1. Normal Play Track
    # Cute, light-tempo triangle/sine chiptune
    normal_melody = [
        'E5', '.', 'G5', '.', 'A5', '.', 'G5', '.',
        'E5', '.', 'D5', '.', 'C5', '.', 'D5', '.',
        'E5', '.', 'G5', '.', 'A5', '.', 'C6', '.',
        'B5', '.', 'A5', '.', 'G5', '.', 'E5', '.'
    ]
    normal_bass = [
        'C3', '.', 'C3', '.', 'G3', '.', 'G3', '.',
        'A3', '.', 'A3', '.', 'E3', '.', 'E3', '.',
        'F3', '.', 'F3', '.', 'C3', '.', 'C3', '.',
        'G3', '.', 'G3', '.', 'B3', '.', 'B3', '.'
    ]
    normal_rhythm = [
        '.', 'H', '.', 'H', '.', 'H', '.', 'S',
        '.', 'H', '.', 'H', '.', 'H', '.', 'S',
        '.', 'H', '.', 'H', '.', 'H', '.', 'S',
        '.', 'H', '.', 'H', '.', 'H', '.', 'S'
    ]
    
    wav_normal = os.path.join(base_dir, "bgm_normal.wav")
    play_sequencer(normal_melody, normal_bass, normal_rhythm, 120, 'triangle', 'sine', wav_normal)
    
    # 2. Powerup Play Track
    # UK Dance / House / Pop EDM with strong pumping bass (170 BPM, exactly 10s loop)
    powerup_melody = [
        # Measure 1 & 2 (Am)
        'A5', '.', 'C6', 'E5', '.', 'G5', 'A5', '.', 'C6', 'B5', '.', 'G5',
        'A5', '.', 'C6', 'E5', '.', 'G5', 'A5', '.', 'C6', 'E6', '.', 'D6',
        # Measure 3 & 4 (F)
        'F5', '.', 'A5', 'C6', '.', 'F5', 'A5', '.', 'C6', 'A5', '.', 'F5',
        'F5', '.', 'A5', 'C6', '.', 'F5', 'A5', '.', 'C6', 'F6', '.', 'E6',
        # Measure 5 & 6 (C)
        'E5', '.', 'G5', 'C6', '.', 'E5', 'G5', '.', 'C6', 'G5', '.', 'E5',
        'E5', '.', 'G5', 'C6', '.', 'E5', 'G5', '.', 'C6', 'E6', '.', 'D6',
        # Measure 7 (G)
        'D5', '.', 'G5', 'B5', '.', 'D5', 'G5', '.', 'B5', 'D6', '.', 'B5',
        # Step 84 turnaround
        '.'
    ]
    powerup_bass = [
        # Measure 1 & 2 (Am)
        '.', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2',
        '.', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2',
        # Measure 3 & 4 (F)
        '.', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2',
        '.', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2',
        # Measure 5 & 6 (C)
        '.', 'C3', 'C4', 'C3', 'C4', 'C3', 'C4', 'C3', 'C4', 'C3', 'C4', 'C3',
        '.', 'C3', 'C4', 'C3', 'C4', 'C3', 'C4', 'C3', 'C4', 'C3', 'C4', 'C3',
        # Measure 7 (G)
        '.', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2',
        # Step 84 turnaround
        '.'
    ]
    powerup_rhythm = [
        # Measure 1 & 2
        'K', '.', 'H', 'S', '.', 'H', 'K', '.', 'H', 'S', '.', 'H',
        'K', '.', 'H', 'S', '.', 'H', 'K', '.', 'H', 'S', '.', 'H',
        # Measure 3 & 4
        'K', '.', 'H', 'S', '.', 'H', 'K', '.', 'H', 'S', '.', 'H',
        'K', '.', 'H', 'S', '.', 'H', 'K', '.', 'H', 'S', '.', 'H',
        # Measure 5 & 6
        'K', '.', 'H', 'S', '.', 'H', 'K', '.', 'H', 'S', '.', 'H',
        'K', '.', 'H', 'S', '.', 'H', 'K', '.', 'H', 'S', '.', 'H',
        # Measure 7 (turnaround drum fill)
        'K', 'K', 'H', 'S', 'S', 'H', 'K', 'K', 'S', 'S', 'K', 'S',
        # Step 84 turnaround
        'H'
    ]
    
    wav_powerup = os.path.join(base_dir, "bgm_powerup.wav")
    play_sequencer(powerup_melody, powerup_bass, powerup_rhythm, 170, 'sawtooth', 'triangle', wav_powerup, sidechain=True, steps_per_beat=3)
    
    # Compress with FFmpeg (MP3: 48kbps, OGG: 48kbps mono for super-lightweight load)
    print("Compressing normal BGM...")
    mp3_normal = os.path.join(assets_dir, "bgm_normal.mp3")
    ogg_normal = os.path.join(assets_dir, "bgm_normal.ogg")
    subprocess.run(['ffmpeg', '-y', '-i', wav_normal, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', mp3_normal], check=True)
    subprocess.run(['ffmpeg', '-y', '-i', wav_normal, '-codec:a', 'libvorbis', '-b:a', '48k', '-ac', '1', ogg_normal], check=True)
    
    print("Compressing powerup BGM...")
    mp3_powerup = os.path.join(assets_dir, "bgm_powerup.mp3")
    ogg_powerup = os.path.join(assets_dir, "bgm_powerup.ogg")
    subprocess.run(['ffmpeg', '-y', '-i', wav_powerup, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', mp3_powerup], check=True)
    subprocess.run(['ffmpeg', '-y', '-i', wav_powerup, '-codec:a', 'libvorbis', '-b:a', '48k', '-ac', '1', ogg_powerup], check=True)
    
    # Clean up WAVs
    os.remove(wav_normal)
    os.remove(wav_powerup)
    print("Compression done! Temporary WAV files deleted.")

if __name__ == '__main__':
    main()
