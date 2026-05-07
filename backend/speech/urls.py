from django.urls import path
from . import views

urlpatterns = [
    path('submit/', views.submit, name='speech_submit'),
    path('jobs/', views.list_jobs, name='speech_jobs'),
    path('jobs/<int:pk>/', views.job_detail, name='speech_job_detail'),
]
