import base64
import base64
from openai import AsyncOpenAI

from config import OPENAI_API_KEY

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

async def generate_image(prompt: str, style_prompt: str, snapshot_url: str) -> bytes:
    """
    Use the Response API with gpt-image-2 as a built-in image_generation tool.
    Pass the snapshot URL directly as an input image
    Returns the PNG type
    """

    full_prompt = (
        f"{style_prompt}\n\n",
        f"User request: {prompt}\n\n",
        "IMPORTANT: The generated image should predominantly feature the image given as the snapshot URL. Keep their likeness accurate"
    )

    response = client.responses.create(
        model="gpt-4o-mini",
        input=[
            {"type": "text", "text": full_prompt},
            {"type": "image_url", "image_url": {"url": snapshot_url}}
        ],
        tools=[
            {
                "type": "image_generation",
                "model": "gpt-image-1-mini",
                "size": "1024x1024",
                "quality": "low",
                "output_format": "png"
            }
        ],
    )

    for item in response.output:
        if item.type == "image_generation_call" and item.result:
            return base64.b64decode(item.result)

    raise RuntimeError("Failed to generate image")