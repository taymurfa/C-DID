# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
  && python -c "import openai; import flask; print('python deps ok')"

# Copy application code
COPY . .

EXPOSE 5001

# Apply DB schema before Flask (also done in create_app; idempotent). Inline sh avoids exec-bit issues when /app is bind-mounted.
CMD ["sh", "-c", "alembic upgrade head && exec python run.py"]
