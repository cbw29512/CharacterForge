from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session, flash
from db import db
from models import Campaign, CampaignMembership, Character, User

campaigns_bp = Blueprint("campaigns", __name__, url_prefix="/campaigns")

def _require_login():
    if not session.get("user_id"):
        flash("Please log in.", "error")
        return False
    return True

def _can_access_campaign(campaign: Campaign) -> bool:
    uid = session.get("user_id")
    role = session.get("role")
    if role == "admin":
        return True
    if campaign.dm_id == uid:
        return True
    m = CampaignMembership.query.filter_by(campaign_id=campaign.id, user_id=uid, approved=True).first()
    return m is not None

@campaigns_bp.get("/<int:cid>")
def view(cid: int):
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    campaign = Campaign.query.get_or_404(cid)
    if not _can_access_campaign(campaign):
        flash("You don't have access to this campaign.", "error")
        return redirect(url_for("auth.login_get"))

    uid = session.get("user_id")
    role = session.get("role")
    is_dm = (campaign.dm_id == uid or role == "admin")

    # Get all characters in campaign
    pc_chars = Character.query.filter_by(campaign_id=cid, is_npc=False).all()
    npc_chars = Character.query.filter_by(campaign_id=cid, is_npc=True).all()

    # Membership info (for DM panel)
    members = []
    pending = []
    if is_dm:
        approved_memberships = CampaignMembership.query.filter_by(campaign_id=cid, approved=True).all()
        pending_memberships = CampaignMembership.query.filter_by(campaign_id=cid, approved=False).all()
        members = [(m, User.query.get(m.user_id)) for m in approved_memberships]
        pending = [(m, User.query.get(m.user_id)) for m in pending_memberships]

    # My character in this campaign
    my_char = Character.query.filter_by(campaign_id=cid, owner_id=uid, is_npc=False).first()

    return render_template("campaigns/view.html",
        campaign=campaign,
        pc_chars=pc_chars,
        npc_chars=npc_chars,
        is_dm=is_dm,
        members=members,
        pending=pending,
        my_char=my_char,
    )
