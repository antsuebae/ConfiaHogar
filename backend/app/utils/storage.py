import io
import uuid
from minio import Minio
from minio.error import S3Error
from fastapi import UploadFile, HTTPException
from app.config import settings

_client: Minio = None


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        _ensure_bucket()
    return _client


def _ensure_bucket():
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)
        # Política pública de lectura
        import json
        policy = {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{settings.minio_bucket}/*"],
            }],
        }
        client.set_bucket_policy(settings.minio_bucket, json.dumps(policy))


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024


async def upload_image(file: UploadFile, folder: str = "general") -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Solo se admiten imágenes JPG, PNG o WebP")
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, f"La imagen supera el límite de {settings.max_file_size_mb}MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    object_name = f"{folder}/{uuid.uuid4()}.{ext}"
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket,
        object_name,
        io.BytesIO(content),
        length=len(content),
        content_type=file.content_type,
    )
    return f"{settings.minio_public_url}/{settings.minio_bucket}/{object_name}"


async def upload_document(file: UploadFile, folder: str = "docs") -> str:
    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Solo se admiten PDF, JPG o PNG")
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, f"El archivo supera el límite de {settings.max_file_size_mb}MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
    object_name = f"{folder}/{uuid.uuid4()}.{ext}"
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket,
        object_name,
        io.BytesIO(content),
        length=len(content),
        content_type=file.content_type,
    )
    return f"{settings.minio_public_url}/{settings.minio_bucket}/{object_name}"


def delete_object(url: str):
    try:
        object_name = url.split(f"{settings.minio_bucket}/", 1)[-1]
        get_minio_client().remove_object(settings.minio_bucket, object_name)
    except S3Error:
        pass
