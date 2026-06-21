from routes import router
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Starting server...")
    create_db_and_tables()
    yield
    logging.info("Stopping server...")

app = FastAPI(
    title="Image Generator with FastAPI",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # just for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
