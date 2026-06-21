from pydantic._internal import _schema_generation_shared
from starlette.responses import StreamingResponse
from services.imagekit_service import get_variants
from sqlalchemy import select
import asyncio
from services.generator import process_job
from models import Job
from models import Image
from fastapi import HTTPException
from services.generator import STYLE_ORDER
from database import get_session
from fastapi import Depends
from sqlalchemy.orm import Session
from services.imagekit_service import upload_file
from fastapi import UploadFile
from fastapi import File
from pydantic import BaseModel
from typing import Union
import logging
import json

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# Request / Response Schemas
class CreateJobRequest(BaseModel):
    prompt: str
    num_thumbnails: int
    snapshot_url: str

class CreateJobResponse(BaseModel):
    job_id: str

class ImageResponse(BaseModel):
    id: str
    style_name: str
    status: str
    image_url: Union[str, None] = None
    error_message: Union[str, None] = None
    variants: Union[dict, None] = None

class JobResponse(BaseModel):
    id: str
    status: str
    prompt: str
    snapshot_url: str
    num_thumbnails: int
    images: list[ImageResponse]

@router.post("/upload-snapshot")
async def upload_snapshot(file: UploadFile = File(...)):
    contents = await file.read()
    url = upload_file(
        file_bytes=contents,
        file_name=file.filename or "snapshot.png",
        folder="/snapshots",
        content_type=file.content_type or "image/png",
    )
    return {"url": url}

@router.post("/job", response_model=CreateJobResponse)
async def create_job(request: CreateJobRequest, session: Session = Depends(get_session)):
    if request.num_thumbnails < 1 and request.num_thumbnails > len(STYLE_ORDER):
        raise HTTPException(status_code=400, detail=f"Number of thumbnails must be between 1 and {len(STYLE_ORDER)}")

    job = Job(
        prompt=request.prompt,
        snapshot_url=request.snapshot_url,
        num_thumbnails=request.num_thumbnails,
    )
    session.add(job)

    styles = STYLE_ORDER[:request.num_thumbnails]
    for style_name in styles:
        image = Image(
            job_id=job.id,
            style_name=style_name,
        )
        session.add(image)

    session.commit()

    asyncio.create_task(process_job(job.id))

    return CreateJobResponse(job_id=job.id)

@router.get("jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    images = session.exec(select(Image).where(Image.job_id == job_id)).all()
    image_responses: list[ImageResponse] = []
    for image in images:
        variants = get_variants(image.image_url) if image.image_url else None
        image_responses.append(
            ImageResponse(
                id=image.id,
                style_name=image.style_name,
                status=image.status,
                imagekit_url=image.image_url,
                error_message=image.error_message,
                variants=variants,
            )
        )

    return JobResponse(
        id=job.id,
        status=job.status,
        prompt=job.prompt,
        snapshot_url=job.snapshot_url,
        num_thumbnails=job.num_thumbnails,
        images=image_responses,
    )

@router.get("jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """
    loop for every 1.5 s:

    get_image

    for each image:
        if new + completed = send image ready
        if new + failed = send image failed

    if all done:
        send job complete
        exit loop
    """
    async def event_generator():
        from database import engine
        sent_images = set()

        while True:
            with Session(engine) as session:
                job = session.get(Job, job_id)
                if not job:
                    data = json.dumps({
                        "error": "Job not found"
                    })
                    yield f"""
                        event: error\n
                        data: {data}\n\n
                    """
                    return

                images = session.exec(
                    select(Image).where(Image.job_id == job_id)
                ).all()
                
                for image in images:
                    if image.id not in sent_images:
                        if image.status == "completed":
                            sent_images.add(image.id)
                            yield_image_ready(image)
                        elif image.status == "failed":
                            sent_images.add(image.id)
                            yield_image_failed(image)
                
                all_images_processed = all(image.status in ["completed", "failed"] for image in images)
                if all_images_processed and len(sent_images) == len(images):
                    yield_job_complete(job)
                    return

            await asyncio.sleep(1.5)
    
    def yield_image_ready(image: Image):
        variants = get_variants(image.image_url)
        data = json.dumps({
            "image_id": image.id,
            "style_name": image.style_name,
            "image_url": image.image_url,
            "variants": variants,
        })
        yield f"""
            event: image_ready\n
            data: {data}\n\n
        """
    
    def yield_image_failed(image: Image):
        data = json.dumps({
            "image_id": image.id,
            "style_name": image.style_name,
            "error": image.error_message,
        })
        yield f"""
            event: image_failed\n
            data: {data}\n\n
        """
    
    def yield_job_complete(job: Job):
        data = json.dumps({
            "job_id": job.id,
            "status": job.status
        })
        yield f"""
            event: job_completed\n
            data: {data}\n\n
        """

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )