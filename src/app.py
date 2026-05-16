"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from pathlib import Path
from typing import Optional
from uuid import uuid4
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}

# In-memory user storage and sessions
users = {}
sessions = {}


class SignupRequest(BaseModel):
    email: str
    password: str
    branch: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ", 1)[1]
    email = sessions.get(token)
    if not email or email not in users:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = users[email]
    return {"email": email, "branch": user["branch"]}


@app.post("/auth/signup")
def auth_signup(payload: SignupRequest):
    email = payload.email.lower()
    if email in users:
        raise HTTPException(status_code=400, detail="User already exists")
    users[email] = {"password": payload.password, "branch": payload.branch}
    token = str(uuid4())
    sessions[token] = email
    return {
        "message": "Registered successfully",
        "token": token,
        "email": email,
        "branch": payload.branch,
    }


@app.post("/auth/login")
def auth_login(payload: LoginRequest):
    email = payload.email.lower()
    user = users.get(email)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = str(uuid4())
    sessions[token] = email
    return {
        "message": "Login successful",
        "token": token,
        "email": email,
        "branch": user["branch"],
    }


@app.get("/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/auth/logout")
def auth_logout(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ", 1)[1]
    sessions.pop(token, None)
    return {"message": "Logged out"}


def get_authenticated_email(email: Optional[str] = None,
                            authorization: Optional[str] = Header(None)) -> str:
    if authorization:
        current_user = get_current_user(authorization)
        return current_user["email"]
    if email:
        return email.lower()
    raise HTTPException(status_code=401, detail="Authentication required")


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str,
                       email: Optional[str] = None,
                       authorization: Optional[str] = Header(None)):
    """Sign up a student for an activity"""
    email = get_authenticated_email(email, authorization)

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str,
                             email: Optional[str] = None,
                             authorization: Optional[str] = Header(None)):
    """Unregister a student from an activity"""
    email = get_authenticated_email(email, authorization)

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
