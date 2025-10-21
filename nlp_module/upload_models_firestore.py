#!/usr/bin/env python3
"""
Upload NLP Model to Firestore Database

This script converts the trained NLP model files (pickle format) to base64
and stores them in Firestore along with metadata.
"""

import os
import sys
import json
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
    'nlp_model': 'enhanced_nlp_model.json',
    'vectorizer': 'enhanced_vectorizer.json',
    'metadata': 'enhanced_model_metadata.json'
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

def read_json_file(file_path):
    """Read JSON file and return parsed data"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            json_data = json.load(file)
            return json_data
    except Exception as e:
        print(f"❌ Error reading JSON file {file_path}: {e}")
        return None

def get_model_metadata(metadata_path, model_path, vectorizer_path):
    """Extract metadata from the JSON metadata file and model files"""
    try:
        # Read metadata from JSON file
        metadata_json = read_json_file(metadata_path)
        if not metadata_json:
            raise Exception("Could not read metadata JSON file")
        
        # Add upload timestamp
        metadata = metadata_json.copy()
        metadata['upload_timestamp'] = datetime.now().isoformat()
        
        # Read model JSON to get additional info
        model_json = read_json_file(model_path)
        if model_json:
            metadata['model_classes'] = model_json.get('classes', [0, 1])
        
        # Read vectorizer JSON to get vocabulary info
        vectorizer_json = read_json_file(vectorizer_path)
        if vectorizer_json:
            vocabulary = vectorizer_json.get('vocabulary', {})
            metadata['vocabulary_size'] = len(vocabulary)
            # Store top features for rule-based detection (first 100 by frequency)
            if vocabulary:
                sorted_features = sorted(vocabulary.items(), key=lambda x: x[1])[:100]
                metadata['top_features'] = [feature[0] for feature in sorted_features]
        
        return metadata
                
    except Exception as e:
        print(f"⚠️  Warning: Could not extract metadata: {e}")
        # Return basic metadata as fallback
        return {
            'upload_timestamp': datetime.now().isoformat(),
            'model_type': 'MultinomialNB',
            'vectorizer_type': 'TfidfVectorizer',
            'version': '2.0',
            'error': str(e)
        }

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

def fetch_existing_fraud_urls(db):
    """Fetch existing fraud URLs from Firebase collections"""
    print("🔍 Fetching existing fraud URLs from Firebase...")
    existing_urls = set()
    
    try:
        # Fetch URLs from fraud_data collection (main storage)
        fraud_data_doc = db.collection(FRAUD_DATA_COLLECTION).document('fraud_urls').get()
        if fraud_data_doc.exists:
            data = fraud_data_doc.to_dict()
            if 'urls' in data and isinstance(data['urls'], list):
                existing_urls.update(data['urls'])
                print(f"📋 Found {len(data['urls'])} URLs in fraud_data collection")
        
        # Fetch URLs from fraud_urls collection (user reports)
        fraud_urls_collection = db.collection('fraud_urls').stream()
        user_reported_count = 0
        for doc in fraud_urls_collection:
            doc_data = doc.to_dict()
            if 'url' in doc_data:
                existing_urls.add(doc_data['url'])
                user_reported_count += 1
        
        if user_reported_count > 0:
            print(f"📋 Found {user_reported_count} user-reported URLs in fraud_urls collection")
        
        print(f"📊 Total existing unique URLs: {len(existing_urls)}")
        return existing_urls
        
    except Exception as e:
        print(f"⚠️  Warning: Could not fetch existing URLs: {e}")
        print("📝 Proceeding with empty existing URL set")
        return set()

def upload_fraud_urls_to_firestore(db, new_urls):
    """Merge and upload fraud URLs to Firestore, preserving existing user-reported URLs"""
    print("\n=== Merging and Uploading Fraud URLs to Firestore ===")
    
    try:
        # Fetch existing URLs from Firebase
        existing_urls = fetch_existing_fraud_urls(db)
        
        # Convert new URLs to set for deduplication
        new_urls_set = set(new_urls)
        
        # Calculate merge statistics
        truly_new_urls = new_urls_set - existing_urls
        preserved_urls = existing_urls
        merged_urls = existing_urls.union(new_urls_set)
        
        # Display merge statistics
        print(f"\n📊 URL Merge Statistics:")
        print(f"   🔄 Existing URLs (preserved): {len(preserved_urls)}")
        print(f"   ➕ New URLs from file: {len(new_urls_set)}")
        print(f"   🆕 Truly new URLs (to be added): {len(truly_new_urls)}")
        print(f"   🔄 Duplicate URLs (skipped): {len(new_urls_set & existing_urls)}")
        print(f"   📊 Total merged URLs: {len(merged_urls)}")
        
        if len(truly_new_urls) > 0:
            print(f"\n🆕 New URLs being added:")
            for url in sorted(list(truly_new_urls)[:10]):  # Show first 10
                print(f"   + {url}")
            if len(truly_new_urls) > 10:
                print(f"   ... and {len(truly_new_urls) - 10} more")
        
        # Prepare merged fraud URLs document data
        fraud_data = {
            'urls': sorted(list(merged_urls)),  # Sort for consistency
            'metadata': {
                'upload_timestamp': datetime.now().isoformat(),
                'url_count': len(merged_urls),
                'existing_urls_preserved': len(preserved_urls),
                'new_urls_added': len(truly_new_urls),
                'duplicate_urls_skipped': len(new_urls_set & existing_urls),
                'version': '2.0',
                'description': 'Known fraudulent job posting domains (merged with user reports)',
                'sources': ['fraud-urls.txt', 'user_reports', 'fraud_urls_collection']
            }
        }
        
        # Upload merged data to Firestore
        print(f"\n🚀 Uploading {len(merged_urls)} merged fraud URLs to Firestore...")
        doc_ref = db.collection(FRAUD_DATA_COLLECTION).document('fraud_urls')
        doc_ref.set(fraud_data)
        
        print("✅ Successfully merged and uploaded fraud URLs to Firestore!")
        print(f"📍 Document path: {FRAUD_DATA_COLLECTION}/fraud_urls")
        print(f"📊 Final URL count: {len(merged_urls)}")
        print(f"🔒 User-reported URLs preserved: {len(preserved_urls)}")
        print(f"➕ New URLs added: {len(truly_new_urls)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error merging and uploading fraud URLs to Firestore: {e}")
        return False

def upload_to_firestore(db):
    """Upload NLP model and fraud URLs to Firestore in separate documents"""
    print("\n=== Uploading NLP Model to Firestore ===")
    
    # Check if model files exist
    model_path = MODEL_FILES['nlp_model']
    vectorizer_path = MODEL_FILES['vectorizer']
    metadata_path = MODEL_FILES['metadata']
    
    if not os.path.exists(model_path):
        print(f"❌ Model file not found: {model_path}")
        return False
        
    if not os.path.exists(vectorizer_path):
        print(f"❌ Vectorizer file not found: {vectorizer_path}")
        return False
        
    if not os.path.exists(metadata_path):
        print(f"❌ Metadata file not found: {metadata_path}")
        return False
    
    try:
        # Read JSON files directly
        print(f"📦 Reading {model_path}...")
        model_data = read_json_file(model_path)
        if not model_data:
            return False
            
        print(f"📦 Reading {vectorizer_path}...")
        vectorizer_data = read_json_file(vectorizer_path)
        if not vectorizer_data:
            return False
        
        # Get model metadata
        print("📊 Reading model metadata...")
        metadata = get_model_metadata(metadata_path, model_path, vectorizer_path)
        
        # Calculate file sizes
        model_size = os.path.getsize(model_path)
        vectorizer_size = os.path.getsize(vectorizer_path)
        metadata_size = os.path.getsize(metadata_path)
        
        print(f"🚀 Uploading to Firestore collection '{FIRESTORE_COLLECTION}'...")
        
        # Upload metadata first
        metadata_doc = {
            'metadata': metadata,
            'format': 'json',
            'version': metadata.get('version', '3.0'),
            'upload_timestamp': datetime.now().isoformat(),
            'file_sizes': {
                'model': model_size,
                'vectorizer': vectorizer_size,
                'metadata': metadata_size,
                'total': model_size + vectorizer_size + metadata_size
            }
        }
        
        db.collection(FIRESTORE_COLLECTION).document('metadata').set(metadata_doc)
        print("✅ Metadata uploaded successfully")
        
        # Upload vectorizer data (smaller, should work)
        vectorizer_doc = {
            'vectorizer_data': vectorizer_data,
            'type': 'vectorizer',
            'upload_timestamp': datetime.now().isoformat()
        }
        
        db.collection(FIRESTORE_COLLECTION).document('vectorizer').set(vectorizer_doc)
        print("✅ Vectorizer uploaded successfully")
        
        # Split model data into chunks due to Firestore size limits
        # Extract large arrays separately
        feature_log_prob = model_data.pop('feature_log_prob', [])
        feature_count = model_data.pop('feature_count', [])
        
        # Upload main model data (without large arrays)
        model_doc = {
            'model_data': model_data,
            'type': 'model_base',
            'upload_timestamp': datetime.now().isoformat()
        }
        
        db.collection(FIRESTORE_COLLECTION).document('model_base').set(model_doc)
        print("✅ Model base data uploaded successfully")
        
        # Convert nested arrays to JSON strings to avoid Firestore nested array limitation
        # Upload feature_log_prob as JSON string
        feature_log_prob_doc = {
            'feature_log_prob_json': json.dumps(feature_log_prob),
            'type': 'feature_log_prob',
            'array_shape': [len(feature_log_prob), len(feature_log_prob[0]) if feature_log_prob else 0],
            'upload_timestamp': datetime.now().isoformat()
        }
        db.collection(FIRESTORE_COLLECTION).document('feature_log_prob').set(feature_log_prob_doc)
        print("✅ Feature log prob uploaded as JSON string")
        
        # Upload feature_count as JSON string
        feature_count_doc = {
            'feature_count_json': json.dumps(feature_count),
            'type': 'feature_count',
            'array_shape': [len(feature_count), len(feature_count[0]) if feature_count else 0],
            'upload_timestamp': datetime.now().isoformat()
        }
        db.collection(FIRESTORE_COLLECTION).document('feature_count').set(feature_count_doc)
        print("✅ Feature count uploaded as JSON string")
        
        print("✅ Successfully uploaded model to Firestore!")
        print(f"📍 Collection: {FIRESTORE_COLLECTION}")
        print(f"📊 Model accuracy: {metadata.get('accuracy', 0)*100:.1f}%")
        print(f"📚 Vocabulary size: {len(vectorizer_data.get('vocabulary', {}))} terms")
        print(f"🎯 Model type: {model_data.get('model_type', 'N/A')}")
        print(f"📦 Total size: {(model_size + vectorizer_size + metadata_size) / 1024:.1f} KB")
        print("🚀 Chrome extension can now directly read JSON model data from Firestore!")
        print("💡 Model data split into multiple documents for Firestore compatibility")
        
        return True
        
    except Exception as e:
        print(f"❌ Error uploading to Firestore: {e}")
        return False

def main():
    """Main function"""
    print("=== NLP Model and Fraud URLs Upload to Firestore ===")
    print("🔄 Models will be REPLACED, URLs will be MERGED with existing data")
    
    # Initialize Firebase
    db = initialize_firebase()
    
    # Upload models (complete replacement)
    print("\n=== MODEL UPLOAD (REPLACEMENT) ===")
    print("🔄 Replacing all existing model data with new trained models...")
    model_success = upload_to_firestore(db)
    
    # Read and merge fraud URLs (preserving existing)
    print("\n=== FRAUD URL UPLOAD (MERGE) ===")
    print("🔄 Merging new URLs with existing user-reported URLs...")
    fraud_urls = read_fraud_urls(FRAUD_URLS_FILE)
    fraud_success = False
    
    if fraud_urls:
        fraud_success = upload_fraud_urls_to_firestore(db, fraud_urls)
    else:
        print("⚠️  Skipping fraud URLs merge due to read error")
    
    # Final status with detailed logging
    print("\n" + "="*60)
    if model_success and fraud_success:
        print("🎉 ALL OPERATIONS COMPLETED SUCCESSFULLY!")
        print("\n📋 Operation Summary:")
        print("✅ NLP Model Data: REPLACED with new trained models")
        print("✅ Fraud URLs Database: MERGED (preserved user reports + added new URLs)")
        print("\n📋 Next steps:")
        print("1. Chrome extension can now directly read updated JSON model data")
        print("2. User-reported fraud URLs have been preserved")
        print("3. New fraud URLs from training data have been added")
        print("4. Test the extension with updated models and merged URL database")
        print("5. Verify fraud detection accuracy with new model")
    elif model_success:
        print("⚠️  PARTIAL SUCCESS:")
        print("✅ Model Upload: SUCCESS (models replaced)")
        print("❌ URL Merge: FAILED")
        print("📝 Please check the fraud URLs file and try again")
    elif fraud_success:
        print("⚠️  PARTIAL SUCCESS:")
        print("❌ Model Upload: FAILED")
        print("✅ URL Merge: SUCCESS (URLs merged)")
        print("📝 Please check the model files and try again")
    else:
        print("❌ ALL OPERATIONS FAILED")
        print("📝 Please check the errors above and try again")
        sys.exit(1)

if __name__ == '__main__':
    main()