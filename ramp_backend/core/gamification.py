"""
RAMP Gamification & Contributor Recognition Engine.
Handles contributor badges, community leaderboards, achievement milestones,
and tiered reward levels based on community reputation and verifiable contributions.
"""
from django.db import models
from django.db.models import Count, Q


REWARD_TIERS = [
    {
        "tier": "bronze",
        "name": "Bronze Contributor",
        "title": "Novice Scout",
        "min_score": 0,
        "max_score": 49,
        "color": "#cd7f32",
        "badge_color": "#b45309",
        "bg_color": "#fef3c7",
        "icon": "🥉",
        "perks": [
            "Submit places & access points",
            "Submit accessibility measurements & attributes",
            "View community accessibility scores & navigation maps",
        ],
    },
    {
        "tier": "silver",
        "name": "Silver Contributor",
        "title": "Trusted Pathfinder",
        "min_score": 50,
        "max_score": 149,
        "color": "#94a3b8",
        "badge_color": "#475569",
        "bg_color": "#f1f5f9",
        "icon": "🥈",
        "perks": [
            "Peer verification privileges on submitted attributes",
            "Silver contributor flair displayed on profile & contributions",
            "Fast-track processing for submitted venues",
        ],
    },
    {
        "tier": "gold",
        "name": "Gold Contributor",
        "title": "Accessibility Champion",
        "min_score": 150,
        "max_score": 349,
        "color": "#f59e0b",
        "badge_color": "#b45309",
        "bg_color": "#fffbeb",
        "icon": "🥇",
        "perks": [
            "Enhanced verification weight for contested accessibility attributes",
            "Gold emblem banner on all verified mapping contributions",
            "Featured spotlight on community leaderboard podium",
        ],
    },
    {
        "tier": "platinum",
        "name": "Platinum Contributor",
        "title": "Master Cartographer",
        "min_score": 350,
        "max_score": 749,
        "color": "#0ea5e9",
        "badge_color": "#0369a1",
        "bg_color": "#f0f9ff",
        "icon": "💎",
        "perks": [
            "Community moderation review eligibility",
            "Platinum profile aura and prioritized feedback channel",
            "Invitation to accessibility standards council",
        ],
    },
    {
        "tier": "diamond",
        "name": "Diamond Contributor",
        "title": "Accessibility Legend",
        "min_score": 750,
        "max_score": None,
        "color": "#8b5cf6",
        "badge_color": "#6d28d9",
        "bg_color": "#f5f3ff",
        "icon": "👑",
        "perks": [
            "Permanent Hall of Fame placement in RAMP history",
            "Diamond prestige crown badge and custom profile distinction",
            "Direct advisory status for RAMP accessibility initiatives",
        ],
    },
]


