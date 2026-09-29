"""
A one-off helper, not part of the app. It was used once to make
bee-idle.gif, and only needs running again if the bee animation changes.
Run it from this folder with:  python3 make_transparent.py

What it does: the original bee animation (bee-idle-original.gif) has a
cream background. This script removes that background (makes it see-through)
on every frame, so the bee sits nicely on any colour.

The tricky part is that the bee's wings are white too, and we don't want
holes in them! So instead of "remove everything light-coloured", it works
like the paint-bucket tool in a drawing app: start at the edges of the
picture and spread inward through pixels of a similar colour. The
background touches the edges, so it all gets picked up. The wings are
surrounded by the bee's dark outline, so the spreading can never reach them.

The animation's speed, number of frames, and looping are kept exactly as
they were.
"""

# Picture tools (Pillow), number-crunching tools (numpy), and a simple queue.
from PIL import Image, ImageSequence
import numpy as np
from collections import deque

# The picture we read from, and the new picture we write.
SRC = "bee-idle-original.gif"
DST = "bee-idle.gif"
# How different two neighbouring pixels can be and still count as "the
# same background". Bigger = more gets removed.
TOLERANCE = 18


def flood_fill_edges(rgb: np.ndarray) -> np.ndarray:
    """The paint-bucket step. Gives back a yes/no grid the same size as the
    picture: "yes" for every pixel that's part of the background."""
    # The picture's height and width, a grid to remember which pixels are
    # background, and a to-do list of pixels still to spread out from.
    h, w, _ = rgb.shape
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    # Mark a pixel as background and add it to the to-do list.
    def seed(y, x):
        if not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))

    # Start with every pixel around the edge of the picture.
    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    # Switch to a number type that can go negative, so subtracting colours
    # below works properly.
    rgb_i = rgb.astype(np.int16)

    # Keep going until the to-do list is empty. For each pixel, look at its
    # four neighbours (up, down, left, right). If a neighbour is close enough
    # in colour, it's background too - mark it and add it to the list.
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


# The main job: go through every frame, remove its background, and save
# the new animation.
def process():
    im = Image.open(SRC)
    frames_out = []
    durations = []

    # For each frame: find the background, make it fully see-through, and
    # keep the bee fully solid. Remember how long each frame shows for.
    for frame in ImageSequence.Iterator(im):
        rgba = frame.convert("RGBA")
        arr = np.array(rgba)
        rgb = arr[:, :, :3]

        bg_mask = flood_fill_edges(rgb)

        arr[:, :, 3] = np.where(bg_mask, 0, 255)
        out = Image.fromarray(arr, mode="RGBA")
        frames_out.append(out)
        durations.append(frame.info.get("duration", 100))

    # How many times the animation repeats (0 = forever).
    loop = im.info.get("loop", 0)

    # GIFs can only use 256 colours per frame, and only one of those can be
    # "see-through". So squeeze each frame down to 255 real colours and use
    # the last slot (number 255) for see-through.
    quantized = []
    for f in frames_out:
        # Pick the best 255 colours for this frame, then paint the
        # see-through slot over every background pixel.
        alpha = f.getchannel("A")
        p = f.convert("RGB").convert(
            "P", palette=Image.ADAPTIVE, colors=255
        )
        mask = Image.eval(alpha, lambda a: 255 if a <= 10 else 0)
        p.paste(255, mask)
        quantized.append(p)

    # Save all the frames as one animated GIF, with the original timing and
    # looping. Each frame fully replaces the last one (so no ghosting).
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


# Only run when you start this file directly (not when another script loads it).
if __name__ == "__main__":
    process()
