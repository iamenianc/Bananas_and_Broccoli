import os
import wave
import struct
import math
import random
import subprocess

# Biquad Resonant Filter coefficients for Bandpass Filter
def get_bp_coeffs(f0, Q, fs):
    f0 = max(20.0, min(f0, fs / 2.0 - 20.0))
    omega = 2.0 * math.pi * f0 / fs
    sin_w = math.sin(omega)
    cos_w = math.cos(omega)
    alpha = sin_w / (2.0 * Q)
    
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1.0 + alpha
    a1 = -2.0 * cos_w
    a2 = 1.0 - alpha
    
    return b0/a0, b1/a0, b2/a0, a1/a0, a2/a0

class BiquadFilter:
    def __init__(self):
        self.x1 = 0.0
        self.x2 = 0.0
        self.y1 = 0.0
        self.y2 = 0.0
        
    def process(self, x, coeffs):
        b0, b1, b2, a1, a2 = coeffs
        y = b0 * x + b1 * self.x1 + b2 * self.x2 - a1 * self.y1 - a2 * self.y2
        self.x2 = self.x1
        self.x1 = x
        self.y2 = self.y1
        self.y1 = y
        return y

# Scaled vowel formant frequencies (Hz) for baby-like vocal tract
VOWELS = {
    'a': (1200.0, 1900.0, 3500.0), # "ah" as in gaga
    'e': (800.0, 2800.0, 3800.0),  # "eh" as in bleh
    'i': (500.0, 3500.0, 4500.0),  # "ee" as in giggle
    'o': (700.0, 1400.0, 3200.0),  # "oh" as in uh-oh
    'u': (500.0, 1100.0, 3000.0),  # "oo" as in gasp
}

def get_vowel_formants(vowel_name):
    return VOWELS.get(vowel_name, (800.0, 1500.0, 3000.0))

def interpolate_formants(v1, v2, frac):
    f1a, f2a, f3a = get_vowel_formants(v1)
    f1b, f2b, f3b = get_vowel_formants(v2)
    return (
        f1a + (f1b - f1a) * frac,
        f2a + (f2b - f2a) * frac,
        f3a + (f3b - f3a) * frac
    )

def synthesize_vocal(duration, pitch_func, vowel_func, noise_func, amp_func, fs=44100):
    total_samples = int(duration * fs)
    samples = []
    
    f1_filter = BiquadFilter()
    f2_filter = BiquadFilter()
    f3_filter = BiquadFilter()
    
    source_phase = 0.0
    
    for i in range(total_samples):
        t = i / fs
        
        f0 = pitch_func(t)
        F1, F2, F3 = vowel_func(t)
        noise_ratio = noise_func(t)
        amp = amp_func(t)
        
        # 1. Excitation Source (Sawtooth voice source + white noise)
        saw = 2.0 * (source_phase / (2.0 * math.pi)) - 1.0
        source_phase = (source_phase + 2.0 * math.pi * f0 / fs) % (2.0 * math.pi)
        
        noise_val = random.uniform(-1.0, 1.0)
        excitation = (1.0 - noise_ratio) * saw + noise_ratio * noise_val
        
        # 2. Formant filters (Q values represent resonances)
        c1 = get_bp_coeffs(F1, 10.0, fs)
        c2 = get_bp_coeffs(F2, 10.0, fs)
        c3 = get_bp_coeffs(F3, 8.0, fs)
        
        y1 = f1_filter.process(excitation, c1)
        y2 = f2_filter.process(excitation, c2)
        y3 = f3_filter.process(excitation, c3)
        
        # 3. Sum formants and apply amp envelope
        vocal_out = y1 * 1.0 + y2 * 0.4 + y3 * 0.15
        
        out_val = vocal_out * amp
        samples.append(out_val)
        
    return samples

