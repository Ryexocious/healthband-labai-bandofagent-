"""
File Parser — PDF and image processing for uploaded medical files.
Extracts text from PDFs via PyMuPDF and encodes images to base64.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Optional

from fastapi import HTTPException, UploadFile

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/dicom",
}
MAX_FILE_SIZE_MB = 10


def validate_upload(file: UploadFile) -> bool:
    """Validate file type and size."""
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    if file.size and file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum {MAX_FILE_SIZE_MB}MB.")
    return True


async def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts).strip()
    except ImportError:
        logger.warning("PyMuPDF not installed — PDF parsing unavailable")
        return "[PDF parsing unavailable — PyMuPDF not installed]"
    except Exception as e:
        logger.error(f"PDF parsing error: {e}")
        return f"[PDF parsing error: {e}]"


async def parse_image(file_bytes: bytes) -> str:
    """Encode an image to base64 for the vision API."""
    try:
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        return encoded
    except Exception as e:
        logger.error(f"Image encoding error: {e}")
        return ""


def detect_file_type(filename: str, content_type: Optional[str]) -> str:
    """Detect whether a file is a lab report, X-ray, or generic image."""
    lower_name = filename.lower() if filename else ""

    if content_type == "application/pdf":
        return "lab_report"

    # Simple heuristics for medical images
    if any(kw in lower_name for kw in ["xray", "x-ray", "x_ray", "chest", "lung"]):
        return "xray"
    if any(kw in lower_name for kw in ["mri", "scan", "ct"]):
        return "mri"

    return "image"


async def process_upload(file: UploadFile) -> dict:
    """
    Process a single uploaded file and return structured metadata.
    Files are processed in memory only — never written to disk.
    """
    validate_upload(file)
    file_bytes = await file.read()
    filename = file.filename or "unknown"
    file_type = detect_file_type(filename, file.content_type)

    result = {
        "filename": filename,
        "type": file_type,
        "content_type": file.content_type,
        "size_bytes": len(file_bytes),
    }

    if file.content_type == "application/pdf":
        text = await parse_pdf(file_bytes)
        result["extracted_text"] = text
        result["base64"] = None
    else:
        b64 = await parse_image(file_bytes)
        result["extracted_text"] = None
        result["base64"] = b64

    return result
