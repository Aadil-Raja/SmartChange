from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
import sys, traceback
from app.deps.db import get_db
from app.deps.auth import get_current_admin
import shared.schemas as schemas
from shared.schemas.training_admin import MainTopicsUpdate
from app.services import admin_service, documents_service
from app.utils.response_utils import make_response
from fastapi import Path

router = APIRouter()

# ---------------------------
# Admin Auth
# ---------------------------
@router.post("/login", status_code=status.HTTP_200_OK)
def admin_login_route(payload: schemas.AdminLoginIn, db: Session = Depends(get_db)):
    """
    Admin-only login. Returns access token or error JSON.
    """
    try:
        return admin_service.admin_login(db, email=payload.email, password=payload.password)
    except Exception as e:
        return make_response(False, "Login failed", status_code=500, error=str(e))


# ---------------------------
# Teams CRUD (Admin only)
# ---------------------------
@router.post("/teams", status_code=status.HTTP_201_CREATED)
def create_team_route(
    payload: schemas.TeamCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Create a team (unique name).
    """
    try:
        return admin_service.create_team(db, name=payload.name)
    except Exception as e:
        return make_response(False, "Could not create team", status_code=500, error=str(e))


@router.get("/teams", status_code=status.HTTP_200_OK)
def list_teams_route(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    List all teams.
    """
    try:
        return admin_service.list_teams(db)
    except Exception as e:
        return make_response(False, "Could not load teams", status_code=500, error=str(e))


@router.get("/teams/{id}", status_code=status.HTTP_200_OK)
def get_team_route(
    id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Get a single team with its members.
    """
    try:
        return admin_service.get_team_with_members(db, id)
    except Exception as e:
        return make_response(False, "Could not load team details", status_code=500, error=str(e))


@router.patch("/teams/{id}", status_code=status.HTTP_200_OK)
def update_team_route(
    id: int,
    payload: schemas.TeamUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Update team name.
    """
    try:
        return admin_service.update_team(db, id=id, name=payload.name)
    except Exception as e:
        return make_response(False, "Could not update team", status_code=500, error=str(e))


@router.delete("/teams/{id}", status_code=status.HTTP_200_OK)
def delete_team_route(
    id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Delete a team and all its members.
    """
    try:
        return admin_service.delete_team(db, id=id)
    except Exception as e:
        return make_response(False, "Could not delete team", status_code=500, error=str(e))


@router.post("/teams/{id}/members", status_code=status.HTTP_201_CREATED)
def add_member_route(
    id: int,
    payload: schemas.TeamMemberAdd,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Add a member to a team.
    """
    try:
        return admin_service.add_member(
            db,
            team_id=id,
            user_id=payload.user_id,
            role_in_team=payload.role_in_team,
        )
    except Exception as e:
        return make_response(False, "Could not add member", status_code=500, error=str(e))


@router.patch("/teams/{id}/members/{user_id}", status_code=status.HTTP_200_OK)
def update_team_member_role_route(
    id: int,
    user_id: int,
    payload: schemas.TeamMemberRoleUpdate,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    Update a member's role using team_id + user_id.
    """
    try:
        return admin_service.update_team_member_role(
            db,
            team_id=id,
            user_id=user_id,
            new_role=payload.role_in_team,
        )
    except Exception as e:
        return make_response(False, "Could not update team member role", status_code=500, error=str(e))


@router.delete("/teams/{id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_member_route(
    id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Remove a member from a team.
    """
    try:
        return admin_service.remove_member(db, team_id=id, user_id=user_id)
    except Exception as e:
        return make_response(False, "Could not remove member", status_code=500, error=str(e))


@router.get("/employees", status_code=status.HTTP_200_OK)
def list_employees_route(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Fetch all users except admins.
    Includes team name and team role if present.
    """
    try:
        return admin_service.list_employees(db)
    except Exception as e:
        return make_response(False, "Could not fetch employees", status_code=500, error=str(e))


# ---------------------------
# Team Roles (Admin only)
# ---------------------------
@router.get("/team-roles", status_code=status.HTTP_200_OK)
def get_team_roles_route(
    _admin=Depends(get_current_admin),
):
    """
    Fetch all available team roles.
    """
    try:
        return admin_service.get_team_roles()
    except Exception as e:
        return make_response(False, "Could not fetch team roles", status_code=500, error=str(e))


# ---------------------------
# User Management (Admin only)
# ---------------------------
@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user_route(
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Delete a user by ID. Cannot delete admin users.
    """
    try:
        return admin_service.delete_user(db, user_id=user_id)
    except Exception as e:
        return make_response(False, "Could not delete user", status_code=500, error=str(e))


# ---------------------------
# Document Management (Admin only)
# ---------------------------

@router.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    f: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    print("[upload_document] Received upload request", file=sys.stderr)
    try:
        if not f.filename.lower().endswith(".pdf"):
            return make_response(False, "Only PDF files are allowed", status_code=400)

        data = await f.read()
        print(f"[upload_document] File received: {f.filename}, size={len(data)} bytes", file=sys.stderr)

        if not data:
            return make_response(False, "Empty file", status_code=400)

        response = documents_service.upload_document_dual(
            db,
            user_id=_admin.id,
            file_bytes=data,
            filename=f.filename,
            mime=f.content_type,
            title=None,
            fail_if_cloudinary_fails=False,
        )

        print("[upload_document] Upload successful", file=sys.stderr)
        return response

    except Exception as e:
        print("[upload_document] ERROR while uploading:", e, file=sys.stderr)
        traceback.print_exc()
        return make_response(False, "Could not upload document", status_code=500, error=str(e))


@router.get("/documents/list")
async def list_documents_route(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    try:
        return documents_service.list_documents(db)
    except Exception as e:
        return make_response(False, "Could not list documents", status_code=500, error=str(e))


@router.post("/documents/{document_id}/queue")
async def queue_document_route(
    document_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    try:
        return documents_service.queue_document(db, document_id=document_id)
    except Exception as e:
        print(f"Error queueing document {document_id}: {e}")
        traceback.print_exc()
        return make_response(False, "Could not queue document", status_code=500, error=str(e))


@router.get("/jobs/{job_id}")
async def get_job(job_id: str = Path(...)):
    try:
        return documents_service.get_job_info(job_id)
    except Exception as e:
        return make_response(False, "Could not fetch job info", status_code=500, error=str(e))


@router.get("/processing-jobs", status_code=status.HTTP_200_OK)
def get_processing_jobs(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Get all document processing jobs with their current status.
    
    Returns:
        - List of jobs with status, stage, timing, and error details
        - Summary statistics
    """
    try:
        return documents_service.list_processing_jobs(db)
    except Exception as e:
        return make_response(False, "Could not fetch processing jobs", status_code=500, error=str(e))


# ---------------------------
# Main Topics Management
# ---------------------------

@router.patch("/documents/{document_id}/main-topics", status_code=status.HTTP_200_OK)
async def update_document_main_topics(
    document_id: int,
    payload: MainTopicsUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Update the main topics for a document.
    
    Args:
        document_id: ID of the document to update
        payload: MainTopicsUpdate schema with list of topics
        
    Returns:
        Updated document with new main topics
    """
    try:
        return documents_service.update_main_topics(
            db, 
            document_id=document_id, 
            main_topics=payload.main_topics
        )
    except Exception as e:
        print(f"Error updating main topics for document {document_id}: {e}", file=sys.stderr)
        traceback.print_exc()
        return make_response(False, "Could not update main topics", status_code=500, error=str(e))


@router.get("/documents/{document_id}/main-topics", status_code=status.HTTP_200_OK)
async def get_all_main_topics(
    document_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Get all main topics for a document.
    """
    try:
        return documents_service.list_main_topics(db, document_id=document_id)
    except Exception as e:
        print(f"Error fetching main topics: {e}", file=sys.stderr)
        traceback.print_exc()
        return make_response(False, "Could not fetch main topics", status_code=500, error=str(e))