FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the InsightFace model during build
RUN python -c "from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_sc'); app.prepare(ctx_id=0)"

COPY . ./face_recognition_module

WORKDIR /app/face_recognition_module

EXPOSE 8100

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8100"]
