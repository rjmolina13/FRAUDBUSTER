import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
import re
import pickle
import os
from bs4 import BeautifulSoup

# Load the dataset
df = pd.read_csv('../docs/datasets-code/fake_job_postings.csv')

# Basic English stop words (without NLTK dependency)
stop_words = set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
    'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
    'while', 'of', 'at', 'by', 'for', 'with', 'through', 'during', 'before', 'after',
    'above', 'below', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
    'further', 'then', 'once'
])

def clean_text(text):
    if pd.isnull(text):
        return ""
    text = re.sub(r'[\r\n]+', ' ', text)  # remove newlines
    text = re.sub(r'[^\w\s]', '', text)  # remove punctuation
    text = text.lower()
    text = ' '.join([word for word in text.split() if word not in stop_words and len(word) > 2])
    return text

def extract_fraud_patterns_from_sites():
    """Extract fraud patterns from saved website documents"""
    sites_dir = '../docs/sites/'
    fraud_patterns = []
    
    if os.path.exists(sites_dir):
        for filename in os.listdir(sites_dir):
            if filename.endswith('.mhtml'):
                try:
                    with open(os.path.join(sites_dir, filename), 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        # Extract text content from MHTML
                        soup = BeautifulSoup(content, 'html.parser')
                        text = soup.get_text()
                        fraud_patterns.append(clean_text(text))
                except Exception as e:
                    print(f"Error reading {filename}: {e}")
    
    return fraud_patterns

# Combine text columns
df['text'] = df['title'].fillna('') + ' ' + df['location'].fillna('') + ' ' + df['department'].fillna('') + ' ' + df['company_profile'].fillna('') + ' ' + df['description'].fillna('') + ' ' + df['requirements'].fillna('') + ' ' + df['benefits'].fillna('')

df['text'] = df['text'].apply(clean_text)

# Extract fraud patterns from website documents
print("Extracting fraud patterns from website documents...")
fraud_patterns = extract_fraud_patterns_from_sites()
print(f"Extracted {len(fraud_patterns)} fraud pattern documents")

# Add fraud patterns as additional fraudulent examples
if fraud_patterns:
    fraud_df = pd.DataFrame({
        'text': fraud_patterns,
        'fraudulent': [1] * len(fraud_patterns)  # Mark as fraudulent
    })
    df = pd.concat([df[['text', 'fraudulent']], fraud_df], ignore_index=True)
    print(f"Total dataset size after adding fraud patterns: {len(df)}")

# Split data
X_train, X_test, y_train, y_test = train_test_split(df['text'], df['fraudulent'], test_size=0.2, random_state=42)

# Vectorize text
vectorizer = TfidfVectorizer(max_features=5000)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

# Train model
model = LogisticRegression()
model.fit(X_train_vec, y_train)

# Evaluate model
y_pred = model.predict(X_test_vec)
print(f"Accuracy: {accuracy_score(y_test, y_pred)}")
print(classification_report(y_test, y_pred))

# Save the model and vectorizer
with open('nlp_model.pkl', 'wb') as f:
    pickle.dump(model, f)

with open('vectorizer.pkl', 'wb') as f:
    pickle.dump(vectorizer, f)

print("Model and vectorizer saved.")