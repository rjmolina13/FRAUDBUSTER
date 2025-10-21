#!/usr/bin/env python3
"""
Generate 15 sample job posting pages with a mix of legitimate and fraudulent postings.
"""

import random
import os
from datetime import datetime, timedelta

# Legitimate job data
legitimate_jobs = [
    {
        "title": "Software Engineer - Full Stack",
        "company": "TechCorp Solutions Inc.",
        "location": "San Francisco, CA",
        "salary": "$90,000 - $120,000",
        "type": "Full-time",
        "description": "Join our dynamic team as a Full Stack Developer. You'll work on cutting-edge web applications using modern technologies including React, Node.js, and PostgreSQL. We're looking for someone passionate about clean code and user experience.",
        "requirements": "Bachelor's degree in Computer Science or related field. 3+ years of experience with JavaScript, React, Node.js. Experience with databases and RESTful APIs. Strong problem-solving skills.",
        "benefits": "Health insurance, 401(k) matching, flexible work hours, professional development budget, stock options.",
        "contact": "Apply through our careers page or email careers@techcorp.com"
    },
    {
        "title": "Marketing Manager",
        "company": "Global Marketing Solutions",
        "location": "New York, NY",
        "salary": "$75,000 - $95,000",
        "type": "Full-time",
        "description": "Lead marketing campaigns for Fortune 500 clients. Develop comprehensive marketing strategies, manage social media presence, and analyze campaign performance metrics.",
        "requirements": "Bachelor's degree in Marketing or Business. 5+ years marketing experience. Proficiency in Google Analytics, social media platforms, and marketing automation tools.",
        "benefits": "Comprehensive health coverage, dental, vision, 3 weeks PTO, performance bonuses.",
        "contact": "Send resume to hr@globalmarketing.com"
    },
    {
        "title": "Data Analyst",
        "company": "DataInsights Corp",
        "location": "Austin, TX",
        "salary": "$65,000 - $85,000",
        "type": "Full-time",
        "description": "Analyze large datasets to provide actionable business insights. Create dashboards and reports using SQL, Python, and Tableau. Work closely with cross-functional teams.",
        "requirements": "Bachelor's degree in Statistics, Mathematics, or related field. 2+ years experience with SQL and Python. Experience with data visualization tools like Tableau or Power BI.",
        "benefits": "Health insurance, retirement plan, flexible schedule, remote work options.",
        "contact": "Apply at careers.datainsights.com"
    },
    {
        "title": "Customer Service Representative",
        "company": "ServiceFirst Inc.",
        "location": "Phoenix, AZ",
        "salary": "$35,000 - $42,000",
        "type": "Full-time",
        "description": "Provide excellent customer support via phone, email, and chat. Resolve customer issues and maintain high satisfaction ratings. Training provided.",
        "requirements": "High school diploma required. Excellent communication skills. Previous customer service experience preferred but not required.",
        "benefits": "Health insurance, paid training, employee discounts, career advancement opportunities.",
        "contact": "Apply online at servicefirst.com/careers"
    },
    {
        "title": "Graphic Designer",
        "company": "Creative Studios LLC",
        "location": "Los Angeles, CA",
        "salary": "$50,000 - $65,000",
        "type": "Full-time",
        "description": "Create visual content for digital and print media. Work on branding projects, website designs, and marketing materials for diverse clients.",
        "requirements": "Bachelor's degree in Graphic Design or related field. Proficiency in Adobe Creative Suite. Strong portfolio demonstrating creative skills.",
        "benefits": "Health coverage, creative workspace, flexible hours, professional development opportunities.",
        "contact": "Send portfolio to jobs@creativestudios.com"
    },
    {
        "title": "Project Manager",
        "company": "BuildRight Construction",
        "location": "Denver, CO",
        "salary": "$70,000 - $90,000",
        "type": "Full-time",
        "description": "Oversee construction projects from planning to completion. Coordinate with contractors, manage budgets, and ensure projects meet deadlines and quality standards.",
        "requirements": "Bachelor's degree in Construction Management or Engineering. 4+ years project management experience. PMP certification preferred.",
        "benefits": "Comprehensive benefits package, company vehicle, performance bonuses, retirement plan.",
        "contact": "Email resume to hr@buildright.com"
    },
    {
        "title": "Registered Nurse",
        "company": "City General Hospital",
        "location": "Chicago, IL",
        "salary": "$65,000 - $80,000",
        "type": "Full-time",
        "description": "Provide compassionate patient care in our medical-surgical unit. Work with a collaborative healthcare team to deliver excellent patient outcomes.",
        "requirements": "RN license required. BSN preferred. 1+ years hospital experience. BLS and ACLS certification required.",
        "benefits": "Excellent health benefits, tuition reimbursement, shift differentials, retirement plan.",
        "contact": "Apply through our hospital careers portal"
    },
    {
        "title": "Sales Associate",
        "company": "RetailMax Stores",
        "location": "Miami, FL",
        "salary": "$30,000 - $40,000 + Commission",
        "type": "Full-time",
        "description": "Assist customers with product selection, process transactions, and maintain store appearance. Opportunity for advancement to management roles.",
        "requirements": "High school diploma. Strong interpersonal skills. Retail experience preferred. Ability to work weekends and holidays.",
        "benefits": "Employee discount, health insurance after 90 days, paid time off, sales incentives.",
        "contact": "Apply in person or online at retailmax.com/careers"
    }
]

