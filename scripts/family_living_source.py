"""Shared source-review and provider-reset checks for family animation batches."""
import hashlib
import pathlib

OWNER_COLOR_PHOTOS = frozenset({
    '89b5dd6a048342ecb9cd4b29b73ca197',
    'd76e78dc736a404fac0f36d68d2a760f',
    'bf40496bb90e2613af4a4241774bd5e2',
    'd7b1e3781daa6b6661a898ba74ab189a',
    'e48c823d271b6dc6376bd5a6dc6b18d7',
    '28749cbdcf63d93b2057df6dc7f2b331',
    '7f834c11121870e685c22c8bc1c78de5',
    '75013c4f396008bfdbdd4870c95e61f6',
    'ee26ad2b6d314ca4bbc2c5ba5526b76d',
    'e1df939ebe3fda0a3a25e7d26510f9ab',
    '99be75ed2b8ff536d6aba12f0c76f228',
})


def owner_color_exception(photo):
    return photo.get('id') in OWNER_COLOR_PHOTOS and photo.get('requestedColorException') is True


def verified_source(photo):
    """Bind a visual source review to unchanged bytes, with named exceptions."""
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
