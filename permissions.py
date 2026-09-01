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
    Gate verification actions behind a minimum reputation score, so brand-new
    or low-trust accounts can't rubber-stamp submissions.
    """
    MIN_REPUTATION_TO_VERIFY = 10

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_staff
            or request.user.reputation_score >= self.MIN_REPUTATION_TO_VERIFY
        )


class IsApprovedVenueOwner(permissions.BasePermission):
    """Only approved venue owners can self-report on their claimed place."""

    def has_permission(self, request, view):
        profile = getattr(request.user, "venue_profile", None)
        return bool(profile and profile.approval_status == "approved")
