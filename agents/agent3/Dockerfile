# syntax=docker/dockerfile:1
# Agent 3 — Python/Flask outreach + funnel service (port 8003).

FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    GTM_PORT=8003 \
    MONGODB_DB=speaker_signal_gtm

COPY agents/agent3/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY agents /app/agents

EXPOSE 8003

CMD ["python", "-m", "agents.agent3.api"]
