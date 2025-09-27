#!/usr/bin/env python3
"""
Upload NLP Model to Firestore Database

This script converts the trained NLP model files (pickle format) to base64
and stores them in Firestore along with metadata.
"""

import os
import sys
import base64
import pickle
from datetime import datetime

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Error: firebase-admin not installed.")
    print("Please install it with: pip install firebase-admin")
    sys.exit(1)

# Configuration
SERVICE_ACCOUNT_PATH = '/Users/rjmolina13/Documents/Code_Stuff/FRAUDBUSTER-dev/fraudbuster-c59d3-firebase-adminsdk-fbsvc-626440b38d.json'
MODEL_FILES = {
    'nlp_model': 'nlp_model.pkl',
    'vectorizer': 'vectorizer.pkl'
}
FRAUD_URLS_FILE = '../fraud-urls.txt'
FIRESTORE_COLLECTION = 'nlp_models'
FRAUD_DATA_COLLECTION = 'fraud_data'

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        if not os.path.exists(SERVICE_ACCOUNT_PATH):
            raise FileNotFoundError(f"Service account file not found: {SERVICE_ACCOUNT_PATH}")
        
        # Initialize Firebase Admin SDK
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        
        # Get Firestore client
        db = firestore.client()
        print("✅ Firebase initialized successfully.")
        return db
        
    except Exception as e:
        print(f"❌ Error initializing Firebase: {e}")
        sys.exit(1)

def file_to_base64(file_path):
    """Convert file to base64 string"""
    try:
        with open(file_path, 'rb') as file:
            file_data = file.read()
            base64_data = base64.b64encode(file_data).decode('utf-8')
            return base64_data
    except Exception as e:
        print(f"❌ Error converting {file_path} to base64: {e}")
        return None

def get_model_metadata(model_path, vectorizer_path):
    """Extract metadata from the trained model"""
    metadata = {
        'upload_timestamp': datetime.now().isoformat(),
        'model_type': 'LogisticRegression',
        'vectorizer_type': 'TfidfVectorizer',
        'features': ['title', 'location', 'description', 'requirements', 'benefits'],
        'target': 'fraudulent',
        'accuracy': 0.974,  # From training results
        'version': '1.0'
    }
    
    try:
        # Load model to get additional info
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
            metadata['model_classes'] = model.classes_.tolist() if hasattr(model, 'classes_') else [0, 1]
        
        # Load vectorizer to get vocabulary size
        with open(vectorizer_path, 'rb') as f:
            vectorizer = pickle.load(f)
            if hasattr(vectorizer, 'vocabulary_'):
                metadata['vocabulary_size'] = len(vectorizer.vocabulary_)
                # Store top features for rule-based detection
                feature_names = vectorizer.get_feature_names_out()
                metadata['top_features'] = feature_names[:100].tolist()  # Top 100 features
                
    except Exception as e:
        print(f"⚠️  Warning: Could not extract detailed metadata: {e}")
    
    return metadata

def read_fraud_urls(file_path):
    """Read and parse fraud URLs from text file"""
    try:
        if not os.path.exists(file_path):
            print(f"❌ Fraud URLs file not found: {file_path}")
            return None
            
        with open(file_path, 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip()]
            
        print(f"📋 Found {len(urls)} fraud URLs in {file_path}")
        return urls
        
    except Exception as e:
        print(f"❌ Error reading fraud URLs file: {e}")
        return None

def upload_fraud_urls_to_firestore(db, urls):
    """Upload fraud URLs to Firestore"""
    print("\n=== Uploading Fraud URLs to Firestore ===")
    
    try:
        # Prepare fraud URLs document data
        fraud_data = {
            'urls': urls,
            'metadata': {
                'upload_timestamp': datetime.now().isoformat(),
                'url_count': len(urls),
                'version': '1.0',
                'description': 'Known fraudulent job posting domains',
                'source': 'fraud-urls.txt'
            }
        }
        
        # Upload to Firestore
        print(f"🚀 Uploading {len(urls)} fraud URLs to Firestore collection '{FRAUD_DATA_COLLECTION}'...")
        doc_ref = db.collection(FRAUD_DATA_COLLECTION).document('fraud_urls')
        doc_ref.set(fraud_data)
        
        print("✅ Successfully uploaded fraud URLs to Firestore!")
        print(f"📍 Document path: {FRAUD_DATA_COLLECTION}/fraud_urls")
        print(f"📊 Total URLs: {len(urls)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error uploading fraud URLs to Firestore: {e}")
        return False

