#!/usr/bin/env python3
"""Attach reviewed, completed local clips to the existing family website.

Uses the website's existing public contribution API. Does not call any model,
change originals, replace another contributor's clip, or use storage secrets.
"""
import argparse
import json
import pathlib
import urllib.parse
import urllib.request
from family_living_source import verified_source, output_tones_reviewed


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work-dir',type=pathlib.Path,required=True)
    parser.add_argument('--origin',default='https://keha-family.eldadkeha.workers.dev')
    args=parser.parse_args()
    journal=args.work_dir/'jobs.json'
    state=json.loads(journal.read_text())
    plan=json.loads((args.work_dir/'plan.json').read_text())
    approved={photo['id']:photo for photo in plan['photos']}
    for photo in approved.values():verified_source(photo)
    origin=args.origin.rstrip('/')
    with urllib.request.urlopen(urllib.request.Request(origin+'/api/family-ai/featured',headers={'User-Agent':'Mozilla/5.0'}),timeout=30)as response:album=json.load(response)
    items={item['id']:item for item in album['items']}
    for key,job in state['jobs'].items():
        if job['photoId'] not in approved or job.get('status')!='complete' or not job.get('reviewed') or not output_tones_reviewed(approved[job['photoId']], job):
            continue
        if job.get('sourceRevision','original')!=approved[job['photoId']].get('revision','original'):
            raise RuntimeError('Clip does not match the reviewed source revision: '+key)
        item=items.get(job['photoId'])
        if not item:raise RuntimeError('The photo is absent from the curated album: '+job['photoId'])
        action=next(a for a in item['animations']if a['id']==job['actionId'])
        if action.get('version')==job['operationId']:
            job['imported']=True
            continue
        if action.get('status')=='ready':raise RuntimeError('An existing clip needs explicit review before replacement: '+key)
        if item.get('photoRevision','original')!=job.get('sourceRevision','original'):raise RuntimeError('Source image changed; review before import: '+key)
        movie=pathlib.Path(job['file'])
        query=urllib.parse.urlencode({'revision':job.get('sourceRevision','original'),'operation':job['operationId'],'expected':'none','filename':movie.name})
        url=origin+'/api/family-ai/photos/'+job['photoId']+'/clips/'+job['actionId']+'?'+query
        request=urllib.request.Request(url,data=movie.read_bytes(),method='POST',headers={'Content-Type':'video/mp4','Origin':origin,'X-Family-Token':'family-public-v1','User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(request,timeout=60)as response:result=json.load(response)
        if not result.get('saved'):raise RuntimeError('The website did not acknowledge this clip: '+key)
        job.update(imported=True,siteClip=result['clip'])
        temp=journal.with_suffix('.tmp');temp.write_text(json.dumps(state,ensure_ascii=False,indent=2));temp.replace(journal)
        print(json.dumps({'photo':job['photoId'],'action':job['actionId'],'saved':True,'videoSrc':result['clip']['videoSrc']},ensure_ascii=False),flush=True)
    temp=journal.with_suffix('.tmp');temp.write_text(json.dumps(state,ensure_ascii=False,indent=2));temp.replace(journal)


if __name__=='__main__':main()
