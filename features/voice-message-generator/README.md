# Voice Message Generator

Text-to-speech feature using ElevenLabs API. Enter text and receive audio output.

## Setup

1. Sign up at [ElevenLabs](https://elevenlabs.io) and get your API key
2. Add to backend `.env`:
   ```
   ELEVENLABS_API_KEY=your_api_key_here
   ```

## Usage

- **Backend**: `POST /api/voice/generate` — sends text, returns MP3 audio
- **Frontend**: `/voice` — text input, generate button, audio player
