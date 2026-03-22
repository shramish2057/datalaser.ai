from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import profile, transform, join, validate
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="DataLaser Pipeline Service",
    description="Enterprise data preparation pipeline",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router, prefix="/profile", tags=["Profiling"])
app.include_router(transform.router, prefix="/transform", tags=["Transform"])
app.include_router(join.router, prefix="/join", tags=["Join"])
app.include_router(validate.router, prefix="/validate", tags=["Validate"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "DataLaser Pipeline"}


@app.get("/")
async def root():
    return {"service": "DataLaser Pipeline Service", "version": "1.0.0"}
