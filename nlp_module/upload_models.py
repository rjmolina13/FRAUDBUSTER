#!/usr/bin/env python3
"""
Upload NLP Model Files to Firebase Storage

This script uploads the trained NLP model files (nlp_model.pkl and vectorizer.pkl)
to Firebase Storage for use by the Chrome extension.
"""

import os
import sys
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, storage
except ImportError:
    print("Error: firebase-admin package not found.")
    print("Please install it with: pip install firebase-admin")
    sys.exit(1)

# Firebase configuration
SERVICE_ACCOUNT_PATH = '/Users/rjmolina13/Documents/Code_Stuff/FRAUDBUSTER-dev/fraudbuster-c59d3-firebase-adminsdk-fbsvc-626440b38d.json'
STORAGE_BUCKET = 'fraudbuster-c59d3.appspot.com'

# Model files to upload
MODEL_FILES = {
    'nlp_model.pkl': 'models/nlp_model.pkl',
    'vectorizer.pkl': 'models/vectorizer.pkl'
}

def check_service_account_file():
    """Check if the service account file exists."""
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"Error: Service account file not found at {SERVICE_ACCOUNT_PATH}")
        print("Please ensure the Firebase Admin SDK service account key file is in the correct location.")
        return False
    return True

def initialize_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        # Check if Firebase is already initialized
        firebase_admin.get_app()
        print("Firebase already initialized.")
    except ValueError:
        # Initialize Firebase
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {
            'storageBucket': STORAGE_BUCKET
        })
        print("Firebase initialized successfully.")

def check_and_create_bucket():
    """Check if the storage bucket exists and create it if it doesn't."""
    try:
        bucket = storage.bucket()
        # Try to get bucket metadata to check if it exists
        bucket.reload()
        print(f"Storage bucket '{STORAGE_BUCKET}' exists and is accessible.")
        return True
    except Exception as e:
        error_msg = str(e).lower()
        if "does not exist" in error_msg or "not found" in error_msg:
            print(f"Storage bucket '{STORAGE_BUCKET}' does not exist.")
            print("\n=== Firebase Storage Setup Required ===")
            print("Please enable Firebase Storage for your project:")
            print("1. Go to https://console.firebase.google.com/")
            print(f"2. Select your project: fraudbuster-c59d3")
            print("3. Click on 'Storage' in the left sidebar")
            print("4. Click 'Get started' to enable Firebase Storage")
            print("5. Choose your storage location and security rules")
            print("6. Once enabled, run this script again")
            print("\nNote: The default bucket name should be: fraudbuster-c59d3.appspot.com")
            return False
        else:
            print(f"Error accessing storage bucket: {str(e)}")
            return False

def upload_file(local_path, remote_path):
    """Upload a file to Firebase Storage."""
    try:
        bucket = storage.bucket()
        blob = bucket.blob(remote_path)
        
        print(f"Uploading {local_path} to {remote_path}...")
        blob.upload_from_filename(local_path)
        
        # Make the file publicly readable (optional)
        blob.make_public()
        
        print(f"✓ Successfully uploaded {local_path}")
        print(f"  Public URL: {blob.public_url}")
        return True
        
    except Exception as e:
        print(f"✗ Error uploading {local_path}: {str(e)}")
        return False

def main():
    """Main function to upload model files."""
    print("=== NLP Model Upload to Firebase Storage ===")
    
    # Check if service account file exists
    if not check_service_account_file():
        return False
    
    # Initialize Firebase
    try:
        initialize_firebase()
    except Exception as e:
        print(f"Error initializing Firebase: {str(e)}")
        return False
    
    # Check if storage bucket exists
    if not check_and_create_bucket():
        return False
    
    # Check if model files exist
    current_dir = Path(__file__).parent
    missing_files = []
    
    for local_file in MODEL_FILES.keys():
        file_path = current_dir / local_file
        if not file_path.exists():
            missing_files.append(local_file)
    
    if missing_files:
        print(f"Error: Missing model files: {', '.join(missing_files)}")
        print("Please run train_model.py first to generate the model files.")
        return False
    
    # Upload files
    success_count = 0
    total_files = len(MODEL_FILES)
    
    for local_file, remote_path in MODEL_FILES.items():
        file_path = current_dir / local_file
        if upload_file(str(file_path), remote_path):
            success_count += 1
    
    # Summary
    print(f"\n=== Upload Summary ===")
    print(f"Successfully uploaded: {success_count}/{total_files} files")
    
    if success_count == total_files:
        print("✓ All model files uploaded successfully!")
        print("\nYour Chrome extension can now fetch these models from Firebase Storage.")
        return True
    else:
        print("✗ Some files failed to upload. Please check the errors above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)