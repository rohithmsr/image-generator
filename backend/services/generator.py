from sqlalchemy.orm import selectinload
from click import prompt
import asyncio
import logging

from sqlmodel import Session, select
from database import engine
from models import Job, Image
from services.openai_service import generate_image
from services.imagekit_service import upload_file

logger = logging.getLogger(__name__)

STYLES = {
    "bold_dramatic": (
        "Create a bold, dramatic YouTube thumbnail with high contrast, "
        "cinamatic lighting, dark moody background, and powerful composition."
        "The subject in the image should be prominent with a dramatic expression."
    ),
    "clean_minimal": (
        "Create a clean, minimal YouTube thumbnail with bright lighting, "
        "white/light background, modern professional aesthetic, plenty of "
        "whitespace, and sharp clean composition. The object in the image should look "
        "clear and well-lit"
    ),
    "fun_cartoony": (
        "Create a fun, cartoony YouTube thumbnail with bright colors,"
        " exaggerated features, and playful composition."
    ),
    "vibrant_energetic": (
        "Create a vibrant, energetic YouTube thumbnail with colorful gradients, "
        " dynamic angles, eye-catching pop-art style colors, and. energetic composition. "
        "The object / subject should have exciting or engaging expression"
    )
}

STYLE_ORDER = ["bold_dramatic", "clean_minimal", "fun_cartoony", "vibrant_energetic"]

async def generate_single_image(image_id: str, prompt: str, snapshot_url: str):
    # DB mark -> generating
    with Session(engine) as session:
        image = session.get(Image, image_id)
        if not image:
            logger.error("Image not found for id %s", image_id)
            return

        image.status = "generating"
        style_name = image.style_name
        session.add(image)
        session.commit()

    # AI call
    style_prompt = STYLES[style_name]
    try:
        image_bytes = await generate_image(prompt, style_prompt, snapshot_url)
        with Session(engine) as session:
            image = session.get(Image, image_id)
            job_id = image.job_id

        # upload the image
        url = upload_file(
            file_bytes=image_bytes,
            file_name=f"{image_id}.png",
            folder=f"images/{job_id}",
        )

        # DB mark -> uploaded and image url
        with Session(engine) as session:
            image = session.get(Image, image_id)
            image.status = "completed"
            image.image_url = url
            session.add(image)
            session.commit()
            
        logger.info("Successfully generated image for %s: %s", image_id, url)
    except Exception as e:
        logger.error("Failed to generate image for %s: %s", image_id, e)
        with Session(engine) as session:
            image = session.get(Image, image_id)
            if image:
                image.status = "failed"
                image.error_message = str(e)[:500]
                session.add(image)
                session.commit()
        return

async def process_job(job_id: str):
    # Make the job processing
    # Find all the images for the job
    # Start one worker for each image
    # Wait for the workers to finish
    # Mark the job as completed / failed

    with Session(engine) as session:
        stmt = select(Job).options(selectinload(Job.images)).where(Job.id == job_id)
        job = session.exec(stmt).first()
        if not job:
            logger.error("Job not found for id %s", job_id)
            return

        job.status = "processing"
        session.add(job)
        session.commit()

        prompt = job.prompt
        snapshot_url = job.snapshot_url
        image_ids = [image.id for image in job.images]

    # Create a background task for each image
    tasks = [generate_single_image(image_id, prompt, snapshot_url) for image_id in image_ids]
    await asyncio.gather(*tasks, return_exceptions=True)

    with Session(engine) as session:
        images = session.exec(
            select(Image).where(Image.job_id == job_id)
        ).all()

        db_job = session.get(Job, job_id)
        if db_job:
            if all(image.status == "failed" for image in images):
                db_job.status = "failed"
            else:
                db_job.status = "completed"
            session.add(db_job)
            session.commit()