DEFAULT_BADGES = [
    # Mapping achievements
    {
        "code": "first-place-mapped",
        "name": "First Place Mapped",
        "description": "Mapped your very first accessible place in RAMP.",
        "category": "mapping",
        "tier": "bronze",
        "icon": "📍",
        "metric": "places_count",
        "threshold": 1,
        "points_reward": 5,
    },
    {
        "code": "city-explorer",
        "name": "City Explorer",
        "description": "Mapped 5 accessible places to expand public accessibility.",
        "category": "mapping",
        "tier": "silver",
        "icon": "🗺️",
        "metric": "places_count",
        "threshold": 5,
        "points_reward": 15,
    },
    {
        "code": "master-cartographer",
        "name": "Master Cartographer",
        "description": "Mapped 15 accessible places across towns and campuses.",
        "category": "mapping",
        "tier": "gold",
        "icon": "🏛️",
        "metric": "places_count",
        "threshold": 15,
        "points_reward": 30,
    },
    {
        "code": "urban-pioneer",
        "name": "Urban Pioneer",
        "description": "Mapped 30+ accessible places. A true foundation of the network!",
        "category": "mapping",
        "tier": "platinum",
        "icon": "🏙️",
        "metric": "places_count",
        "threshold": 30,
        "points_reward": 60,
    },

    # Verification achievements
    {
        "code": "first-verification",
        "name": "First Verification",
        "description": "Verified your first accessibility attribute submission.",
        "category": "verification",
        "tier": "bronze",
        "icon": "✅",
        "metric": "verifications_count",
        "threshold": 1,
        "points_reward": 5,
    },
    {
        "code": "ten-verifications",
        "name": "10 Verifications",
        "description": "Completed 10 independent accessibility attribute verifications.",
        "category": "verification",
        "tier": "silver",
        "icon": "🔍",
        "metric": "verifications_count",
        "threshold": 10,
        "points_reward": 20,
    },
    {
        "code": "eagle-eye",
        "name": "Eagle Eye",
        "description": "Completed 25 attribute verifications with verified precision.",
        "category": "verification",
        "tier": "gold",
        "icon": "🦅",
        "metric": "verifications_count",
        "threshold": 25,
        "points_reward": 40,
    },
    {
        "code": "community-guardian",
        "name": "Community Guardian",
        "description": "Completed 50 attribute verifications. Quality gatekeeper!",
        "category": "verification",
        "tier": "platinum",
        "icon": "🛡️",
        "metric": "verifications_count",
        "threshold": 50,
        "points_reward": 80,
    },

    # Attribute detail achievements
    {
        "code": "detail-contributor",
        "name": "Detail Contributor",
        "description": "Submitted your first accessibility attribute detail.",
        "category": "attributes",
        "tier": "bronze",
        "icon": "📝",
        "metric": "attributes_count",
        "threshold": 1,
        "points_reward": 5,
    },
    {
        "code": "accessibility-specialist",
        "name": "Accessibility Specialist",
        "description": "Submitted 10 detailed accessibility measurements or amenities.",
        "category": "attributes",
        "tier": "silver",
        "icon": "📐",
        "metric": "attributes_count",
        "threshold": 10,
        "points_reward": 20,
    },

    # Photo achievements
    {
        "code": "photo-contributor",
        "name": "Visual Chronicler",
        "description": "Uploaded your first accessibility photo with descriptive alt text.",
        "category": "photos",
        "tier": "bronze",
        "icon": "📸",
        "metric": "images_count",
        "threshold": 1,
        "points_reward": 5,
    },
    {
        "code": "photo-champion",
        "name": "Visual Champion",
        "description": "Uploaded 5 accessibility photos to help people navigate with confidence.",
        "category": "photos",
        "tier": "silver",
        "icon": "📷",
        "metric": "images_count",
        "threshold": 5,
        "points_reward": 20,
    },

    # Reputation milestones
    {
        "code": "rising-star",
        "name": "Rising Star",
        "description": "Earned 25 community reputation points.",
        "category": "milestone",
        "tier": "bronze",
        "icon": "⭐",
        "metric": "reputation_score",
        "threshold": 25,
        "points_reward": 0,
    },
    {
        "code": "community-pillar",
        "name": "Community Pillar",
        "description": "Earned 100 community reputation points through peer confirmations.",
        "category": "milestone",
        "tier": "gold",
        "icon": "🌟",
        "metric": "reputation_score",
        "threshold": 100,
        "points_reward": 0,
    },
    {
        "code": "accessibility-legend",
        "name": "Accessibility Legend",
        "description": "Reached 250+ community reputation points. True pillar of accessibility!",
        "category": "milestone",
        "tier": "diamond",
        "icon": "👑",
        "metric": "reputation_score",
        "threshold": 250,
        "points_reward": 0,
    },
]


def ensure_default_badges():
    """
    Initializes standard default badges in the database if they do not yet exist.
    """
    from .models import Badge
    for badge_data in DEFAULT_BADGES:
        Badge.objects.get_or_create(
            code=badge_data["code"],
            defaults=badge_data,
        )


def get_user_reward_tier(reputation_score):
    """
    Returns the contributor's current reward tier and progress to the next tier.
    """
    score = reputation_score or 0
    current_tier = REWARD_TIERS[0]
    next_tier = None

    for i, tier in enumerate(REWARD_TIERS):
        if tier["max_score"] is None:
            if score >= tier["min_score"]:
                current_tier = tier
                next_tier = None
                break
        elif tier["min_score"] <= score <= tier["max_score"]:
            current_tier = tier
            if i + 1 < len(REWARD_TIERS):
                next_tier = REWARD_TIERS[i + 1]
            break

    if next_tier:
        tier_range = next_tier["min_score"] - current_tier["min_score"]
        tier_progress = score - current_tier["min_score"]
        progress_percent = int(min(100, max(0, (tier_progress / max(1, tier_range)) * 100)))
        points_to_next = max(0, next_tier["min_score"] - score)
    else:
        progress_percent = 100
        points_to_next = 0

    return {
        "tier": current_tier["tier"],
        "name": current_tier["name"],
        "title": current_tier["title"],
        "min_score": current_tier["min_score"],
        "max_score": current_tier["max_score"],
        "color": current_tier["color"],
        "badge_color": current_tier["badge_color"],
        "bg_color": current_tier["bg_color"],
        "icon": current_tier["icon"],
        "perks": current_tier["perks"],
        "progress_percent": progress_percent,
        "points_to_next": points_to_next,
        "next_tier_name": next_tier["name"] if next_tier else None,
        "next_tier_title": next_tier["title"] if next_tier else None,
        "next_tier_icon": next_tier["icon"] if next_tier else None,
    }


