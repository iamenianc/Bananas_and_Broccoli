import os
from PIL import Image

def clean_image(src_path, dest_path):
    try:
        from rembg import remove
    except ImportError:
        print("rembg is not installed. Please run `pip install rembg` to use the background remover.")
        return

    # Open image, process it with rembg to remove background
    img = Image.open(src_path).convert("RGBA")
    output_img = remove(img)
    
    # Save as webp
    output_img.save(dest_path, "WEBP", quality=90)
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
