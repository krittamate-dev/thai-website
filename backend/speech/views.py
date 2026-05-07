from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Transcription
from .serializers import TranscriptionSerializer
from .tasks import run_in_background

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
LANGUAGE_MAP = {'th': 'th-TH', 'en': 'en-US'}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def submit(request):
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return Response({'error': 'กรุณาอัปโหลดไฟล์เสียง'}, status=status.HTTP_400_BAD_REQUEST)

    if audio_file.size > MAX_FILE_SIZE:
        return Response({'error': 'ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)'}, status=status.HTTP_400_BAD_REQUEST)

    lang_key = request.data.get('language', 'th')
    language_code = LANGUAGE_MAP.get(lang_key, 'th-TH')

    job = Transcription.objects.create(
        user=request.user,
        filename=audio_file.name,
        audio_file=audio_file,
        language=language_code,
        status='pending',
    )

    run_in_background(job.id)

    return Response(TranscriptionSerializer(job).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_jobs(request):
    jobs = Transcription.objects.filter(user=request.user)
    return Response(TranscriptionSerializer(jobs, many=True).data)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def job_detail(request, pk):
    try:
        job = Transcription.objects.get(id=pk, user=request.user)
    except Transcription.DoesNotExist:
        return Response({'error': 'ไม่พบงาน'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if job.audio_file:
            job.audio_file.delete(save=False)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    return Response(TranscriptionSerializer(job).data)
