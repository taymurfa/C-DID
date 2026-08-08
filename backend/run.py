from app import create_app
import os
import sys
from dotenv import load_dotenv

load_dotenv()

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_ENV') == 'development'
    # On Windows, the reloader can cause WinError 10038 (socket closed during restart)
    use_reloader = debug and sys.platform != 'win32'
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=use_reloader)
