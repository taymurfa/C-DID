from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import os
import certifi

client = None
db = None

def init_db():
    global client, db
    try:
        connection_string = os.getenv('MONGODB_URI')
        if not connection_string:
            raise ValueError("MONGODB_URI environment variable is not set")
        # certifi fixes SSL verify on macOS; short timeout so startup doesn't hang
        client = MongoClient(
            connection_string,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where(),
        )
        client.admin.command('ping')
        db = client.get_database(os.getenv('MONGODB_DB_NAME', 'hackathon_db'))
        print("Successfully connected to MongoDB Atlas", flush=True)
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}", flush=True)
        raise
    except Exception as e:
        print(f"Error initializing MongoDB: {e}", flush=True)
        raise

def get_db():
    global db
    if db is None:
        init_db()
    return db
