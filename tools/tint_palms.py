from PIL import Image

img = Image.open('assets/palm_trees.webp').convert('RGBA')
data = img.getdata()
new_data = []
tint = (188, 217, 196)
alpha_factor = 0.85

for r, g, b, a in data:
    if a == 0:
        new_data.append((0, 0, 0, 0))
    else:
        new_r = int((r * (1 - alpha_factor)) + (tint[0] * alpha_factor))
        new_g = int((g * (1 - alpha_factor)) + (tint[1] * alpha_factor))
        new_b = int((b * (1 - alpha_factor)) + (tint[2] * alpha_factor))
        new_data.append((new_r, new_g, new_b, int(a * 0.85)))

img.putdata(new_data)
img.save('assets/palm_trees.webp', 'WEBP')
print("Successfully baked tint into palm_trees.webp")
