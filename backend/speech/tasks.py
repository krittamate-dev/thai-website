import io
import os
import wave
import tempfile
import logging
import subprocess
import threading
from django.conf import settings
from google.cloud import speech
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

CHUNK_SECONDS = 55   # stay under Google's 60s inline limit


def get_client():
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.GOOGLE_SERVICE_ACCOUNT_FILE),
        scopes=['https://www.googleapis.com/auth/cloud-platform'],
    )
    return speech.SpeechClient(credentials=credentials)


def to_wav_linear16(audio_bytes, filename):
    """Convert any audio to mono 16kHz WAV using ffmpeg."""
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
            return f.read()
    except FileNotFoundError:
        logger.warning('ffmpeg not found — sending raw audio')
        return None
    except Exception as e:
        logger.warning('Conversion failed: %s', e)
        return None
    finally:
        for p in (tmp_in, tmp_out):
            try:
                os.unlink(p)
            except OSError:
                pass


def split_wav(wav_bytes):
    """Split WAV into chunks of CHUNK_SECONDS seconds."""
    chunks = []
    with wave.open(io.BytesIO(wav_bytes)) as wf:
        rate = wf.getframerate()
        ch = wf.getnchannels()
        sw = wf.getsampwidth()
        chunk_frames = CHUNK_SECONDS * rate
        while True:
            frames = wf.readframes(chunk_frames)
            if not frames:
                break
            buf = io.BytesIO()
            with wave.open(buf, 'wb') as out:
                out.setnchannels(ch)
                out.setsampwidth(sw)
                out.setframerate(rate)
                out.writeframes(frames)
            chunks.append(buf.getvalue())
    return chunks


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
            raise ValueError('ไฟล์เสียงว่างเปล่า')

        wav_bytes = to_wav_linear16(raw_bytes, job.filename)
        if not wav_bytes:
            raise RuntimeError('แปลงไฟล์เสียงไม่สำเร็จ กรุณาตรวจสอบว่า ffmpeg ติดตั้งแล้ว')

        chunks = split_wav(wav_bytes)
        logger.info('Transcription %s: %d chunk(s) × %ds', transcription_id, len(chunks), CHUNK_SECONDS)

        client = get_client()
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            audio_channel_count=1,
            language_code=job.language,
            enable_automatic_punctuation=True,
        )

        all_text = []
        for i, chunk in enumerate(chunks):
            response = client.recognize(
                config=config,
                audio=speech.RecognitionAudio(content=chunk),
            )
            chunk_text = ' '.join(
                r.alternatives[0].transcript
                for r in response.results
                if r.alternatives
            )
            if chunk_text:
                all_text.append(chunk_text)
            logger.info('Chunk %d/%d: %d chars', i + 1, len(chunks), len(chunk_text))

        text = ' '.join(all_text)
        logger.info('Transcription %s: done, total %d chars', transcription_id, len(text))

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