def write_wav(filename, samples, fs=44100):
    # Normalize samples to avoid clipping and optimize volume
    max_val = max(abs(s) for s in samples) if samples else 1.0
    if max_val > 0:
        norm_samples = [s / max_val * 0.9 for s in samples]
    else:
        norm_samples = samples
        
    packed_samples = []
    for s in norm_samples:
        val_int = int(max(-1.0, min(1.0, s)) * 32767.0)
        packed_samples.append(struct.pack('<h', val_int))
        
    with wave.open(filename, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(fs)
        wav.writeframes(b''.join(packed_samples))

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "assets")
    
    # 1. FLAP (Baby "hup!" jump)
    def flap_pitch(t):
        return 380.0 * math.exp(math.log(620.0 / 380.0) * (t / 0.12))
    def flap_vowel(t):
        return interpolate_formants('u', 'a', t / 0.12)
    def flap_noise(t):
        return 0.05
    def flap_amp(t):
        if t < 0.005:
            return t / 0.005
        return math.exp(-22.0 * (t - 0.005))
    sfx_flap = synthesize_vocal(0.12, flap_pitch, flap_vowel, flap_noise, flap_amp)
    
    # 2. CATCH BANANA (Small drop of water dropping into a bucket)
    def synthesize_water_drop(duration=0.15, fs=44100):
        total_samples = int(duration * fs)
        samples = []
        phase_droplet = 0.0
        phase_resonance = 0.0
        
        for i in range(total_samples):
            t = i / fs
            
            # Rising droplet chirp (600 Hz to 1800 Hz)
            f_start = 600.0
            f_end = 1800.0
            frac = t / duration
            freq_droplet = f_start + (f_end - f_start) * (frac ** 2)
            
            phase_droplet += 2.0 * math.pi * freq_droplet / fs
            droplet_wave = math.sin(phase_droplet)
            
            # Droplet amplitude envelope
            attack = 0.002
            if t < attack:
                amp_droplet = t / attack
            else:
                amp_droplet = math.exp(-30.0 * (t - attack))
                
            # Hollow bucket cavity resonance (800 Hz)
            freq_resonance = 800.0
            phase_resonance += 2.0 * math.pi * freq_resonance / fs
            resonance_wave = math.sin(phase_resonance)
            
            # Resonance envelope: starts slightly after impact, decays slower
            if t > 0.005:
                amp_res = 0.25 * math.exp(-15.0 * (t - 0.005))
            else:
                amp_res = 0.0
                
            # Combined signal
            val = droplet_wave * amp_droplet + resonance_wave * amp_res
            
            # Add initial high frequency click of droplet hitting surface
            if t < 0.004:
                click = math.sin(2.0 * math.pi * 3500.0 * t) * math.exp(-1000.0 * t)
                val += 0.3 * click
                
            samples.append(val)
            
        return samples

    sfx_catch = synthesize_water_drop(0.15)
    
    # 3. SWAT BROCCOLI (Baby effort grunt "yah!")
    def swat_pitch(t):
        return 350.0 - 190.0 * (t / 0.18)
    def swat_vowel(t):
        return interpolate_formants('u', 'o', t / 0.18)
    def swat_noise(t):
        return 0.15
    def swat_amp(t):
        if t < 0.01:
            return t / 0.01
        return math.exp(-12.0 * (t - 0.01))
    sfx_swat = synthesize_vocal(0.18, swat_pitch, swat_vowel, swat_noise, swat_amp)
    
    # 4. SWAT BONUS (Baby excited "yay!")
    def bonus_pitch(t):
        if t < 0.22:
            return 500.0 + 350.0 * (t / 0.22)
        return 850.0 + 30.0 * math.sin(2.0 * math.pi * 7.0 * (t - 0.22))
    def bonus_vowel(t):
        if t < 0.22:
            return interpolate_formants('i', 'a', t / 0.22)
        return get_vowel_formants('a')
    def bonus_noise(t):
        return 0.08
    def bonus_amp(t):
        if t < 0.05:
            return t / 0.05
        elif t < 0.38:
            return 1.0
        return math.exp(-9.0 * (t - 0.38))
    sfx_bonus = synthesize_vocal(0.55, bonus_pitch, bonus_vowel, bonus_noise, bonus_amp)
    
    # 5. SWAT BANANA PENALTY (Baby whimper / sad "wah-wah")
    def penalty_pitch(t):
        if t < 0.35:
            t_syl = t
            return 480.0 - 160.0 * (t_syl / 0.35) + 12.0 * math.sin(2.0 * math.pi * 8.0 * t_syl)
        elif t < 0.45:
            return 320.0
        else:
            t_syl = t - 0.45
            return 450.0 - 170.0 * (t_syl / 0.35) + 15.0 * math.sin(2.0 * math.pi * 8.0 * t_syl)
    def penalty_vowel(t):
        t_syl = t if t < 0.35 else (0.0 if t < 0.45 else t - 0.45)
        if t_syl < 0.15:
            return interpolate_formants('u', 'a', t_syl / 0.15)
        return interpolate_formants('a', 'o', min(1.0, (t_syl - 0.15) / 0.20))
    def penalty_noise(t):
        return 0.12
    def penalty_amp(t):
        if t < 0.35:
            t_syl = t
            return math.sin(math.pi * (t_syl / 0.35)) * (0.8 + 0.2 * math.sin(2.0 * math.pi * 8.0 * t_syl))
        elif t < 0.45:
            return 0.0
        else:
            t_syl = t - 0.45
            return math.sin(math.pi * (t_syl / 0.35)) * (0.7 + 0.3 * math.sin(2.0 * math.pi * 8.0 * t_syl))
    sfx_penalty = synthesize_vocal(0.80, penalty_pitch, penalty_vowel, penalty_noise, penalty_amp)
    
    # 6. EAT BROCCOLI (Baby disgusted yuck / "bleh")
    def eat_pitch(t):
        return 180.0 - 90.0 * (t / 0.45) + 20.0 * math.sin(2.0 * math.pi * 20.0 * t)
    def eat_vowel(t):
        return interpolate_formants('e', 'o', t / 0.45)
    def eat_noise(t):
        return 0.35
    def eat_amp(t):
        return math.exp(-6.0 * t)
    sfx_eat = synthesize_vocal(0.45, eat_pitch, eat_vowel, eat_noise, eat_amp)
    
    # 7. CHARGE START (Excited baby "ooh!")
    def charge_pitch(t):
        return 480.0 + 300.0 * (t / 0.25)
    def charge_vowel(t):
        return get_vowel_formants('u')
    def charge_noise(t):
        return 0.05
    def charge_amp(t):
        if t < 0.03:
            return t / 0.03
        return math.exp(-6.0 * (t - 0.03))
    sfx_charge = synthesize_vocal(0.25, charge_pitch, charge_vowel, charge_noise, charge_amp)
    
    # 8. DISCO ACTIVATION (Triumphant baby giggle/cheer "yippee!")
    def disco_pitch(t):
        if t < 0.45:
            pulse = int(t / 0.11)
            t_pulse = t - pulse * 0.11
            return 700.0 + 150.0 * math.sin(math.pi * (t_pulse / 0.08)) if t_pulse < 0.08 else 600.0
        else:
            t_cheer = t - 0.45
            return 600.0 + 400.0 * (t_cheer / 0.55) + 30.0 * math.sin(2.0 * math.pi * 8.0 * t_cheer)
    def disco_vowel(t):
        if t < 0.45:
            return get_vowel_formants('i')
        else:
            return interpolate_formants('i', 'a', (t - 0.45) / 0.55)
    def disco_noise(t):
        return 0.12 if t < 0.45 else 0.08
    def disco_amp(t):
        if t < 0.45:
            pulse = int(t / 0.11)
            t_pulse = t - pulse * 0.11
            return math.sin(math.pi * (t_pulse / 0.08)) * 0.85 if (pulse < 4 and t_pulse < 0.08) else 0.02
        else:
            t_cheer = t - 0.45
            if t_cheer < 0.45:
                return 1.0
            return (0.55 - t_cheer) / 0.10
    sfx_disco = synthesize_vocal(1.0, disco_pitch, disco_vowel, disco_noise, disco_amp)
    
    # 9. BARRAGE WARNING (Baby warning cry/gasp: "uh-oh!")
    def warning_pitch(t):
        if t < 0.18:
            return 480.0 - 30.0 * (t / 0.18)
        elif t < 0.25:
            return 450.0
        else:
            t_syl = t - 0.25
            return 380.0 - 120.0 * (t_syl / 0.35)
    def warning_vowel(t):
        return get_vowel_formants('o')
    def warning_noise(t):
        return 0.08
    def warning_amp(t):
        if t < 0.18:
            return math.sin(math.pi * (t / 0.18))
        elif t < 0.25:
            return 0.0
        else:
            return math.sin(math.pi * ((t - 0.25) / 0.35))
    sfx_warning = synthesize_vocal(0.60, warning_pitch, warning_vowel, warning_noise, warning_amp)
    
    # 10. BUTTON CLICK (Baby vocal pop)
    def click_pitch(t):
        return 800.0 - 600.0 * (t / 0.06)
    def click_vowel(t):
        return get_vowel_formants('o')
    def click_noise(t):
        return 0.05
    def click_amp(t):
        return math.exp(-35.0 * t)
    sfx_click = synthesize_vocal(0.06, click_pitch, click_vowel, click_noise, click_amp)
    
    sfx_map = {
        "sfx_flap": sfx_flap,
        "sfx_catch": sfx_catch,
        "sfx_swat": sfx_swat,
        "sfx_penalty": sfx_penalty,
        "sfx_eat_broccoli": sfx_eat,
        "sfx_charge_start": sfx_charge,
        "sfx_disco_activation": sfx_disco,
        "sfx_warning": sfx_warning,
        "sfx_click": sfx_click
    }
    
    for key, samples in sfx_map.items():
        wav_file = os.path.join(base_dir, f"{key}.wav")
        print(f"Generating raw WAV: {wav_file}")
        write_wav(wav_file, samples)
        
        mp3_file = os.path.join(assets_dir, f"{key}.mp3")
        ogg_file = os.path.join(assets_dir, f"{key}.ogg")
        
        print(f"Compressing to MP3: {mp3_file}")
        subprocess.run(['ffmpeg', '-y', '-i', wav_file, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', mp3_file], check=True)
        print(f"Compressing to OGG: {ogg_file}")
        subprocess.run(['ffmpeg', '-y', '-i', wav_file, '-codec:a', 'libvorbis', '-b:a', '48k', '-ac', '1', ogg_file], check=True)
        
        os.remove(wav_file)
        
    print("All sound effects generated and compressed successfully!")

if __name__ == '__main__':
    main()
