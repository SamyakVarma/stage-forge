import sys
import os
import json
import time

def generate_image(prompt, output_dir):
    try:
        import torch
        from diffusers import DiffusionPipeline
        
        # Determine device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        # Optional: Apple Silicon support (MPS)
        if torch.backends.mps.is_available():
            device = "mps"
            
        # Optimization for CPU if CUDA/MPS is unavailable
        dtype = torch.float32 if device == "cpu" else torch.bfloat16

        # Use device_map="cuda" or fallback to manual to(device)
        kwargs = {
            "torch_dtype": dtype,
            "use_safetensors": True,
        }
        if device == "cuda":
            kwargs["device_map"] = "cuda"

        pipe = DiffusionPipeline.from_pretrained("fluently/Fluently-XL-v2", **kwargs)
        if device != "cuda":
            pipe.to(device)

        pipe.load_lora_weights("ehristoforu/dalle-3-xl-v2")

        # Refine prompt for SVG-like isolated assets
        refined_prompt = f"{prompt}, isolated on a plain solid white background #FFFFFF, clean edges, flat illustration style, SVG vector art style, professional stage production asset, no text, no labels, no watermarks, <lora:dalle-3-xl-lora-v2:0.8>"
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate filename
        filename = f"asset-gen-{int(time.time())}.png"
        filepath = os.path.join(output_dir, filename)
        
        # Generate image
        image = pipe(refined_prompt).images[0]
        image.save(filepath)
        
        print(json.dumps({
            "success": True,
            "filename": filename,
            "filepath": filepath,
            "url": f"/generated/{filename}"
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing prompt or output directory arguments"}))
        sys.exit(1)
        
    prompt = sys.argv[1]
    output_dir = sys.argv[2]
    
    generate_image(prompt, output_dir)
