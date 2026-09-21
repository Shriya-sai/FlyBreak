"""Build the short README gameplay loop from a captured FlyBreak screenshot."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/flybreak-gameplay.png"
OUTPUT = ROOT / "docs/flybreak-demo.gif"
SIZE = (960, 547)


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE = font(32, True)
LABEL = font(18, True)
SMALL = font(14, True)


def panel(draw, title, subtitle, color=(201, 255, 61), align="left"):
    tw = max(draw.textbbox((0, 0), title, font=TITLE)[2], draw.textbbox((0, 0), subtitle, font=LABEL)[2])
    width = min(800, tw + 52)
    x = 24 if align == "left" else SIZE[0] - width - 24
    draw.rounded_rectangle((x, 22, x + width, 112), radius=8, fill=(3, 12, 14, 235), outline=color, width=3)
    draw.text((x + 24, 36), title, font=TITLE, fill=color)
    draw.text((x + 25, 78), subtitle, font=LABEL, fill=(228, 239, 238))


def ring(frame, point, radius, color, width=7):
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = point
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), outline=color, width=width)
    glow = layer.filter(ImageFilter.GaussianBlur(10))
    frame.alpha_composite(glow)
    frame.alpha_composite(layer)


def line(frame, points, color, width=7):
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.line(points, fill=color, width=width, joint="curve")
    frame.alpha_composite(layer.filter(ImageFilter.GaussianBlur(8)))
    frame.alpha_composite(layer)


def cut_mark(frame, point):
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = point
    draw.ellipse((x-32, y-32, x+32, y+32), fill=(5, 18, 16, 225), outline=(201, 255, 61), width=5)
    draw.line((x-15, y-15, x+15, y+15), fill=(201, 255, 61), width=7)
    draw.line((x+15, y-15, x-15, y+15), fill=(201, 255, 61), width=7)
    frame.alpha_composite(layer.filter(ImageFilter.GaussianBlur(7)))
    frame.alpha_composite(layer)


base = Image.open(SOURCE).convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
base = ImageEnhance.Contrast(base).enhance(1.06)

# Coordinates on the resized 960 × 547 capture.
SOURCE_NODE = (202, 327)
MID_ROUTE = [(202, 327), (512, 350), (630, 330), (743, 252)]
SHARED_GATE = (632, 267)
PROTECTED = (733, 369)
SAFE_RELAY = (394, 373)

frames = []
durations = []


def add_frame(stage, duration=600, step=0):
    frame = base.convert("RGBA")
    shade = Image.new("RGBA", SIZE, (0, 0, 0, 20))
    frame.alpha_composite(shade)
    draw = ImageDraw.Draw(frame)

    if stage == "detect":
        panel(draw, "SIGNAL DETECTED", "LC4 → DNg108  //  00:08 REMAINING")
        ring(frame, SOURCE_NODE, 30 + step * 8, (75, 232, 235, 240), 6)

    elif stage == "race":
        panel(draw, "THE FLY IS MOVING", "Eight measured routes. Naturally.", (255, 183, 66), "right")
        line(frame, MID_ROUTE, (255, 183, 66, 205), 6)
        idx = min(len(MID_ROUTE) - 1, step)
        ring(frame, MID_ROUTE[idx], 17, (255, 235, 150, 255), 7)
        draw.text((MID_ROUTE[idx][0]-10, MID_ROUTE[idx][1]-15), "•", font=TITLE, fill=(255, 255, 255))

    elif stage == "trap":
        panel(draw, "OBVIOUS CUT. BAD IDEA.", "This gate also feeds a protected pathway.", (255, 92, 105), "right")
        line(frame, [SHARED_GATE, PROTECTED], (255, 92, 105, 235), 7)
        ring(frame, SHARED_GATE, 29 + step * 4, (255, 92, 105, 255), 7)
        ring(frame, PROTECTED, 27, (177, 138, 255, 255), 5)
        draw.rounded_rectangle((558, 458, 936, 520), radius=7, fill=(54, 10, 16, 235), outline=(255, 92, 105), width=3)
        draw.text((579, 471), "COLLATERAL DAMAGE: −14%", font=LABEL, fill=(255, 125, 135))

    elif stage == "cut":
        panel(draw, "TRACE BACKWARD. CUT UPSTREAM.", "Same route disabled. Protected output survives.")
        line(frame, [SAFE_RELAY, SHARED_GATE], (201, 255, 61, 210), 6)
        ring(frame, SAFE_RELAY, 33 + step * 4, (201, 255, 61, 255), 7)
        cut_mark(frame, SAFE_RELAY)

    elif stage == "reroute":
        panel(draw, "THE FLY REROUTES", "Because even insects have disaster recovery.", (255, 183, 66), "right")
        line(frame, MID_ROUTE, (255, 183, 66, 175), 5)
        ring(frame, MID_ROUTE[min(len(MID_ROUTE)-1, step)], 19, (255, 183, 66, 255), 6)
        cut_mark(frame, SAFE_RELAY)

    elif stage == "win":
        frame.alpha_composite(Image.new("RGBA", SIZE, (2, 12, 13, 150)))
        draw = ImageDraw.Draw(frame)
        draw.rounded_rectangle((150, 155, 810, 402), radius=16, fill=(3, 13, 15, 245), outline=(201, 255, 61), width=5)
        draw.text((235, 194), "SIGNAL CONTAINED", font=font(52, True), fill=(201, 255, 61))
        draw.text((291, 271), "FLY OUTSMARTED", font=font(34, True), fill=(236, 244, 243))
        draw.text((282, 330), "THE CAKE LIVES TO SEE ANOTHER DAY.", font=SMALL, fill=(135, 208, 205))

    frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=192))
    durations.append(duration)


add_frame("detect", 900, 0)
add_frame("detect", 900, 1)
for i in range(4):
    add_frame("race", 650, i)
add_frame("trap", 1200, 0)
add_frame("trap", 1800, 1)
add_frame("cut", 1200, 0)
add_frame("cut", 1800, 1)
for i in range(1, 4):
    add_frame("reroute", 650, i)
add_frame("win", 2300)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(
    OUTPUT,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    optimize=True,
    disposal=2,
)
print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.1f} MB)")
