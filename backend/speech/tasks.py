import io
import os
import time
import wave
import logging
import threading
from django.conf import settings
from google.cloud import speech
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

ENCODING_MAP = {
    'mp3':  speech.RecognitionConfig.AudioEncoding.MP3,
    'wav':  speech.RecognitionConfig.AudioEncoding.LINEAR16,
    'webm': speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
    'ogg':  speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
    'flac': speech.RecognitionConfig.AudioEncoding.FLAC,
}

MAX_WAIT_SECONDS = 900   # 15 minutes max
POLL_INTERVAL = 5        # check every 5 seconds


def get_client():
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.GOOGLE_SERVICE_ACCOUNT_FILE),
        scopes=['https://www.googleapis.com/auth/cloud-platform'],
    )
    return speech.SpeechClient(credentials=credentials)


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
            audio_bytes = f.read()

        logger.info('Transcription %s: %d bytes, file=%s', transcription_id, len(audio_bytes), job.filename)

        if not audio_bytes:
            raise ValueError('ไฟล์เสียงว่างเปล่า กรุณาอัปโหลดใหม่')

        ext = job.filename.rsplit('.', 1)[-1].lower() if '.' in job.filename else 'mp3'
        encoding = ENCODING_MAP.get(ext, speech.RecognitionConfig.AudioEncoding.MP3)

        params = {
            'encoding': encoding,
            'language_code': job.language,
            'enable_automatic_punctuation': True,
        }

        if ext == 'wav':
            try:
                with wave.open(io.BytesIO(audio_bytes)) as wf:
                    params['sample_rate_hertz'] = wf.getframerate()
                    if wf.getnchannels() > 1:
                        params['audio_channel_count'] = wf.getnchannels()
            except Exception:
                params['sample_rate_hertz'] = 16000

        client = get_client()
        config = speech.RecognitionConfig(**params)
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
