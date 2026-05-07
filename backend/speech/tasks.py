import io
import wave
import threading
from django.conf import settings
from google.cloud import speech
from google.oauth2 import service_account

ENCODING_MAP = {
    'mp3':  speech.RecognitionConfig.AudioEncoding.MP3,
    'wav':  speech.RecognitionConfig.AudioEncoding.LINEAR16,
    'webm': speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
    'ogg':  speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
    'flac': speech.RecognitionConfig.AudioEncoding.FLAC,
}


def get_client():
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.GOOGLE_SERVICE_ACCOUNT_FILE),
        scopes=['https://www.googleapis.com/auth/cloud-platform'],
    )
    return speech.SpeechClient(credentials=credentials)


def process_transcription(transcription_id):
    from .models import Transcription

    try:
        job = Transcription.objects.get(id=transcription_id)
        job.status = 'processing'
        job.save(update_fields=['status', 'updated_at'])

        audio_bytes = job.audio_file.read()
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

        operation = client.long_running_recognize(config=config, audio=audio)
        response = operation.result(timeout=300)

        text = ' '.join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        )

        job.status = 'done'
        job.result = text or 'ไม่พบเสียงพูดในไฟล์นี้'
        job.audio_file.delete(save=False)
        job.audio_file = None
        job.save()

    except Exception as e:
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