# Fraudulent job data
fraudulent_jobs = [
    {
        "title": "URGENT! Work From Home - $5000/Week GUARANTEED!",
        "company": "Global Opportunities LLC",
        "location": "Work From Home",
        "salary": "$5,000/week GUARANTEED",
        "type": "Part-time/Full-time",
        "description": "AMAZING OPPORTUNITY! Make $5000 per week working from home! No experience needed! Just follow our simple system and start earning immediately! Limited spots available!",
        "requirements": "No experience required! Must be 18+. Must have computer and internet. Serious inquiries only!",
        "benefits": "Immediate start! Weekly payments! Work your own hours! No boss!",
        "contact": "Send $299 for starter kit to: quickcash@tempmail.com or text 555-SCAM-NOW. Payment via Western Union or Bitcoin only!"
    },
    {
        "title": "EASY MONEY! Data Entry Job - $45/Hour",
        "company": "FastCash Data Solutions",
        "location": "Remote",
        "salary": "$45/hour - Daily Payments!",
        "type": "Part-time",
        "description": "Simple data entry work! Type names and addresses into our system. Get paid daily! No experience needed! Start today!",
        "requirements": "Must pay $197 registration fee for identity verification, background check, and training materials. Must be available to start immediately.",
        "benefits": "Daily payments via PayPal! Work from anywhere! Flexible schedule!",
        "contact": "Pay registration fee via MoneyGram to agent ID: SCAM123. Email confirmation to: dataentry@fakemail.net"
    },
    {
        "title": "Mystery Shopper - Earn $300-500 Per Assignment",
        "company": "Secret Shopping Network",
        "location": "Your Local Area",
        "salary": "$300-500 per assignment",
        "type": "Contract",
        "description": "Become a mystery shopper! Visit stores, evaluate service, keep the products! Easy money! We'll send you checks to deposit and wire back the difference.",
        "requirements": "Must have bank account. Must be able to wire money quickly. No experience needed!",
        "benefits": "Keep all products! Easy work! Immediate payment!",
        "contact": "Reply with full name, address, phone, and bank details to: mysteryshopper@scammail.org"
    },
    {
        "title": "Government Grant Money Processor - $4000/Week",
        "company": "Federal Grant Processing Center",
        "location": "Home Based",
        "salary": "$4,000/week",
        "type": "Full-time",
        "description": "Process government grant applications from home! The government needs help distributing grant money! Easy work, huge pay!",
        "requirements": "Must pay $149 processing fee. Must have checking account. Must be US citizen.",
        "benefits": "Government backed! Guaranteed income! Work from home!",
        "contact": "Send processing fee to: P.O. Box 123, Scamville, ST 12345. Include copy of driver's license and bank statement."
    },
    {
        "title": "Envelope Stuffing - $2 Per Envelope!",
        "company": "Mail Processing Solutions",
        "location": "Work From Home",
        "salary": "$2 per envelope - Unlimited earning potential!",
        "type": "Part-time",
        "description": "Stuff envelopes at home! We provide everything! Make hundreds per day! Simple work anyone can do!",
        "requirements": "Send $39.95 for starter kit and instructions. Must be serious about making money!",
        "benefits": "Work your own hours! Unlimited income! Simple work!",
        "contact": "Send check or money order to: Envelope Scams Inc, 456 Fraud St, Scamtown, ST 67890"
    },
    {
        "title": "Online Survey Taker - $75/Hour GUARANTEED",
        "company": "Survey Cash Network",
        "location": "Online",
        "salary": "$75/hour guaranteed",
        "type": "Part-time",
        "description": "Take simple online surveys and get paid $75 per hour! Companies need your opinion! Start earning today!",
        "requirements": "Must pay $67 membership fee for access to premium surveys. Must complete 10 surveys minimum per week.",
        "benefits": "Guaranteed hourly rate! Work anytime! Easy surveys!",
        "contact": "Pay membership fee via gift cards (iTunes, Google Play, Amazon) and email codes to: surveys@fakecash.net"
    },
    {
        "title": "Cryptocurrency Investment Advisor - $10,000/Month",
        "company": "CryptoWealth Advisors",
        "location": "Remote",
        "salary": "$10,000/month + bonuses",
        "type": "Full-time",
        "description": "Help people invest in cryptocurrency! No experience needed - we provide all training! Join the crypto revolution and get rich quick!",
        "requirements": "Must invest $500 minimum in our training program. Must recruit 5 people per month. Must be motivated to succeed!",
        "benefits": "Unlimited earning potential! Crypto bonuses! Work from anywhere!",
        "contact": "Send Bitcoin payment of 0.02 BTC to wallet: 1ScamWallet123456789 and email transaction ID to: crypto@ponzischeme.biz"
    }
]

