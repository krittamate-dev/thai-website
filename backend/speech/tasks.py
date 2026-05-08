import io
import os
import time
import wave
import tempfile
import logging
import subprocess
import threading
from django.conf import settings
from google.cloud import speech
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

MAX_WAIT_SECONDS = 900   # 15 minutes max
POLL_INTERVAL = 5        # check every 5 seconds


def get_client():
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.GOOGLE_SERVICE_ACCOUNT_FILE),
        scopes=['https://www.googleapis.com/auth/cloud-platform'],
    )
    return speech.SpeechClient(credentials=credentials)


def to_wav_linear16(audio_bytes, filename):
    """Convert any audio to mono 16kHz WAV using ffmpeg (works on Python 3.13+)."""
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp3'
    tmp_in = tempfile.mktemp(suffix=f'.{ext}')
    tmp_out = tempfile.mktemp(suffix='.wav')
    try:
        with open(tmp_in, 'wb') as f:
            f.write(audio_bytes)

        result = subprocess.run(
            ['ffmpeg', '-i', tmp_in, '-ar', '16000', '-ac', '1', '-f', 'wav', tmp_out, '-y', '-loglevel', 'error'],
            capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode())

        with open(tmp_out, 'rb') as f:
            wav_bytes = f.read()

        logger.info('Converted to WAV: %d bytes', len(wav_bytes))
        return wav_bytes
    except FileNotFoundError:
        logger.warning('ffmpeg not found — sending raw audio to Google')
        return None
    except Exception as e:
        logger.warning('Audio conversion failed: %s — sending raw audio', e)
        return None
    finally:
        for p in (tmp_in, tmp_out):
            try:
                os.unlink(p)
            except OSError:
                pass


def build_config(raw_bytes, filename, language_code, converted):
    if converted:
        return speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            audio_channel_count=1,
            language_code=language_code,
            enable_automatic_punctuation=True,
        )
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp3'
    encoding_map = {
        'mp3':  speech.RecognitionConfig.AudioEncoding.MP3,
        'wav':  speech.RecognitionConfig.AudioEncoding.LINEAR16,
        'webm': speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        'ogg':  speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
        'flac': speech.RecognitionConfig.AudioEncoding.FLAC,
    }
    params = {
        'encoding': encoding_map.get(ext, speech.RecognitionConfig.AudioEncoding.MP3),
        'language_code': language_code,
        'enable_automatic_punctuation': True,
    }
    if ext == 'wav':
        try:
            with wave.open(io.BytesIO(raw_bytes)) as wf:
                params['sample_rate_hertz'] = wf.getframerate()
                if wf.getnchannels() > 1:
                    params['audio_channel_count'] = wf.getnchannels()
        except Exception:
            params['sample_rate_hertz'] = 16000
    return speech.RecognitionConfig(**params)


def wait_for_operation(operation):
    deadline = time.monotonic() + MAX_WAIT_SECONDS
    while not operation.done():
        if time.monotonic() > deadline:
            raise TimeoutError(f'ประมวลผลเกิน {MAX_WAIT_SECONDS // 60} นาที กรุณาลองใหม่')
        time.sleep(POLL_INTERVAL)
    if operation.exception():
        raise operation.exception()
    return operation.result()


def process_transcription(transcription_id):
    from .models import Transcription

    try:
        job = Transcription.objects.get(id=transcription_id)
        job.status = 'processing'
        job.save(update_fields=['status', 'updated_at'])

        audio_path = job.audio_file.path
        with open(audio_path, 'rb') as f:
            raw_bytes = f.read()

        logger.info('Transcription %s: %d bytes, file=%s', transcription_id, len(raw_bytes), job.filename)

        if not raw_bytes:
            raise ValueError('ไฟล์เสียงว่างเปล่า กรุณาอัปโหลดใหม่')

        wav_bytes = to_wav_linear16(raw_bytes, job.filename)
        audio_bytes = wav_bytes if wav_bytes else raw_bytes
        converted = wav_bytes is not None
        logger.info('Transcription %s: using %s encoding', transcription_id, 'LINEAR16/WAV' if converted else 'raw')

        client = get_client()
        config = build_config(raw_bytes, job.filename, job.language, converted)
        audio = speech.RecognitionAudio(content=audio_bytes)

        logger.info('Transcription %s: submitting to Google Speech API...', transcription_id)
        operation = client.long_running_recognize(config=config, audio=audio)
        logger.info('Transcription %s: waiting for operation %s', transcription_id, operation.operation.name)

        response = wait_for_operation(operation)
        logger.info('Transcription %s: got %d result segments', transcription_id, len(response.results))

        text = ' '.join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        )

        job.status = 'done'
        job.result = text if text else 'ไม่พบเสียงพูดในไฟล์นี้'
        job.audio_file = None
        job.save()

        try:
            os.remove(audio_path)
        except OSError:
            pass

    except Exception as e:
        logger.error('Transcription %s failed: %s', transcription_id, e)
        try:
            job = Transcription.objects.get(id=transcription_id)
            job.status = 'failed'
            job.error_message = str(e)
            job.save(update_fields=['status', 'error_message', 'updated_at'])
        except Exception:
            pass


def run_in_background(transcription_id):
    thread = threading.Thread(
        target=process_transcription,
        args=(transcription_id,),
        daemon=True,
    )
    thread.start()
