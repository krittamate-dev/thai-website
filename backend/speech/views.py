import io
import wave
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from google.cloud import speech
from google.oauth2 import service_account

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

ENCODING_MAP = {
    'mp3':  speech.RecognitionConfig.AudioEncoding.MP3,
    'wav':  speech.RecognitionConfig.AudioEncoding.LINEAR16,
    'webm': speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
    'ogg':  speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
    'flac': speech.RecognitionConfig.AudioEncoding.FLAC,
}

LANGUAGE_MAP = {
    'th': 'th-TH',
    'en': 'en-US',
    'auto': 'th-TH',
}


def get_client():
    credentials = service_account.Credentials.from_service_account_file(
        str(settings.GOOGLE_SERVICE_ACCOUNT_FILE),
        scopes=['https://www.googleapis.com/auth/cloud-platform'],
    )
    return speech.SpeechClient(credentials=credentials)


def build_config(filename, audio_bytes, language_code):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp3'
    encoding = ENCODING_MAP.get(ext, speech.RecognitionConfig.AudioEncoding.MP3)

    params = {
        'encoding': encoding,
        'language_code': language_code,
        'enable_automatic_punctuation': True,
        'model': 'latest_long',
    }

    if ext == 'wav':
        try:
            with wave.open(io.BytesIO(audio_bytes)) as wf:
                params['sample_rate_hertz'] = wf.getframerate()
                params['audio_channel_count'] = wf.getnchannels()
        except Exception:
            params['sample_rate_hertz'] = 16000

    return speech.RecognitionConfig(**params)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def transcribe(request):
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return Response(
            {'error': 'กรุณาอัปโหลดไฟล์เสียง'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if audio_file.size > MAX_FILE_SIZE:
        return Response(
            {'error': 'ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    lang_key = request.data.get('language', 'th')
    language_code = LANGUAGE_MAP.get(lang_key, 'th-TH')
    audio_bytes = audio_file.read()

    try:
        client = get_client()
        config = build_config(audio_file.name, audio_bytes, language_code)
        audio = speech.RecognitionAudio(content=audio_bytes)
        response = client.recognize(config=config, audio=audio)

        text = ' '.join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        )

        return Response({
            'text': text or 'ไม่พบเสียงพูดในไฟล์นี้',
            'language': language_code,
        })
    except Exception as e:
        error_msg = str(e) if settings.DEBUG else 'เกิดข้อผิดพลาดในการแปลงเสียง'
        return Response({'error': error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
