#!/usr/bin/env python3
"""Prepare approved family animations on the anonymous, free ZeroGPU demo.

No account tokens, API billing, paid fallbacks, or automatic quota retries.
Jobs are journaled before observing them. Interrupted submissions require
reconciliation rather than duplicate generation. Originals are never edited.
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import time
import uuid

SPACE = 'https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space'
NEGATIVE = 'colorization, exaggerated expressions, facial distortion, changed identity, deformed hands, extra fingers, extra people, camera movement, abrupt motion, morphing, flicker, text, watermark'


def read_json(path, fallback):
    return json.loads(path.read_text()) if path.exists() else fallback


def save(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    temp.replace(path)


def log(**values):
    print(json.dumps(values, ensure_ascii=False), flush=True)


def check_video(path):
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))
    stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
    duration = float(info['format']['duration'])
    if stream['codec_name'] != 'h264' or not 4.8 <= duration <= 5.3:
        raise RuntimeError('Unexpected generated video format or duration')
    return {'duration': duration, 'width': stream['width'], 'height': stream['height'], 'size': path.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=pathlib.Path, required=True)
    parser.add_argument('--work-dir', type=pathlib.Path, required=True)
    parser.add_argument('--limit', type=int, default=30)
    args = parser.parse_args()
    args.work_dir.mkdir(parents=True, exist_ok=True)
    journal_path = args.work_dir / 'jobs.json'
    state = read_json(journal_path, {'provider': SPACE, 'paid_credentials_used': False, 'jobs': {}, 'uploads': {}})
    plan = read_json(args.plan, {})
    completed = 0
    # The official SDK carries the queue/session protocol and uploads the file
    # on the same replica. The REST demo returned opaque null errors on replicas.
    # token=False deliberately prevents using any cached paid account token.
    from gradio_client import Client, handle_file
    client = None
    for photo in plan['photos']:
        source = pathlib.Path(photo['source'])
        for action in photo['actions']:
            key = photo['id'] + ':' + action['id']
            job = state['jobs'].get(key, {})
            if job.get('status') == 'complete' and pathlib.Path(job['file']).is_file():
                continue
            if completed >= args.limit:
                return
            if job.get('status') == 'blocked':
                log(status='blocked', reason='Review the saved rejection before retrying', photo=photo['id'], action=action['id'])
                return
            elif job:
                log(status='blocked', reason='Uncertain submission: reconcile before another generation', photo=photo['id'], action=action['id'])
                return
            log(photo=photo['id'], action=action['id'], status='starting')
            try:
                if client is None:
                    client = Client(SPACE, token=False, verbose=False,
                                    analytics_enabled=False, max_workers=1,
                                    download_files=str(args.work_dir / 'sdk-output'),
                                    httpx_kwargs={'timeout': 60.0})
                job = {'photoId': photo['id'], 'actionId': action['id'], 'sourceRevision': photo.get('revision', 'original'), 'prompt': action['prompt'], 'createdAt': time.time(), 'status': 'submitting', 'operationId': uuid.uuid4().hex, 'protocol': 'official-gradio-sdk', 'sessionHash': client.session_hash}
                state['jobs'][key] = job
                save(journal_path, state)
                prediction = client.submit(input_image=handle_file(str(source)),
                    prompt=action['prompt'], steps=8, negative_prompt=NEGATIVE,
                    duration_seconds=5, guidance_scale=1, guidance_scale_2=1,
                    seed=action.get('seed', 42), randomize_seed=False,
                    api_name='/generate_video')
                previous_status = None
                while not prediction.done():
                    event_id = getattr(prediction.communicator, 'event_id', None)
                    status = prediction.status()
                    code = str(status.code.value)
                    if event_id and job.get('eventId') != event_id:
                        job.update(status='pending', eventId=event_id)
                        save(journal_path, state)
                    if code != previous_status:
                        log(photo=photo['id'], action=action['id'], status=code,
                            eventId=event_id, rank=status.rank)
                        previous_status = code
                    time.sleep(1)
                result = prediction.result()
                job.update(result=str(result), status='downloading')
                save(journal_path, state)
                target = args.work_dir / (photo['id'] + '-' + action['id'] + '.mp4')
                shutil.copyfile(result[0], target)
                job.update(status='complete', file=str(target.resolve()), info=check_video(target), reviewed=False, completedAt=time.time())
                save(journal_path, state)
                completed += 1
                log(photo=photo['id'], action=action['id'], status='complete', file=str(target), info=job['info'])
            except Exception as error:
                # No account rotation, alternate Space, or paid fallback on a
                # quota/billing/auth block. Keep the event ID for reconciliation.
                job.update(status='blocked', error=str(error), blockedAt=time.time())
                state['jobs'][key] = job
                state['blocked'] = {'photoId': photo['id'], 'actionId': action['id'], 'reason': str(error), 'time': time.time()}
                save(journal_path, state)
                log(status='blocked', photo=photo['id'], action=action['id'], reason=str(error))
                return


if __name__ == '__main__':
    main()
