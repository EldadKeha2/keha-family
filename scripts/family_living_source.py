"""Shared source-review and provider-reset checks for family animation batches."""
import hashlib
import pathlib


def verified_source(photo):
    """Bind an actual visual black-and-white review to unchanged original bytes."""
    review = photo.get('blackAndWhiteReview', {})
    revision = photo.get('revision', 'original')
    if (review.get('kind') != 'original-black-and-white'
            or review.get('reviewed') is not True
            or review.get('revision') != revision):
        raise ValueError('A visually reviewed original black-and-white source is required: ' + photo['id'])
    source = pathlib.Path(photo['source'])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if review.get('sha256') != digest:
        raise ValueError('Source bytes changed after black-and-white review: ' + photo['id'])
    return source


def free_quota_reset(state):
    """A replaced/excluded source must not erase the provider's quota rejection."""
    resets = [0, state.get('freeQuotaResetAt', 0)]
    for records in [state.get('jobs', {}).values(), state.get('excludedJobs', {}).values(), state.get('priorRejectedAttempts', [])]:
        resets.extend(job.get('retryAfter', 0) for job in records
                      if 'exceeded your ZeroGPU quota' in job.get('error', ''))
    return max(value for value in resets if isinstance(value, (int, float)))
