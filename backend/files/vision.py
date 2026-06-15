"""
Vision prompt builder — formats multimodal input for GPT-4o vision API.
"""

from __future__ import annotations


def build_vision_prompt(
    image_base64: str,
    file_type: str = "image",
    additional_context: str = "",
) -> list[dict]:
    """
    Build a multimodal prompt with image data for the vision API.

    Returns a list of content parts (text + image_url) suitable for
    OpenAI-compatible chat completion messages.
    """
    type_prompts = {
        "xray": (
            "Analyze this medical X-ray image. Describe any visible abnormalities, "
            "patterns, or areas of concern. Note: This analysis requires confirmation "
            "by a licensed radiologist. Flag: imaging_analysis: requires_radiologist_confirmation."
        ),
        "mri": (
            "Analyze this MRI scan image. Describe any visible abnormalities, "
            "structural findings, or areas of concern. Note: This analysis requires "
            "confirmation by a licensed radiologist."
        ),
        "lab_report": (
            "Read and extract all key findings from this lab report image. "
            "List each test name, result value, reference range, and whether "
            "the result is normal, high, or low."
        ),
        "image": (
            "Analyze this medical image. Describe what you observe, noting "
            "any visible abnormalities or patterns relevant to a medical assessment."
        ),
    }

    text_prompt = type_prompts.get(file_type, type_prompts["image"])
    if additional_context:
        text_prompt += f"\n\nAdditional context: {additional_context}"

    content_parts = [
        {"type": "text", "text": text_prompt},
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_base64}",
                "detail": "high",
            },
        },
    ]

    return content_parts
