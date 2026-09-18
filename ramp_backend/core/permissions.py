from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Only the user who added a place/attribute (or an admin) may edit it."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, "added_by", None) or getattr(obj, "submitted_by", None)
        return request.user.is_staff or owner == request.user


class CanVerifySubmissions(permissions.BasePermission):
    """
    Any authenticated user can confirm, dispute, or reject attribute values.
    The crowdsourced threshold (2 confirmations → 'verified') in views.py acts
    as the quality gate instead of a reputation score requirement.
    Staff/admins always pass through.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)



class IsApprovedVenueOwner(permissions.BasePermission):
    """Only approved venue owners can self-report on their claimed place."""

    def has_permission(self, request, view):
        profile = getattr(request.user, "venue_profile", None)
        return bool(profile and profile.approval_status == "approved")
