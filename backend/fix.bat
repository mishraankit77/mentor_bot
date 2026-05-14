@echo off
echo Step 1: Removing old packages...
pip uninstall chromadb numpy sentence-transformers -y

echo Step 2: Installing numpy first...
pip install "numpy==1.26.4"

echo Step 3: Installing fixed chromadb...
pip install "chromadb==0.6.3"

echo Step 4: Installing sentence-transformers...
pip install "sentence-transformers==3.0.1"

echo Done! Now run: uvicorn main:app --reload --port 8000
pause
