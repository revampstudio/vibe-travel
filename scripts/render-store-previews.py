#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps/mobile/store-assets"
BACKDROP = ASSETS / "generated-preview-backdrop.png"
RAW_SCREENS = ASSETS / "raw-screenshots"

FONT_REGULAR = Path("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf")
FONT_MEDIUM = Path("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf")
FONT_BOLD = Path("/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf")


@dataclass(frozen=True)
class ScreenSpec:
    key: str
    headline: str
    subhead: str


SCREENS = [
    ScreenSpec(
        "home",
        "Build your personal travel map",
        "Start with birth details and get a map made for you.",
    ),
    ScreenSpec(
        "map",
        "See your best places worldwide",
        "Explore destination lines, advisories, and city context.",
    ),
    ScreenSpec(
        "insights",
        "Compare cities for your year",
        "Find places aligned to your current travel pattern.",
    ),
    ScreenSpec(
        "city",
        "Open detailed city guidance",
        "Review advisory context, activity ideas, and planetary notes.",
    ),
]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def fit_text(draw: ImageDraw.ImageDraw, text: str, font_path: Path, start_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    for size in range(start_size, 20, -2):
        fnt = font(font_path, size)
        if draw.textbbox((0, 0), text, font=fnt)[2] <= max_width:
            return fnt
    return font(font_path, 20)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        if draw.textbbox((0, 0), candidate, font=fnt)[2] <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def cover_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def gradient_overlay(size: tuple[int, int]) -> Image.Image:
    width, height = size
    strip = Image.new("RGBA", (1, height), (0, 0, 0, 0))
    pixels = strip.load()
    for y in range(height):
        top_alpha = max(0, int(150 * (1 - y / (height * 0.48))))
        bottom_alpha = max(0, int(95 * ((y - height * 0.62) / (height * 0.38))))
        alpha = min(170, max(top_alpha, bottom_alpha))
        pixels[0, y] = (7, 23, 39, alpha)
    return strip.resize((width, height))


def save_png(img: Image.Image, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "PNG", compress_level=6)


def make_background(size: tuple[int, int], shift: int) -> Image.Image:
    backdrop = Image.open(BACKDROP).convert("RGB")
    target_w, target_h = size
    scale = max(target_w / backdrop.width, target_h / backdrop.height)
    resized = backdrop.resize((round(backdrop.width * scale), round(backdrop.height * scale)), Image.Resampling.LANCZOS)
    left_range = max(0, resized.width - target_w)
    top_range = max(0, resized.height - target_h)
    left = min(left_range, max(0, int(left_range * (0.18 + shift * 0.16))))
    top = min(top_range, max(0, int(top_range * (0.06 + shift * 0.04))))
    bg = resized.crop((left, top, left + target_w, top + target_h)).convert("RGBA")
    bg.alpha_composite(gradient_overlay(size))
    return bg


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width, img.height), radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def paste_phone(canvas: Image.Image, screen: Image.Image, cx: int, y: int, content_w: int) -> None:
    content_h = round(content_w * screen.height / screen.width)
    pad = max(10, round(content_w * 0.038))
    frame_w = content_w + pad * 2
    frame_h = content_h + pad * 2
    radius = max(24, round(frame_w * 0.09))
    x = cx - frame_w // 2

    shadow = Image.new("RGBA", (frame_w + pad * 8, frame_h + pad * 8), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (pad * 4, pad * 4, pad * 4 + frame_w, pad * 4 + frame_h),
        radius=radius,
        fill=(0, 0, 0, 145),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(12, pad * 2)))
    canvas.alpha_composite(shadow, (x - pad * 4, y - pad * 4))

    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    frame_draw = ImageDraw.Draw(frame)
    frame_draw.rounded_rectangle((0, 0, frame_w, frame_h), radius=radius, fill=(18, 25, 36, 255))
    inner = screen.resize((content_w, content_h), Image.Resampling.LANCZOS)
    frame.alpha_composite(rounded(inner, max(20, radius - pad)), (pad, pad))

    pill_w = round(content_w * 0.18)
    pill_h = max(5, round(content_w * 0.018))
    pill_x = (frame_w - pill_w) // 2
    pill_y = max(7, pad // 2)
    frame_draw.rounded_rectangle(
        (pill_x, pill_y, pill_x + pill_w, pill_y + pill_h),
        radius=pill_h // 2,
        fill=(255, 255, 255, 68),
    )
    canvas.alpha_composite(frame, (x, y))


def draw_text_block(canvas: Image.Image, spec: ScreenSpec, scale: float) -> None:
    draw = ImageDraw.Draw(canvas)
    margin = round(canvas.width * 0.09)
    max_width = canvas.width - margin * 2
    label_font = font(FONT_MEDIUM, max(12, round(24 * scale)))
    headline_font = fit_text(draw, spec.headline, FONT_BOLD, round(70 * scale), max_width)
    sub_font = font(FONT_REGULAR, max(14, round(30 * scale)))
    y = round(canvas.height * 0.085)
    draw.text((margin, y), "VIBE TRAVEL MAP", font=label_font, fill=(251, 231, 202, 230))
    y += round(42 * scale)
    for line in wrap_text(draw, spec.headline, headline_font, max_width):
        draw.text((margin, y), line, font=headline_font, fill=(255, 255, 255, 255))
        y += round(headline_font.size * 1.05)
    y += round(12 * scale)
    for line in wrap_text(draw, spec.subhead, sub_font, max_width):
        draw.text((margin, y), line, font=sub_font, fill=(232, 242, 244, 232))
        y += round(sub_font.size * 1.3)


def render_preview(spec: ScreenSpec, screen: Image.Image, size: tuple[int, int], out: Path, shift: int) -> None:
    canvas = make_background(size, shift)
    scale = size[0] / 1290
    draw_text_block(canvas, spec, scale)
    if size[1] / size[0] < 1.9:
        content_w = round(size[0] * 0.50)
        y = round(size[1] * 0.36)
    else:
        content_w = round(size[0] * 0.56)
        y = round(size[1] * 0.34)
    paste_phone(canvas, screen, size[0] // 2, y, content_w)
    save_png(canvas, out)


def render_feature_graphic(source_screens: dict[str, Image.Image]) -> None:
    size = (1024, 500)
    canvas = make_background(size, 1)
    draw = ImageDraw.Draw(canvas)
    title = "Vibe Travel Map"
    headline = "Personal destination ideas, mapped"
    margin = 62
    draw.text((margin, 68), title, font=font(FONT_MEDIUM, 24), fill=(251, 231, 202, 235))
    draw.text((margin, 112), headline, font=fit_text(draw, headline, FONT_BOLD, 58, 520), fill=(255, 255, 255, 255))
    sub = "Explore city matches, travel context, and activity ideas."
    for idx, line in enumerate(wrap_text(draw, sub, font(FONT_REGULAR, 24), 480)):
        draw.text((margin, 246 + idx * 34), line, font=font(FONT_REGULAR, 24), fill=(232, 242, 244, 230))

    for i, key in enumerate(("map", "insights")):
        screen = source_screens[key]
        paste_phone(canvas, screen, 690 + i * 154, 62 + i * 18, 170)

    save_png(canvas, ASSETS / "feature-graphic-1024x500.png")


def main() -> None:
    source_screens = {
        spec.key: Image.open(RAW_SCREENS / f"{spec.key}.png").convert("RGB")
        for spec in SCREENS
    }
    for i, spec in enumerate(SCREENS):
        screen = source_screens[spec.key]
        render_preview(spec, screen, (390, 844), ASSETS / f"store-screenshot-{spec.key}.png", i)
        render_preview(spec, screen, (1080, 1920), ASSETS / "play-upload" / f"store-screenshot-{spec.key}-1080x1920.png", i)
        render_preview(spec, screen, (1284, 2778), ASSETS / "app-store-upload" / f"store-screenshot-{spec.key}-1284x2778.png", i)
        render_preview(spec, screen, (1290, 2796), ASSETS / "app-store-upload" / f"store-screenshot-{spec.key}-1290x2796.png", i)
    render_feature_graphic(source_screens)


if __name__ == "__main__":
    main()
