"""
Seed script for OKR platform: reference demo data from Okrsitedesign-main.
Departments (Engineering, Sales, Marketing, Product, Customer Success), users (Sarah Chen etc.),
8 objectives with key results, workflow events, score history, comments, attachments.
"""
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import init_db, get_db


def seed_data():
    print("Initializing database connection...")
    init_db()
    db = get_db()

    print("Clearing existing OKR data...")
    db.departments.delete_many({})
    db.users.delete_many({})
    db.objectives.delete_many({})
    db.key_results.delete_many({})
    db.score_history.delete_many({})
    db.workflow_events.delete_many({})
    db.comments.delete_many({})
    db.attachments.delete_many({})

    now = datetime.now(timezone.utc)
    fiscal_year = 2026

    # --- Departments (reference: id, name, color)
    departments = [
        {"_id": "d1", "name": "Engineering", "color": "#3B82F6"},
        {"_id": "d2", "name": "Sales", "color": "#10B981"},
        {"_id": "d3", "name": "Marketing", "color": "#F59E0B"},
        {"_id": "d4", "name": "Product", "color": "#8B5CF6"},
        {"_id": "d5", "name": "Customer Success", "color": "#EC4899"},
    ]
    db.departments.insert_many(departments)
    print(f"Created {len(departments)} departments")

    # --- Users (reference: Sarah Chen admin, Marcus Rodriguez leader, etc.) Use auth0|demo_* for demo
    users = [
        {"_id": "auth0|demo_u1", "name": "Sarah Chen", "email": "sarah@company.com", "role": "admin", "departmentId": "d1"},
        {"_id": "auth0|demo_u2", "name": "Marcus Rodriguez", "email": "marcus@company.com", "role": "leader", "departmentId": "d2"},
        {"_id": "auth0|demo_u3", "name": "Emily Watson", "email": "emily@company.com", "role": "leader", "departmentId": "d3"},
        {"_id": "auth0|demo_u4", "name": "David Kim", "email": "david@company.com", "role": "manager", "departmentId": "d1"},
        {"_id": "auth0|demo_u5", "name": "Lisa Anderson", "email": "lisa@company.com", "role": "leader", "departmentId": "d4"},
        {"_id": "auth0|demo_u6", "name": "James Wilson", "email": "james@company.com", "role": "manager", "departmentId": "d2"},
    ]
    db.users.insert_many(users)
    print(f"Created {len(users)} users")

    # --- Objectives (reference: 2 strategic, 3 divisional, 3 tactical)
    objectives_data = [
        {
            "title": "Achieve Market Leadership in Enterprise AI Solutions",
            "description": "Establish our platform as the #1 choice for enterprise AI deployment",
            "level": "strategic",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u1",
            "departmentId": "d1",
            "division": "Engineering",
            "status": "approved",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "annual",
            "nextReviewDate": (now + timedelta(days=14)).date().isoformat(),
            "latestUpdateSummary": "Q1 review: enterprise pipeline strong; shifting one KR to account for longer security review.",
        },
        {
            "title": "Double Annual Recurring Revenue",
            "description": "Scale ARR from $50M to $100M by end of year",
            "level": "strategic",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u2",
            "departmentId": "d2",
            "division": "Sales",
            "status": "approved",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "annual",
        },
        {
            "title": "Launch Next-Gen AI Platform",
            "description": "Ship v3.0 with advanced machine learning capabilities",
            "level": "functional",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u1",
            "departmentId": "d1",
            "division": "Engineering",
            "status": "in_review",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "annual",
            "nextReviewDate": (now + timedelta(days=7)).date().isoformat(),
            "latestUpdateSummary": "Submitted for review: architecture sign-off complete; awaiting leadership approval on launch scope.",
        },
        {
            "title": "Expand Enterprise Sales Pipeline",
            "description": "Build qualified pipeline worth $100M",
            "level": "functional",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u2",
            "departmentId": "d2",
            "division": "Sales",
            "status": "approved",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "annual",
        },
        {
            "title": "Establish Thought Leadership in AI Space",
            "description": "Position company as industry leader through content and events",
            "level": "functional",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u3",
            "departmentId": "d3",
            "division": "Marketing",
            "status": "approved",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "annual",
        },
        {
            "title": "Implement Advanced ML Model Training Pipeline",
            "description": "Build automated training infrastructure for customer models",
            "level": "tactical",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u4",
            "departmentId": "d1",
            "division": "Engineering",
            "status": "draft",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "quarterly",
        },
        {
            "title": "Launch Partner Channel Program",
            "description": "Establish partnerships with 5 major system integrators",
            "level": "tactical",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u6",
            "departmentId": "d2",
            "division": "Sales",
            "status": "in_review",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "quarterly",
        },
        {
            "title": "Execute Q1 Digital Marketing Campaign",
            "description": "Drive awareness through targeted digital channels",
            "level": "tactical",
            "parentObjectiveId": None,
            "ownerId": "auth0|demo_u3",
            "departmentId": "d3",
            "division": "Marketing",
            "status": "approved",
            "fiscalYear": fiscal_year,
            "quarter": 1,
            "timeline": "quarterly",
        },
    ]
    obj_ids = []
    for o in objectives_data:
        doc = {
            **o,
            "createdAt": now,
            "updatedAt": now,
        }
        r = db.objectives.insert_one(doc)
        obj_ids.append(r.inserted_id)
    print(f"Created {len(obj_ids)} objectives")

    # --- Key results (reference KRs; map obj index to objective _id)
    krs_data = [
        (0, [("Reach 50% market share in target segment", 0.8), ("Achieve 95% customer satisfaction score", 0.9), ("Reduce customer churn to below 5%", 0.7)]),
        (1, [("Close $25M in new enterprise deals", 0.6), ("Expand in existing accounts by 40%", 0.7)]),
        (2, [("Complete platform architecture redesign", 0.9), ("Achieve 99.99% uptime in production", 0.8), ("Reduce API latency by 50%", 0.5)]),
        (3, [("Generate 200 qualified enterprise leads", 0.6), ("Achieve 30% lead-to-opportunity conversion", 0.7)]),
        (4, [("Publish 50 high-quality content pieces", 0.3), ("Speak at 10 major industry conferences", 0.4)]),
        (5, [("Deploy automated training system", 0.4), ("Reduce training time by 70%", 0.5), ("Support 100 concurrent training jobs", 0.6)]),
        (6, [("Sign 5 strategic partner agreements", 0.6), ("Generate $5M pipeline through partners", 0.4)]),
        (7, [("Reach 1M targeted impressions", 0.8), ("Achieve 5% click-through rate", 0.7), ("Generate 500 MQLs from campaign", 0.6)]),
    ]
    kr_ids = []
    kr_ids_by_obj = [[] for _ in range(len(obj_ids))]
    for obj_idx, krs in krs_data:
        oid = obj_ids[obj_idx]
        for title, score in krs:
            doc = {
                "objectiveId": oid,
                "title": title,
                "target": "1.0",
                "currentValue": str(score),
                "unit": "score",
                "score": score,
                "targetScore": 1.0,
                "ownerId": objectives_data[obj_idx]["ownerId"],
                "notes": [],
                "createdAt": now,
                "lastUpdatedAt": now,
            }
            r = db.key_results.insert_one(doc)
            kr_ids.append((r.inserted_id, oid, score))
            kr_ids_by_obj[obj_idx].append(r.inserted_id)
    print(f"Created {len(kr_ids)} key results")

    # --- Score history (reference: kr1 and kr6 sample history)
    for kr_oid, obj_oid, current_score in kr_ids[:10]:
        for i, (t_off, s) in enumerate([
            (75, 0.2), (60, 0.4), (45, 0.6), (30, 0.7), (0, current_score),
        ]):
            t = now - timedelta(days=t_off)
            db.score_history.insert_one({
                "keyResultId": kr_oid,
                "score": s,
                "notes": "Update",
                "recordedBy": "auth0|demo_u1",
                "recordedAt": t,
            })
    print("Created score history entries")

    # --- Workflow events
    for i, oid in enumerate(obj_ids):
        obj = objectives_data[i]
        status = obj["status"]
        if status != "draft":
            db.workflow_events.insert_one({
                "objectiveId": oid,
                "fromStatus": "draft",
                "toStatus": "in_review",
                "actorId": obj["ownerId"],
                "reason": "Submitted for review",
                "timestamp": now - timedelta(days=14),
            })
        if status in ("approved", "in_review"):
            db.workflow_events.insert_one({
                "objectiveId": oid,
                "fromStatus": "in_review",
                "toStatus": status,
                "actorId": "auth0|demo_u1",
                "reason": "Approved" if status == "approved" else "In review",
                "timestamp": now - timedelta(days=7),
            })
    print("Created workflow events")

    # --- Comments (reference updates)
    db.comments.insert_many([
        {"objectiveId": obj_ids[0], "authorId": "auth0|demo_u4", "body": "Great progress on the customer satisfaction front! The new onboarding process is really making a difference.", "createdAt": now - timedelta(days=1)},
        {"objectiveId": obj_ids[2], "authorId": "auth0|demo_u4", "body": "Updated KR6 score to 0.9 - architecture review completed successfully.", "createdAt": now},
        {"objectiveId": obj_ids[3], "authorId": "auth0|demo_u6", "body": "Pipeline is building nicely. Need to focus on conversion rate optimization next.", "createdAt": now - timedelta(days=1)},
    ])
    print("Created comments")

    # --- Attachments (reachable demo URLs so preview/download work without Cloudinary)
    sample_pdf = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    sample_png = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg"
    att_docs = [
        {"objectiveId": obj_ids[0], "fileName": "Q1_Strategy_Deck.pdf", "fileSize": 2458624, "fileType": "application/pdf", "url": sample_pdf, "uploadedBy": "auth0|demo_u1", "uploadedAt": now - timedelta(days=5)},
        {"objectiveId": obj_ids[0], "fileName": "Reference_Screenshot.png", "fileSize": 1245678, "fileType": "image/png", "url": sample_png, "uploadedBy": "auth0|demo_u1", "uploadedAt": now - timedelta(days=7)},
    ]
    if kr_ids_by_obj[2]:
        att_docs.append({"objectiveId": obj_ids[2], "keyResultId": kr_ids_by_obj[2][0], "fileName": "Architecture_Diagram.png", "fileSize": 845632, "fileType": "image/png", "url": sample_png, "uploadedBy": "auth0|demo_u4", "uploadedAt": now - timedelta(days=2)})
    db.attachments.insert_many(att_docs)
    print("Created attachments")

    print("\nSeed data loaded successfully.")
    print(f"  departments: {db.departments.count_documents({})}")
    print(f"  users: {db.users.count_documents({})}")
    print(f"  objectives: {db.objectives.count_documents({})}")
    print(f"  key_results: {db.key_results.count_documents({})}")
    print(f"  score_history: {db.score_history.count_documents({})}")
    print(f"  workflow_events: {db.workflow_events.count_documents({})}")
    print(f"  comments: {db.comments.count_documents({})}")
    print(f"  attachments: {db.attachments.count_documents({})}")


if __name__ == "__main__":
    try:
        seed_data()
    except Exception as e:
        print(f"\nError seeding data: {e}")
        import traceback
        traceback.print_exc()
