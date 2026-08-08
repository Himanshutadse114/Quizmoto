import argparse
import importlib.util
import json
import os
import sys
import wave


def module_available(name):
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def truthy_env(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def engine_catalog():
    melo_installed = module_available('melo')
    kokoro_installed = module_available('kokoro')
    kokoro_voice = os.getenv('KOKORO_INDIAN_VOICE', '').strip()

    return [
        {
            'id': 'melo_india',
            'label': 'MeloTTS · Indian English',
            'engine': 'MeloTTS',
            'language': 'en-IN',
            'offline': True,
            'installed': melo_installed,
            'configured': truthy_env('MELO_TTS_ENABLED', True),
            'available': melo_installed and truthy_env('MELO_TTS_ENABLED', True),
            'reason': None if melo_installed else 'Python package melo is not installed in the configured TTS environment.'
        },
        {
            'id': 'kokoro_india',
            'label': 'Kokoro · Indian English',
            'engine': 'Kokoro',
            'language': 'en-IN',
            'offline': True,
            'installed': kokoro_installed,
            'configured': bool(kokoro_voice),
            'available': kokoro_installed and bool(kokoro_voice),
            'reason': (
                None
                if kokoro_installed and kokoro_voice
                else 'Install the kokoro package and set KOKORO_INDIAN_VOICE to a locally cached Indian-English voice identifier.'
            )
        }
    ]


def write_wav_float32(path, audio, sample_rate=24000):
    import numpy as np

    if hasattr(audio, 'detach'):
        audio = audio.detach().cpu().numpy()
    array = np.asarray(audio, dtype=np.float32).reshape(-1)
    array = np.clip(array, -1.0, 1.0)
    pcm = (array * 32767.0).astype(np.int16)
    with wave.open(path, 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm.tobytes())


def generate_melo(text, output_path, speed):
    try:
        from melo.api import TTS
    except Exception as exc:
        raise RuntimeError(f'MeloTTS import failed: {exc}') from exc

    device = os.getenv('MELO_TTS_DEVICE', 'cpu').strip() or 'cpu'
    model = TTS(language='EN', device=device)
    speaker_map = getattr(getattr(model, 'hps', None), 'data', None)
    speaker_map = getattr(speaker_map, 'spk2id', {}) if speaker_map else {}
    speaker_id = speaker_map.get('EN_INDIA')
    if speaker_id is None:
        raise RuntimeError('MeloTTS EN_INDIA speaker is unavailable in the installed model.')

    model.tts_to_file(text, speaker_id, output_path, speed=float(speed))


def generate_kokoro(text, output_path, speed):
    voice = os.getenv('KOKORO_INDIAN_VOICE', '').strip()
    if not voice:
        raise RuntimeError('KOKORO_INDIAN_VOICE is not configured.')

    try:
        from kokoro import KPipeline
    except Exception as exc:
        raise RuntimeError(f'Kokoro import failed: {exc}') from exc

    import numpy as np

    lang_code = os.getenv('KOKORO_LANG_CODE', 'a').strip() or 'a'
    sample_rate = int(os.getenv('KOKORO_SAMPLE_RATE', '24000'))
    pipeline = KPipeline(lang_code=lang_code)
    chunks = []

    # KPipeline yields one or more audio chunks. The third item is audio in
    # current Kokoro releases; this loop is intentionally tolerant of tuple
    # shape changes so the prototype fails clearly instead of corrupting audio.
    for item in pipeline(text, voice=voice, speed=float(speed)):
        if isinstance(item, (tuple, list)) and len(item) >= 3:
            audio = item[2]
        else:
            audio = getattr(item, 'audio', None)
        if audio is None:
            continue
        if hasattr(audio, 'detach'):
            audio = audio.detach().cpu().numpy()
        chunks.append(np.asarray(audio, dtype=np.float32).reshape(-1))

    if not chunks:
        raise RuntimeError('Kokoro produced no audio. Verify the configured voice is locally cached and compatible.')

    if len(chunks) == 1:
        joined = chunks[0]
    else:
        silence = np.zeros(int(sample_rate * 0.08), dtype=np.float32)
        merged = []
        for idx, chunk in enumerate(chunks):
            if idx:
                merged.append(silence)
            merged.append(chunk)
        joined = np.concatenate(merged)

    write_wav_float32(output_path, joined, sample_rate=sample_rate)


def generate(engine, text, output_path, speed):
    if engine == 'melo_india':
        generate_melo(text, output_path, speed)
        return
    if engine == 'kokoro_india':
        generate_kokoro(text, output_path, speed)
        return
    raise RuntimeError(f'Unsupported TTS engine: {engine}')


def main():
    parser = argparse.ArgumentParser(description='Quizmoto local/offline TTS preview runner')
    parser.add_argument('--list', action='store_true', dest='list_engines')
    parser.add_argument('--engine')
    parser.add_argument('--text-file')
    parser.add_argument('--output')
    parser.add_argument('--speed', type=float, default=1.0)
    args = parser.parse_args()

    # Do not allow Hugging Face/Transformers to reach the network at preview
    # time. Required models must already exist in the local cache/image.
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')

    if args.list_engines:
        print(json.dumps({'voices': engine_catalog()}))
        return 0

    if not args.engine or not args.text_file or not args.output:
        parser.error('--engine, --text-file and --output are required for generation')

    with open(args.text_file, 'r', encoding='utf-8') as handle:
        text = handle.read().strip()

    if not text:
        raise RuntimeError('Narration text is empty.')
    if len(text) > 3000:
        raise RuntimeError('Narration preview is limited to 3000 characters.')

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    generate(args.engine, text, args.output, max(0.75, min(1.25, args.speed)))

    if not os.path.exists(args.output) or os.path.getsize(args.output) < 512:
        raise RuntimeError('TTS engine did not produce a valid audio file.')

    print(json.dumps({'ok': True, 'engine': args.engine, 'output': args.output}))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
