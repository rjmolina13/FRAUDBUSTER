import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, classification_report, precision_score, 
    recall_score, f1_score, roc_auc_score, confusion_matrix
)
import re
import pickle
import os
import numpy as np
from datetime import datetime
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

def generate_markdown_report(accuracy, precision, recall, f1, roc_auc, cm, 
                           top_fraud_features, top_legit_features, 
                           total_samples, train_samples, test_samples):
    """Generate a comprehensive markdown evaluation report"""
    
    report_content = f"""# Fraud Detection Model Evaluation Report

**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## Executive Summary

This report presents a comprehensive evaluation of the fraud detection model trained on job posting data. The model demonstrates **{accuracy*100:.1f}% accuracy** with a **{roc_auc*100:.1f}% ROC-AUC score**, indicating {'excellent' if roc_auc > 0.9 else 'good' if roc_auc > 0.8 else 'moderate'} discriminative performance.

## Dataset Overview

| Metric | Value |
|--------|-------|
| **Total Samples** | {total_samples:,} |
| **Training Set** | {train_samples:,} ({train_samples/total_samples*100:.1f}%) |
| **Test Set** | {test_samples:,} ({test_samples/total_samples*100:.1f}%) |
| **Features** | 5,000 (TF-IDF) |

## Performance Metrics

### Core Metrics

| Metric | Score | Percentage | Interpretation |
|--------|-------|------------|----------------|
| **Accuracy** | {accuracy:.4f} | {accuracy*100:.2f}% | Overall correctness of predictions |
| **Precision** | {precision:.4f} | {precision*100:.2f}% | Accuracy of fraud predictions (reduces false positives) |
| **Recall** | {recall:.4f} | {recall*100:.2f}% | Coverage of actual fraud cases (reduces false negatives) |
| **F1-Score** | {f1:.4f} | {f1*100:.2f}% | Balanced measure of precision and recall |
| **ROC-AUC** | {roc_auc:.4f} | {roc_auc*100:.2f}% | Discriminative ability across all thresholds |

### Confusion Matrix

```
                    Predicted
                 Legit    Fraud
Actual  Legit   {cm[0,0]:>6}   {cm[0,1]:>6}   (True Negatives | False Positives)
        Fraud   {cm[1,0]:>6}   {cm[1,1]:>6}   (False Negatives | True Positives)
```

**Key Insights:**
- **True Positives:** {cm[1,1]} fraud cases correctly identified
- **False Positives:** {cm[0,1]} legitimate jobs incorrectly flagged as fraud
- **False Negatives:** {cm[1,0]} fraud cases missed by the model
- **True Negatives:** {cm[0,0]} legitimate jobs correctly identified

## Feature Analysis

### Top 10 Fraud Indicators

These features strongly indicate fraudulent job postings:

| Rank | Feature | Weight | Impact |
|------|---------|--------|--------|
"""
    
    for i, (feature, weight) in enumerate(top_fraud_features[:10], 1):
        impact = "High" if weight > 2 else "Medium" if weight > 1 else "Low"
        report_content += f"| {i} | `{feature}` | {weight:.4f} | {impact} |\n"
    
    report_content += f"""

### Top 10 Legitimacy Indicators

These features strongly indicate legitimate job postings:

| Rank | Feature | Weight | Impact |
|------|---------|--------|--------|
"""
    
    for i, (feature, weight) in enumerate(top_legit_features[:10], 1):
        impact = "High" if abs(weight) > 2 else "Medium" if abs(weight) > 1 else "Low"
        report_content += f"| {i} | `{feature}` | {weight:.4f} | {impact} |\n"
    
    # Performance assessment
    performance_level = "Excellent" if f1 > 0.9 else "Good" if f1 > 0.8 else "Moderate" if f1 > 0.7 else "Needs Improvement"
    
    report_content += f"""

## Model Performance Assessment

### Overall Rating: **{performance_level}**

**Strengths:**
- {'High precision reduces false fraud alerts' if precision > 0.8 else 'Moderate precision may cause some false alerts'}
- {'High recall captures most fraud cases' if recall > 0.8 else 'Moderate recall may miss some fraud cases'}
- {'Excellent ROC-AUC indicates strong discriminative power' if roc_auc > 0.9 else 'Good ROC-AUC shows reliable classification ability' if roc_auc > 0.8 else 'Moderate ROC-AUC suggests room for improvement'}

**Areas for Improvement:**
{f'- Consider improving recall to catch more fraud cases (current: {recall*100:.1f}%)' if recall < 0.8 else ''}
{f'- Consider improving precision to reduce false positives (current: {precision*100:.1f}%)' if precision < 0.8 else ''}
{f'- Overall accuracy could be enhanced (current: {accuracy*100:.1f}%)' if accuracy < 0.85 else ''}

## Recommendations

### Immediate Actions
1. **Deploy Model**: {'Ready for production deployment' if f1 > 0.8 else 'Consider additional training before deployment'}
2. **Monitoring**: Set up continuous monitoring for model drift
3. **Threshold Tuning**: {'Current performance is well-balanced' if abs(precision - recall) < 0.1 else 'Consider adjusting classification threshold to balance precision/recall'}

### Future Enhancements
1. **Feature Engineering**: 
   - Add domain-specific features (company reputation, salary ranges)
   - Include temporal features (posting date, urgency indicators)
   - Implement n-gram analysis for better context understanding

2. **Model Improvements**:
   - Experiment with ensemble methods (Random Forest, XGBoost)
   - Try deep learning approaches (BERT, RoBERTa)
   - Implement active learning for continuous improvement

3. **Data Quality**:
   - Expand training dataset with more diverse fraud examples
   - Implement data augmentation techniques
   - Regular retraining with new fraud patterns

## Technical Details

- **Algorithm**: Logistic Regression with TF-IDF vectorization
- **Max Features**: 5,000 most important terms
- **Cross-validation**: 80/20 train-test split
- **Preprocessing**: Text cleaning, stop word removal, lowercasing

---

*This report was automatically generated by the fraud detection model training pipeline.*
"""
    
    # Save the report
    with open('model_evaluation_report.md', 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    return report_content

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

# Evaluate model with comprehensive metrics
y_pred = model.predict(X_test_vec)
y_pred_proba = model.predict_proba(X_test_vec)[:, 1]  # Probabilities for ROC-AUC

# Calculate all metrics
accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
roc_auc = roc_auc_score(y_test, y_pred_proba)
cm = confusion_matrix(y_test, y_pred)

# Get feature importance (top fraud indicators)
feature_names = vectorizer.get_feature_names_out()
feature_importance = model.coef_[0]
top_fraud_features = sorted(zip(feature_names, feature_importance), key=lambda x: x[1], reverse=True)[:20]
top_legit_features = sorted(zip(feature_names, feature_importance), key=lambda x: x[1])[:20]

# Display results in terminal
print("\n" + "="*80)
print("                    FRAUD DETECTION MODEL EVALUATION REPORT")
print("="*80)
print(f"Training Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Dataset Size: {len(df)} samples")
print(f"Training Set: {len(X_train)} samples")
print(f"Test Set: {len(X_test)} samples")
print("\n" + "-"*50)
print("                 PERFORMANCE METRICS")
print("-"*50)
print(f"Accuracy:     {accuracy:.4f} ({accuracy*100:.2f}%)")
print(f"Precision:    {precision:.4f} ({precision*100:.2f}%)")
print(f"Recall:       {recall:.4f} ({recall*100:.2f}%)")
print(f"F1-Score:     {f1:.4f} ({f1*100:.2f}%)")
print(f"ROC-AUC:      {roc_auc:.4f} ({roc_auc*100:.2f}%)")

print("\n" + "-"*50)
print("                 CONFUSION MATRIX")
print("-"*50)
print(f"True Negatives:  {cm[0,0]:>6} | False Positives: {cm[0,1]:>6}")
print(f"False Negatives: {cm[1,0]:>6} | True Positives:  {cm[1,1]:>6}")

print("\n" + "-"*50)
print("            TOP 10 FRAUD INDICATORS")
print("-"*50)
for i, (feature, weight) in enumerate(top_fraud_features[:10], 1):
    print(f"{i:2d}. {feature:<25} (weight: {weight:>7.4f})")

print("\n" + "-"*50)
print("          TOP 10 LEGITIMACY INDICATORS")
print("-"*50)
for i, (feature, weight) in enumerate(top_legit_features[:10], 1):
    print(f"{i:2d}. {feature:<25} (weight: {weight:>7.4f})")

print("\n" + "="*80)
print("Detailed classification report:")
print(classification_report(y_test, y_pred))

# Generate comprehensive markdown report
generate_markdown_report(accuracy, precision, recall, f1, roc_auc, cm, 
                        top_fraud_features, top_legit_features, 
                        len(df), len(X_train), len(X_test))

# Save the model and vectorizer
with open('nlp_model.pkl', 'wb') as f:
    pickle.dump(model, f)

with open('vectorizer.pkl', 'wb') as f:
    pickle.dump(vectorizer, f)

print("\nModel and vectorizer saved.")
print("Evaluation report saved as 'model_evaluation_report.md'")
print("="*80)