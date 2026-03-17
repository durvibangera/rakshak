"""
Quick test script for CLIP service
"""
import requests
import json

# Test data
test_request = {
    "description": "age 25-35, male, tall height, athletic build, fair skin, short black hair",
    "candidates": [
        {
            "id": "test-1",
            "name": "Test Person 1",
            "image_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
            "match_score": 75
        },
        {
            "id": "test-2", 
            "name": "Test Person 2",
            "image_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
            "match_score": 65
        }
    ]
}

print("Testing CLIP service...")
print(f"Description: {test_request['description']}")
print(f"Number of candidates: {len(test_request['candidates'])}\n")

try:
    response = requests.post(
        "http://localhost:5001/clip-rank",
        json=test_request,
        timeout=30
    )
    
    if response.status_code == 200:
        results = response.json()
        print("✅ CLIP service is working!\n")
        print("Results:")
        for i, candidate in enumerate(results, 1):
            print(f"{i}. {candidate['name']}")
            print(f"   ID: {candidate['id']}")
            print(f"   Match Score: {candidate.get('match_score', 'N/A')}")
            print(f"   CLIP Similarity: {candidate.get('clip_similarity', 'N/A'):.4f}")
            if 'clip_error' in candidate:
                print(f"   Error: {candidate['clip_error']}")
            print()
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"❌ Failed to connect to CLIP service: {e}")
