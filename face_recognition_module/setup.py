from setuptools import setup, find_packages

setup(
    name="face_recognition_module",
    version="1.0.0",
    description="Standalone, use-case-agnostic face recognition: enroll, identify, verify.",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "insightface>=0.7.3",
        "onnxruntime>=1.16.0",
        "opencv-python-headless>=4.8.0",
        "numpy>=1.24.0",
        "filelock>=3.12.0",
    ],
    extras_require={
        "gpu": ["onnxruntime-gpu>=1.16.0"],
        "api": ["fastapi>=0.100.0", "uvicorn>=0.23.0", "python-multipart>=0.0.6"],
    },
)
