from pydantic._internal import _schema_generation_shared
from starlette.responses import StreamingResponse
from services.imagekit_service import get_variants
from sqlmodel import select
import asyncio
from services.generator import process_job
from models import Job
from models import Image
from fastapi import HTTPException
from services.generator import STYLE_ORDER
from database import get_session
from fastapi import Depends
from sqlmodel import Session
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
    num_images: int
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
    num_images: int
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
    if request.num_images < 1 or request.num_images > len(STYLE_ORDER):
        raise HTTPException(status_code=400, detail=f"Number of images must be between 1 and {len(STYLE_ORDER)}")

    job = Job(
        prompt=request.prompt,
        snapshot_url=request.snapshot_url,
        num_images=request.num_images,
    )
    session.add(job)

    styles = STYLE_ORDER[:request.num_images]
    for style_name in styles:
        image = Image(
            job_id=job.id,
            style_name=style_name,
        )
        session.add(image)

    session.commit()

    asyncio.create_task(process_job(job.id))

    return CreateJobResponse(job_id=job.id)

@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(session: Session = Depends(get_session)):
    jobs = session.exec(select(Job).order_by(Job.created_at.desc())).all()
    response: list[JobResponse] = []
    for job in jobs:
        images = session.exec(select(Image).where(Image.job_id == job.id)).all()
        image_responses: list[ImageResponse] = []
        for image in images:
            variants = get_variants(image.image_url) if image.image_url else None
            image_responses.append(
                ImageResponse(
                    id=image.id,
                    style_name=image.style_name,
                    status=image.status,
                    image_url=image.image_url,
                    error_message=image.error_message,
                    variants=variants,
                )
            )
        response.append(
            JobResponse(
                id=job.id,
                status=job.status,
                prompt=job.prompt,
                snapshot_url=job.snapshot_url,
                num_images=job.num_images,
                images=image_responses,
            )
        )
    return response

@router.get("/jobs/{job_id}", response_model=JobResponse)
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
                image_url=image.image_url,
                error_message=image.error_message,
                variants=variants,
            )
        )

    return JobResponse(
        id=job.id,
        status=job.status,
        prompt=job.prompt,
        snapshot_url=job.snapshot_url,
        num_images=job.num_images,
        images=image_responses,
    )

from fastapi import Request

@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str, request: Request):
    async def event_generator():
        from database import engine
        sent_images = set()
        max_duration = 300.0  # 5 minutes max duration
        elapsed = 0.0
        interval = 1.5

        while elapsed < max_duration:
            # Check if the client closed the connection
            if await request.is_disconnected():
                return

            with Session(engine) as session:
                job = session.get(Job, job_id)
                if not job:
                    data = json.dumps({
                        "error": "Job not found"
                    })
                    yield f"event: error\ndata: {data}\n\n"
                    return

                images = session.exec(
                    select(Image).where(Image.job_id == job_id)
                ).all()
                
                for image in images:
                    if image.id not in sent_images:
                        if image.status == "completed":
                            sent_images.add(image.id)
                            yield format_image_ready(image)
                        elif image.status == "failed":
                            sent_images.add(image.id)
                            yield format_image_failed(image)
                
                all_images_processed = all(image.status in ["completed", "failed"] for image in images)
                if all_images_processed and len(sent_images) == len(images):
                    yield format_job_complete(job)
                    return

            # Keep-alive heartbeat to prevent firewalls/proxies from timing out
            yield ": keep-alive\n\n"

            await asyncio.sleep(interval)
            elapsed += interval

        # Timeout reached
        data = json.dumps({
            "error": "Image generation tracking timed out."
        })
        yield f"event: error\ndata: {data}\n\n"
    
    def format_image_ready(image: Image):
        variants = get_variants(image.image_url) if image.image_url else None
        data = json.dumps({
            "image_id": image.id,
            "style_name": image.style_name,
            "image_url": image.image_url,
            "variants": variants,
        })
        return f"event: image_ready\ndata: {data}\n\n"
    
    def format_image_failed(image: Image):
        data = json.dumps({
            "image_id": image.id,
            "style_name": image.style_name,
            "error": image.error_message,
        })
        return f"event: image_failed\ndata: {data}\n\n"
    
    def format_job_complete(job: Job):
        data = json.dumps({
            "job_id": job.id,
            "status": job.status
        })
        return f"event: job_completed\ndata: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )