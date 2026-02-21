from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session, flash, request
from db import db
from models import User, Campaign, CampaignMembership, Character

dm_bp = Blueprint("dm", __name__, url_prefix="/dm")

def _require_dm():
    role = session.get("role")
    if role not in ("dm", "admin"):
        flash("DM or Admin access required.", "error")
        return False
    return True

def _is_admin():
    return session.get("role") == "admin"

def _owns_campaign(campaign: Campaign) -> bool:
    if _is_admin():
        return True
    return campaign.dm_id == session.get("user_id")

@dm_bp.get("/")
def dashboard():
    if not _require_dm():
        return redirect(url_for("auth.login_get"))
    uid = session.get("user_id")
    if _is_admin():
        campaigns = Campaign.query.order_by(Campaign.created_at.desc()).all()
    else:
        campaigns = Campaign.query.filter_by(dm_id=uid).order_by(Campaign.created_at.desc()).all()
    return render_template("dm/dashboard.html", campaigns=campaigns)

@dm_bp.post("/campaigns/create")
def create_campaign():
    if not _require_dm():
        return redirect(url_for("auth.login_get"))
    name = (request.form.get("name") or "").strip()
    desc = (request.form.get("description") or "").strip()
    if not name:
        flash("Campaign name required.", "error")
        return redirect(url_for("dm.dashboard"))
    uid = session.get("user_id")
    c = Campaign(name=name, description=desc, dm_id=uid)
    db.session.add(c)
    db.session.commit()
    m = CampaignMembership(campaign_id=c.id, user_id=uid, role="dm", approved=True)
    db.session.add(m)
    db.session.commit()
    flash(f"Campaign '{name}' created!", "ok")
    return redirect(url_for("campaigns.view", cid=c.id))

@dm_bp.post("/campaigns/<int:cid>/delete")
def delete_campaign(cid: int):
    if not _require_dm():
        return redirect(url_for("auth.login_get"))
    c = Campaign.query.get_or_404(cid)
    if not _owns_campaign(c):
        flash("You can only delete your own campaigns.", "error")
        return redirect(url_for("dm.dashboard"))
    db.session.delete(c)
    db.session.commit()
    flash("Campaign deleted.", "ok")
    return redirect(url_for("dm.dashboard"))

@dm_bp.post("/campaigns/<int:cid>/approve/<int:uid>")
def approve_player(cid: int, uid: int):
    if not _require_dm():
        return redirect(url_for("auth.login_get"))
    c = Campaign.query.get_or_404(cid)
    if not _owns_campaign(c):
        flash("Not your campaign.", "error")
        return redirect(url_for("dm.dashboard"))
    target_user = User.query.get_or_404(uid)
    if target_user.role == "dm" and not _is_admin():
        flash("DMs cannot approve other DMs. Contact Admin.", "error")
        return redirect(url_for("campaigns.view", cid=cid))
    m = CampaignMembership.query.filter_by(campaign_id=cid, user_id=uid).first_or_404()
    m.approved = True
    db.session.commit()
    flash(f"{target_user.display_name or target_user.username} approved.", "ok")
    return redirect(url_for("campaigns.view", cid=cid))

@dm_bp.post("/campaigns/<int:cid>/kick/<int:uid>")
def kick_player(cid: int, uid: int):
    if not _require_dm():
        return redirect(url_for("auth.login_get"))
    c = Campaign.query.get_or_404(cid)
    if not _owns_campaign(c):
        flash("Not your campaign.", "error")
        return redirect(url_for("dm.dashboard"))
    m = CampaignMembership.query.filter_by(campaign_id=cid, user_id=uid).first_or_404()
    db.session.delete(m)
    db.session.commit()
    flash("Player removed from campaign.", "ok")
    return redirect(url_for("campaigns.view", cid=cid))
