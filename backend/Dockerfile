# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# ponytail: no gcc — every requirement ships a manylinux wheel (psycopg[binary],
# Pillow, cryptography). Re-add apt-get if a future dep needs to build from source.

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
  && python -c "import openai; import flask; print('python deps ok')"

# Copy application code
COPY . .

EXPOSE 5001

# Apply DB schema before Flask (also done in create_app; idempotent). Inline sh avoids exec-bit issues when /app is bind-mounted.
CMD ["sh", "-c", "alembic upgrade head && exec python run.py"]