def get_user_stats(user):
    """
    Computes active contribution metrics for a user across all RAMP features.
    """
    from .models import (
        AccessPointAttribute, AttributeVerification, FacilityAttribute,
        Image, Place, UserBadge,
    )
    if not user or not user.is_authenticated:
        return {
            "places_count": 0,
            "verifications_count": 0,
            "attributes_count": 0,
            "images_count": 0,
            "reputation_score": 0,
            "badges_count": 0,
        }

    places_count = Place.objects.filter(added_by=user).count()
    verifications_count = AttributeVerification.objects.filter(verified_by=user).count()
    ap_attrs = AccessPointAttribute.objects.filter(submitted_by=user).count()
    fac_attrs = FacilityAttribute.objects.filter(submitted_by=user).count()
    attributes_count = ap_attrs + fac_attrs
    images_count = Image.objects.filter(uploaded_by=user).exclude(verification_status="removed").count()
    reputation_score = user.reputation_score or 0
    badges_count = UserBadge.objects.filter(user=user).count()

    return {
        "places_count": places_count,
        "verifications_count": verifications_count,
        "attributes_count": attributes_count,
        "images_count": images_count,
        "reputation_score": reputation_score,
        "badges_count": badges_count,
    }


def evaluate_and_award_badges(user):
    """
    Checks the user's progress against all active achievement badges and
    awards any newly qualified badges. Returns a list of newly awarded UserBadge instances.
    """
    from .models import Badge, User, UserBadge

    if not user or not user.is_authenticated:
        return []

    ensure_default_badges()
    stats = get_user_stats(user)
    active_badges = Badge.objects.filter(is_active=True)
    existing_badge_ids = set(
        UserBadge.objects.filter(user=user).values_list("badge_id", flat=True)
    )

    newly_awarded = []
    bonus_points = 0

    for badge in active_badges:
        if badge.id in existing_badge_ids:
            continue

        metric_value = stats.get(badge.metric, 0)
        if metric_value >= badge.threshold:
            ub = UserBadge.objects.create(user=user, badge=badge)
            newly_awarded.append(ub)
            if badge.points_reward > 0:
                bonus_points += badge.points_reward

    if bonus_points > 0:
        User.objects.filter(id=user.id).update(
            reputation_score=models.F("reputation_score") + bonus_points
        )
        user.refresh_from_db(fields=["reputation_score"])

    return newly_awarded


def get_user_milestones(user):
    """
    Returns progress milestones grouped by activity for the user.
    """
    from .models import Badge, UserBadge

    ensure_default_badges()
    stats = get_user_stats(user)
    earned_badge_codes = set()
    if user and user.is_authenticated:
        earned_badge_codes = set(
            UserBadge.objects.filter(user=user).values_list("badge__code", flat=True)
        )

    all_badges = Badge.objects.filter(is_active=True).order_by("category", "threshold")

    milestones = []
    for badge in all_badges:
        current_val = stats.get(badge.metric, 0)
        completed = badge.code in earned_badge_codes or current_val >= badge.threshold
        pct = 100 if completed else int(min(100, max(0, (current_val / max(1, badge.threshold)) * 100)))

        milestones.append({
            "code": badge.code,
            "name": badge.name,
            "description": badge.description,
            "category": badge.category,
            "category_label": badge.get_category_display(),
            "tier": badge.tier,
            "icon": badge.icon,
            "metric": badge.metric,
            "current_value": current_val,
            "target_value": badge.threshold,
            "completed": completed,
            "progress_percent": pct,
            "points_reward": badge.points_reward,
        })

    return milestones


