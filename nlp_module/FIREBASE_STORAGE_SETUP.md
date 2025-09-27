# Firebase Storage Setup Instructions

This guide will help you enable Firebase Storage for your FraudBuster project to upload and store the NLP model files.

## Prerequisites

- Firebase project already created (fraudbuster-c59d3)
- Firebase Admin SDK service account key file downloaded
- Python environment with firebase-admin package installed

## Step-by-Step Setup

### 1. Enable Firebase Storage

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Select Your Project**
   - Click on your project: `fraudbuster-c59d3`

3. **Navigate to Storage**
   - In the left sidebar, click on "Storage"
   - If you see "Get started", click it to enable Storage

4. **Configure Storage**
   - Choose your storage location (recommended: us-central1 for better performance)
   - Select security rules:
     - **For development**: Start in test mode (allows read/write for 30 days)
     - **For production**: Start in production mode (secure by default)

5. **Confirm Setup**
   - Click "Done" to complete the setup
   - Your storage bucket will be created with the name: `fraudbuster-c59d3.appspot.com`

### 2. Configure Security Rules (Optional)

If you want to make your model files publicly readable, update the storage rules:

1. In Firebase Console, go to Storage > Rules
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to model files
    match /models/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Default rules for other files
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish" to save the rules

### 3. Verify Setup

Run the upload script to verify everything is working:

```bash
cd nlp_module
python upload_models.py
```

If successful, you should see:
- "Storage bucket 'fraudbuster-c59d3.appspot.com' exists and is accessible."
- Model files uploaded successfully
- Public URLs for the uploaded files

## Troubleshooting

### Common Issues

1. **"The specified bucket does not exist" Error**
   - Make sure you've enabled Firebase Storage in the console
   - Check that the bucket name matches: `fraudbuster-c59d3.appspot.com`

2. **Permission Denied Errors**
   - Verify your service account key file is correct
   - Check that the service account has Storage Admin permissions

3. **Storage Not Enabled**
   - Go back to Firebase Console > Storage
   - Click "Get started" if you see it
   - Complete the storage setup process

### Getting Help

If you encounter issues:
1. Check the Firebase Console for any error messages
2. Verify your project ID matches: `fraudbuster-c59d3`
3. Ensure your service account key file is in the correct location
4. Check that Firebase Storage is enabled in your project

## Next Steps

Once Firebase Storage is set up and working:
1. Your NLP model files will be uploaded to the cloud
2. The Chrome extension can fetch these models from Firebase Storage
3. Models will be cached locally in the extension for better performance

## Security Considerations

- Keep your service account key file secure and never commit it to version control
- Consider using more restrictive storage rules for production
- Monitor your storage usage and costs in the Firebase Console