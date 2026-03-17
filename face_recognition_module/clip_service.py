"""
CLIP Service for Text-to-Image Matching
Provides endpoints for ranking face images against text descriptions
"""

from flask import Flask, request, jsonify
from transformers import CLIPProcessor, CLIPModel
import torch
from PIL import Image
import requests
from io import BytesIO
import numpy as np

app = Flask(__name__)

# Load CLIP model (runs once on startup)
print("Loading CLIP model...")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
print("CLIP model loaded successfully")

def cosine_similarity(a, b):
    """Calculate cosine similarity between two vectors"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

@app.route('/clip-rank', methods=['POST'])
def clip_rank():
    """
    Rank candidate face images against a text description
    
    Request body:
    {
        "description": "fair skin, long black hair, wearing glasses, scar on left cheek",
        "candidates": [
            {"id": "uuid", "image_url": "https://...", "name": "John Doe", ...},
            ...
        ]
    }
    
    Response:
    [
        {"id": "uuid", "name": "John Doe", "clip_similarity": 0.85, ...},
        ...
    ]
    """
    try:
        data = request.json
        description = data.get('description', '')
        candidates = data.get('candidates', [])
        
        if not description:
            return jsonify({'error': 'description is required'}), 400
        
        if not candidates:
            return jsonify({'error': 'candidates array is required'}), 400
        
        # Encode text description
        text_inputs = processor(text=[description], return_tensors="pt", padding=True)
        with torch.no_grad():
            text_features = model.get_text_features(**text_inputs)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)  # Normalize
        
        results = []
        
        for candidate in candidates:
            image_url = candidate.get('image_url') or candidate.get('selfie_url')
            
            if not image_url:
                # No image, assign 0 similarity
                results.append({
                    **candidate,
                    'clip_similarity': 0.0
                })
                continue
            
            try:
                # Load image from URL
                response = requests.get(image_url, timeout=5)
                response.raise_for_status()
                image = Image.open(BytesIO(response.content)).convert('RGB')
                
                # Encode image
                image_inputs = processor(images=image, return_tensors="pt")
                with torch.no_grad():
                    image_features = model.get_image_features(**image_inputs)
                    image_features = image_features / image_features.norm(dim=-1, keepdim=True)  # Normalize
                
                # Calculate cosine similarity
                similarity = float(torch.nn.functional.cosine_similarity(text_features, image_features)[0])
                
                results.append({
                    **candidate,
                    'clip_similarity': similarity
                })
                
            except Exception as img_err:
                candidate_id = candidate.get('id', 'unknown')
                print(f"Error processing image for candidate {candidate_id} ({image_url}): {img_err}")
                results.append({
                    **candidate,
                    'clip_similarity': 0.0,
                    'clip_error': str(img_err)
                })
        
        # Sort by CLIP similarity descending
        results.sort(key=lambda x: x['clip_similarity'], reverse=True)
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in clip_rank: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'openai/clip-vit-base-patch32'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