def generate_job_card(job, is_fraud=False):
    """Generate HTML for a single job card."""
    
    return f'''
    <div class="job-card">
        <div class="job-header">
            <h2 class="job-title">{job["title"]}</h2>
            <div class="company-name">{job["company"]}</div>
        </div>
        
        <div class="job-meta">
            <span class="location">📍 {job["location"]}</span>
            <span class="salary">💰 {job["salary"]}</span>
            <span class="job-type">⏰ {job["type"]}</span>
        </div>
        
        <div class="job-description">
            <p>{job["description"]}</p>
        </div>
        
        <div class="job-requirements">
            <h4>Requirements:</h4>
            <p>{job["requirements"]}</p>
        </div>
        
        <div class="job-benefits">
            <h4>Benefits:</h4>
            <p>{job["benefits"]}</p>
        </div>
        
        <div class="job-footer">
            <div class="contact-info">
                <strong>How to Apply:</strong> {job["contact"]}
            </div>
            <button class="apply-button">Apply Now</button>
        </div>
    </div>
    '''

def generate_page(page_num, jobs_on_page):
    """Generate a complete HTML page."""
    # Read template
    with open('template.html', 'r') as f:
        template = f.read()
    
    # Generate job listings HTML
    job_listings_html = ""
    for job, is_fraud in jobs_on_page:
        job_listings_html += generate_job_card(job, is_fraud)
    
    # Navigation logic
    prev_page = f"page{page_num-1}.html" if page_num > 1 else "#"
    next_page = f"page{page_num+1}.html" if page_num < 15 else "#"
    prev_disabled = "disabled" if page_num == 1 else ""
    next_disabled = "disabled" if page_num == 15 else ""
    
    # Replace placeholders
    html = template.replace("{{PAGE_NUMBER}}", str(page_num))
    html = html.replace("{{JOB_LISTINGS}}", job_listings_html)
    html = html.replace("{{PREV_PAGE}}", prev_page)
    html = html.replace("{{NEXT_PAGE}}", next_page)
    html = html.replace("{{PREV_DISABLED}}", prev_disabled)
    html = html.replace("{{NEXT_DISABLED}}", next_disabled)
    
    return html

def main():
    """Generate all 15 pages."""
    print("Generating 15 job posting pages...")
    
    for page_num in range(1, 16):
        # Determine number of jobs for this page (5-10)
        num_jobs = random.randint(5, 10)
        
        # Create mix of legitimate and fraudulent jobs
        jobs_on_page = []
        
        for _ in range(num_jobs):
            # 70% chance of legitimate job, 30% chance of fraud
            if random.random() < 0.7:
                job = random.choice(legitimate_jobs)
                jobs_on_page.append((job, False))
            else:
                job = random.choice(fraudulent_jobs)
                jobs_on_page.append((job, True))
        
        # Generate page HTML
        page_html = generate_page(page_num, jobs_on_page)
        
        # Write to file
        filename = f"page{page_num}.html"
        with open(filename, 'w') as f:
            f.write(page_html)
        
        print(f"Generated {filename} with {num_jobs} job postings")
    
    print("\nAll pages generated successfully!")
    print("Open page1.html in your browser to start browsing the job postings.")

if __name__ == "__main__":
    main()