def upload_to_firestore(db):
    """Upload model files and metadata to Firestore"""
    print("\n=== Uploading NLP Model to Firestore ===")
    
    # Check if model files exist
    model_path = MODEL_FILES['nlp_model']
    vectorizer_path = MODEL_FILES['vectorizer']
    
    if not os.path.exists(model_path):
        print(f"❌ Model file not found: {model_path}")
        return False
        
    if not os.path.exists(vectorizer_path):
        print(f"❌ Vectorizer file not found: {vectorizer_path}")
        return False
    
    try:
        # Convert files to base64
        print(f"📦 Converting {model_path} to base64...")
        model_base64 = file_to_base64(model_path)
        if not model_base64:
            return False
            
        print(f"📦 Converting {vectorizer_path} to base64...")
        vectorizer_base64 = file_to_base64(vectorizer_path)
        if not vectorizer_base64:
            return False
        
        # Get model metadata
        print("📊 Extracting model metadata...")
        metadata = get_model_metadata(model_path, vectorizer_path)
        
        # Prepare document data
        doc_data = {
            'model_data': model_base64,
            'vectorizer_data': vectorizer_base64,
            'metadata': metadata,
            'file_sizes': {
                'model_size_bytes': len(model_base64.encode('utf-8')),
                'vectorizer_size_bytes': len(vectorizer_base64.encode('utf-8'))
            }
        }
        
        # Upload to Firestore
        print(f"🚀 Uploading to Firestore collection '{FIRESTORE_COLLECTION}'...")
        doc_ref = db.collection(FIRESTORE_COLLECTION).document('current_model')
        doc_ref.set(doc_data)
        
        print("✅ Successfully uploaded model to Firestore!")
        print(f"📍 Document path: {FIRESTORE_COLLECTION}/current_model")
        print(f"📊 Model accuracy: {metadata['accuracy']*100:.1f}%")
        print(f"📦 Total data size: {(doc_data['file_sizes']['model_size_bytes'] + doc_data['file_sizes']['vectorizer_size_bytes']) / 1024:.1f} KB")
        
        return True
        
    except Exception as e:
        print(f"❌ Error uploading to Firestore: {e}")
        return False

def main():
    """Main function"""
    print("=== NLP Model and Fraud URLs Upload to Firestore ===")
    
    # Initialize Firebase
    db = initialize_firebase()
    
    # Upload models
    model_success = upload_to_firestore(db)
    
    # Read and upload fraud URLs
    fraud_urls = read_fraud_urls(FRAUD_URLS_FILE)
    fraud_success = False
    
    if fraud_urls:
        fraud_success = upload_fraud_urls_to_firestore(db, fraud_urls)
    else:
        print("⚠️  Skipping fraud URLs upload due to read error")
    
    # Final status
    if model_success and fraud_success:
        print("\n🎉 All uploads completed successfully!")
        print("\n📋 Uploaded data:")
        print("✅ NLP Model and Vectorizer")
        print("✅ Fraud URLs Database")
        print("\n📋 Next steps:")
        print("1. Update your Chrome extension to fetch both model and fraud URL data from Firestore")
        print("2. Implement JavaScript-based fraud detection using the model metadata")
        print("3. Use fraud URLs for domain-based detection")
        print("4. Test the integration with real job posting data")
    elif model_success:
        print("\n⚠️  Partial success: Model uploaded, but fraud URLs failed")
        print("Please check the fraud URLs file and try again")
    elif fraud_success:
        print("\n⚠️  Partial success: Fraud URLs uploaded, but model failed")
        print("Please check the model files and try again")
    else:
        print("\n❌ All uploads failed. Please check the errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()