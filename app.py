# app.py
from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
from datetime import datetime
import os
from bson import json_util
import json
import math
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
app = Flask(__name__)

def get_db():
    """
    Establish and return a MongoDB database connection
    """
    try:
        # Parse connection string
        connection_string = os.getenv("MONGODB_CONNECTION_STRING")
        
        if not connection_string:
            raise ValueError("MongoDB connection string is not set in .env file")
        
        # Create a MongoClient
        client = MongoClient(connection_string)
        
        # Extract database name from connection string
        url_parts = connection_string.split('/')
        database_name = url_parts[-1].split('?')[0] if len(url_parts) > 3 else 'test'
        
        # Get the database
        db = client[database_name]
        
        print(f"Successfully connected to database: {database_name}")
        return db
    
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

# Initialize database
db = get_db()

# Check if database connection was successful
if db is None:
    raise Exception("Failed to connect to MongoDB. Please check your connection string.")

# Get locations collection
locations_collection = db.locations

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/latest-location', methods=['GET'])
def get_latest_location():
    db = get_db()
    location = db.locations.find_one(sort=[("timestamp", -1)])
    print(location)
    return json.loads(json_util.dumps(location))

@app.route('/api/targets', methods=['GET'])
def get_targets():
    db = get_db()
    # Get all target locations, sorted by most recent first
    targets = list(db.targets.find().sort("timestamp", -1))
    return json.loads(json_util.dumps(targets))

@app.route('/api/save-target', methods=['POST'])
def save_target():
    db = get_db()
    data = request.json
    
    # Check if this location already exists to avoid duplicates
    existing = db.targets.find_one({
        "latitude": data['latitude'],
        "longitude": data['longitude']
    })
    
    if existing:
        # Update timestamp to make it the most recent
        db.targets.update_one(
            {"_id": existing["_id"]},
            {"$set": {"timestamp": datetime.utcnow()}}
        )
        return json.loads(json_util.dumps(existing))
    
    # Create new target
    target_data = {
        "latitude": data['latitude'],
        "longitude": data['longitude'],
        "timestamp": datetime.utcnow(),
        "device_id": data.get('device_id', 'user_search'),
        "location_details": data['location_details']
    }
    
    result = db.targets.insert_one(target_data)
    target_data['_id'] = str(result.inserted_id)
    
    return jsonify(target_data)

@app.route('/api/distance', methods=['POST'])
def calculate_distance():
    data = request.json
    lat1 = data['latest']['latitude']
    lon1 = data['latest']['longitude']
    lat2 = data['target']['latitude']
    lon2 = data['target']['longitude']
    
    # Haversine formula to calculate distance between two points
    R = 6371  # Earth radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2) * math.sin(dlat/2) + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon/2) * math.sin(dlon/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return jsonify({
        'distance': distance,
        'unit': 'km'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5200)
