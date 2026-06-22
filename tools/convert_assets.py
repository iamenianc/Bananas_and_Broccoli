import os
from PIL import Image

def clean_image(src_path, dest_path):
    img = Image.open(src_path).convert("RGBA")
    width, height = img.size
    
    # We want to find the background checkerboard.
    # Let's see the colors at the borders.
    # We'll do a flood fill from the borders.
    # A pixel is traversable in the flood fill if it matches the checkerboard pattern:
    # - It is gray-ish (R, G, B are very close to each other, stddev is small)
    # - And the brightness is in the range of the background colors (e.g., around 190-215 or 240-250)
    
    visited = set()
    queue = []
    
    # Add all border pixels to queue
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(1, height - 1):
        queue.append((0, y))
        queue.append((width - 1, y))
        
    for p in queue:
        visited.add(p)
        
    # Flood fill
    # To be safe, let's define a helper to check if a pixel color matches the checkerboard.
    # Looking at inspect_image output:
    # #CFCFCF = (207, 207, 207)
    # #F5F5F5 = (245, 245, 245)
    # They are neutral grays. So R, G, B should be very close (e.g. max(R,G,B) - min(R,G,B) <= 5).
    # And the values should be around 190 to 255.
    
    def is_background_color(r, g, b):
        if max(r, g, b) - min(r, g, b) > 15:
            return False
        # Any neutral gray/white pixel above 180 is part of the checkerboard background
        return r >= 180

    bg_mask = [[False] * height for _ in range(width)]
    
    # Run BFS
    idx = 0
    while idx < len(queue):
        x, y = queue[idx]
        idx += 1
        
        r, g, b, a = img.getpixel((x, y))
        if is_background_color(r, g, b):
            bg_mask[x][y] = True
            # Check neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        visited.add((nx, ny))
                        # Only propagate if neighbor is also background-like
                        nr, ng, nb, _ = img.getpixel((nx, ny))
                        if is_background_color(nr, ng, nb):
                            queue.append((nx, ny))

    # Create new image with transparency
    new_data = []
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            if bg_mask[x][y]:
                new_data.append((0, 0, 0, 0)) # Make fully transparent
            else:
                new_data.append((r, g, b, a))
                
    img.putdata(new_data)
    img.save(dest_path, "WEBP", quality=90)
    print(f"Converted {src_path} -> {dest_path}")

# Run conversion on standard assets if script is run directly
if __name__ == "__main__":
    # Script sits in /tools, assets sit in /assets
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "assets")
    
    banana_png = os.path.join(assets_dir, "banana.png")
    banana_webp = os.path.join(assets_dir, "banana.webp")
    if os.path.exists(banana_png):
        clean_image(banana_png, banana_webp)
        
    banana_peeled_png = os.path.join(assets_dir, "banana_peeled.png")
    banana_peeled_webp = os.path.join(assets_dir, "banana_peeled.webp")
    if os.path.exists(banana_peeled_png):
        clean_image(banana_peeled_png, banana_peeled_webp)
        
    broccoli_png = os.path.join(assets_dir, "broccoli.png")
    broccoli_webp = os.path.join(assets_dir, "broccoli.webp")
    if os.path.exists(broccoli_png):
        clean_image(broccoli_png, broccoli_webp)
