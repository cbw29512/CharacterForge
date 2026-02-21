from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session, flash, request
from db import db
from models import Campaign, CampaignMembership, Character

player_bp = Blueprint("player", __name__, url_prefix="/player")

def _require_login():
    if not session.get("user_id"):
        flash("Please log in.", "error")
        return False
    return True

@player_bp.get("/")
def dashboard():
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    uid = session.get("user_id")
    # Campaigns where player is approved member
    memberships = CampaignMembership.query.filter_by(user_id=uid, approved=True).all()
    campaign_ids = [m.campaign_id for m in memberships]
    campaigns = Campaign.query.filter(Campaign.id.in_(campaign_ids)).all()
    # Pending requests
    pending = CampaignMembership.query.filter_by(user_id=uid, approved=False).all()
    return render_template("player/dashboard.html", campaigns=campaigns, pending=pending)

@player_bp.post("/campaigns/<int:cid>/join")
def join_campaign(cid: int):
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    uid = session.get("user_id")
    existing = CampaignMembership.query.filter_by(campaign_id=cid, user_id=uid).first()
    if existing:
        flash("You already have a pending or active membership.", "error")
        return redirect(url_for("player.dashboard"))
    m = CampaignMembership(campaign_id=cid, user_id=uid, role="player", approved=False)
    db.session.add(m)
    db.session.commit()
    flash("Join request sent! Wait for DM or Admin to approve.", "ok")
    return redirect(url_for("player.dashboard"))

@player_bp.get("/campaigns/browse")
def browse_campaigns():
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    uid = session.get("user_id")
    # Show active campaigns player isn't already in
    all_campaigns = Campaign.query.filter_by(is_active=True).all()
    my_ids = {m.campaign_id for m in CampaignMembership.query.filter_by(user_id=uid).all()}
    available = [c for c in all_campaigns if c.id not in my_ids]
    return render_template("player/browse.html", campaigns=available)
