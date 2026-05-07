from rest_framework import serializers
from .models import Transcription


class TranscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transcription
        fields = ('id', 'filename', 'language', 'status', 'result', 'error_message', 'created_at', 'updated_at')
        read_only_fields = fields
