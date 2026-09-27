"""
Make the background of bee-idle.gif transparent, frame by frame, without
touching interior light colours (white wings, highlights).

Approach: for each frame, flood-fill from the four image edges through
pixels that are close (within a colour tolerance) to their edge-adjacent
neighbour's background colour, using 4-connectivity so the fill can only
reach a pixel by walking a path of similar-enough pixels starting at the
border. This means:
  - The cream backdrop, which is one connected region touching all four
    edges, gets marked and made transparent.
  - Any light pixel that is NOT connected to the edge through a chain of
    similar colours (e.g. the white wings, which are surrounded by dark
    outline pixels) is left alone, even though it's also "light".

Frame timing, frame count, and loop count are preserved exactly by reusing
each frame's own `duration` from the source gif and rebuilding with the same
loop parameter.
"""

from PIL import Image, ImageSequence
import numpy as np
from collections import deque

SRC = "bee-idle-original.gif"
DST = "bee-idle.gif"
TOLERANCE = 18  # per-channel colour distance allowed during the flood fill


def flood_fill_edges(rgb: np.ndarray) -> np.ndarray:
    """Return a boolean mask, True where pixels are part of the
    edge-connected background region."""
    h, w, _ = rgb.shape
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    def seed(y, x):
        if not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    rgb_i = rgb.astype(np.int16)

    while q:
        y, x = q.popleft()
        base = rgb_i[y, x]
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                diff = np.abs(rgb_i[ny, nx] - base)
                if diff.max() <= TOLERANCE:
                    visited[ny, nx] = True
                    q.append((ny, nx))
    return visited


def process():
    im = Image.open(SRC)
    frames_out = []
    durations = []

    for frame in ImageSequence.Iterator(im):
        rgba = frame.convert("RGBA")
        arr = np.array(rgba)
        rgb = arr[:, :, :3]

        bg_mask = flood_fill_edges(rgb)

        arr[:, :, 3] = np.where(bg_mask, 0, 255)
        out = Image.fromarray(arr, mode="RGBA")
        frames_out.append(out)
        durations.append(frame.info.get("duration", 100))

    loop = im.info.get("loop", 0)

    # Quantize each RGBA frame to a palette that includes a transparent
    # index, then save as an animated GIF preserving durations + loop.
    quantized = []
    for f in frames_out:
        # Use adaptive palette per frame but keep alpha via mask paste onto
        # an "P" image with a reserved transparent index.
        alpha = f.getchannel("A")
        p = f.convert("RGB").convert(
            "P", palette=Image.ADAPTIVE, colors=255
        )
        mask = Image.eval(alpha, lambda a: 255 if a <= 10 else 0)
        # Reserve index 255 for transparency
        p.paste(255, mask)
        quantized.append(p)

    quantized[0].save(
        DST,
        save_all=True,
        append_images=quantized[1:],
        duration=durations,
        loop=loop,
        disposal=2,
        transparency=255,
        optimize=False,
    )
    print(f"Wrote {DST}: {len(quantized)} frames, loop={loop}, durations={durations[:5]}...")


if __name__ == "__main__":
    process()
