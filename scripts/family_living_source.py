"""Shared source-review and provider-reset checks for family animation batches."""
import hashlib
import pathlib

OWNER_COLOR_PHOTO = '89b5dd6a048342ecb9cd4b29b73ca197'


def owner_color_exception(photo):
    return photo.get('id') == OWNER_COLOR_PHOTO and photo.get('requestedColorException') is True


def verified_source(photo):
    """Bind a visual source review to unchanged bytes, with one named exception."""
    color = owner_color_exception(photo)
    review = photo.get('sourceReview' if color else 'blackAndWhiteReview', {})
    revision = photo.get('revision', 'original')
    if (review.get('kind') != ('owner-requested-color' if color else 'original-black-and-white')
            or review.get('reviewed') is not True
            or review.get('revision') != revision):
        raise ValueError('A visually reviewed original black-and-white source is required: ' + photo['id'])
    source = pathlib.Path(photo['source'])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if review.get('sha256') != digest:
        raise ValueError('Source bytes changed after black-and-white review: ' + photo['id'])
    return source


def output_tones_reviewed(photo, job):
    return bool(job.get('colorPreservationReviewed') if owner_color_exception(photo) else job.get('monochromeReviewed'))


def free_quota_reset(state):
    """A replaced/excluded source must not erase the provider's quota rejection."""
    resets = [0, state.get('freeQuotaResetAt', 0)]
    for records in [state.get('jobs', {}).values(), state.get('excludedJobs', {}).values(), state.get('priorRejectedAttempts', [])]:
        resets.extend(job.get('retryAfter', 0) for job in records
                      if 'exceeded your ZeroGPU quota' in job.get('error', ''))
    return max(value for value in resets if isinstance(value, (int, float)))