def get_leaderboard_data(ranking_type="reputation", current_user=None, limit=50):
    """
    Retrieves community leaderboard rankings with podium positions,
    top badges, and the requesting user's personal rank.
    """
    from .models import (
        AttributeVerification, Place, User, UserBadge,
    )

    users_qs = User.objects.filter(is_active=True)

    # Annotate counts
    users_qs = users_qs.annotate(
        places_count=Count("added_places", distinct=True),
        verifications_count=Count("attributeverification", distinct=True),
        badges_count=Count("user_badges", distinct=True),
    )

    if ranking_type == "verifications":
        users_qs = users_qs.order_by("-verifications_count", "-reputation_score", "-date_joined")
    elif ranking_type == "places":
        users_qs = users_qs.order_by("-places_count", "-reputation_score", "-date_joined")
    elif ranking_type == "badges":
        users_qs = users_qs.order_by("-badges_count", "-reputation_score", "-date_joined")
    else:  # default: reputation
        ranking_type = "reputation"
        users_qs = users_qs.order_by("-reputation_score", "-places_count", "-date_joined")

    total_contributors = users_qs.count()
    total_places = Place.objects.count()
    total_verifications = AttributeVerification.objects.count()

    # Fetch top ranked users
    ranked_users = list(users_qs[:limit])

    # Pre-fetch recent top badges for the leaderboard users
    user_ids = [u.id for u in ranked_users]
    if current_user and current_user.is_authenticated and current_user.id not in user_ids:
        user_ids.append(current_user.id)

    user_badges_map = {}
    for ub in UserBadge.objects.filter(user_id__in=user_ids).select_related("badge").order_by("-awarded_at"):
        if ub.user_id not in user_badges_map:
            user_badges_map[ub.user_id] = []
        if len(user_badges_map[ub.user_id]) < 3:
            user_badges_map[ub.user_id].append({
                "code": ub.badge.code,
                "name": ub.badge.name,
                "icon": ub.badge.icon,
                "tier": ub.badge.tier,
            })

    leaderboard = []
    user_rank_info = None

    for idx, u in enumerate(ranked_users, start=1):
        tier_info = get_user_reward_tier(u.reputation_score)
        entry = {
            "rank": idx,
            "id": str(u.id),
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "reputation_score": u.reputation_score,
            "places_count": u.places_count,
            "verifications_count": u.verifications_count,
            "badges_count": u.badges_count,
            "tier": tier_info["tier"],
            "tier_name": tier_info["name"],
            "tier_title": tier_info["title"],
            "tier_color": tier_info["color"],
            "tier_badge_color": tier_info["badge_color"],
            "tier_bg_color": tier_info["bg_color"],
            "tier_icon": tier_info["icon"],
            "top_badges": user_badges_map.get(u.id, []),
            "is_current_user": bool(current_user and current_user.is_authenticated and current_user.id == u.id),
        }
        leaderboard.append(entry)

        if entry["is_current_user"]:
            user_rank_info = entry

    # If authenticated user isn't in top `limit`, compute their exact rank
    if current_user and current_user.is_authenticated and not user_rank_info:
        stats = get_user_stats(current_user)
        tier_info = get_user_reward_tier(current_user.reputation_score)

        if ranking_type == "verifications":
            user_val = stats["verifications_count"]
            better_count = User.objects.filter(
                is_active=True
            ).annotate(cnt=Count("attributeverification")).filter(cnt__gt=user_val).count()
        elif ranking_type == "places":
            user_val = stats["places_count"]
            better_count = User.objects.filter(
                is_active=True
            ).annotate(cnt=Count("added_places")).filter(cnt__gt=user_val).count()
        elif ranking_type == "badges":
            user_val = stats["badges_count"]
            better_count = User.objects.filter(
                is_active=True
            ).annotate(cnt=Count("user_badges")).filter(cnt__gt=user_val).count()
        else:
            better_count = User.objects.filter(
                is_active=True, reputation_score__gt=current_user.reputation_score
            ).count()

        user_rank_info = {
            "rank": better_count + 1,
            "id": str(current_user.id),
            "username": current_user.username,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "reputation_score": current_user.reputation_score,
            "places_count": stats["places_count"],
            "verifications_count": stats["verifications_count"],
            "badges_count": stats["badges_count"],
            "tier": tier_info["tier"],
            "tier_name": tier_info["name"],
            "tier_title": tier_info["title"],
            "tier_color": tier_info["color"],
            "tier_badge_color": tier_info["badge_color"],
            "tier_bg_color": tier_info["bg_color"],
            "tier_icon": tier_info["icon"],
            "top_badges": user_badges_map.get(current_user.id, []),
            "is_current_user": True,
        }

    return {
        "ranking_type": ranking_type,
        "leaderboard": leaderboard,
        "user_rank": user_rank_info,
        "community_stats": {
            "total_contributors": total_contributors,
            "total_places": total_places,
            "total_verifications": total_verifications,
        },
        "reward_tiers": REWARD_TIERS,
    }
