from django.db import models
from django.contrib.auth.models import User


class Transcription(models.Model):
    STATUS_CHOICES = [
        ('pending', 'รอดำเนินการ'),
        ('processing', 'กำลังประมวลผล'),
        ('done', 'เสร็จสิ้น'),
        ('failed', 'ล้มเหลว'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transcriptions')
    filename = models.CharField(max_length=255)
    audio_file = models.FileField(upload_to='audio/', null=True, blank=True)
    language = models.CharField(max_length=10, default='th-TH')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    result = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.filename} ({self.status})"
