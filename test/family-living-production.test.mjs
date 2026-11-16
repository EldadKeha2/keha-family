import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('production rejects unreviewed or changed sources and preserves quota blocks after replacing a color photograph',()=>{
  const scripts=fileURLToPath(new URL('../scripts/',import.meta.url));
  const output=execFileSync('python3',['-c',`
import hashlib, pathlib, sys, tempfile, time
sys.path.insert(0,sys.argv[1])
from family_living_source import verified_source, free_quota_reset, output_tones_reviewed
with tempfile.TemporaryDirectory() as directory:
    source=pathlib.Path(directory)/'source.jpg'
    source.write_bytes(b'reviewed original fixture')
    photo={'id':'a'*32,'source':str(source),'revision':'original'}
    def rejected():
        try: verified_source(photo)
        except ValueError: return
        raise AssertionError('Ineligible source accepted')
    rejected()
    photo['blackAndWhiteReview']={'kind':'original-black-and-white','reviewed':True,'revision':'original','sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    assert verified_source(photo)==source
    photo['revision']='edited'
    rejected()
    photo['revision']='original'
    source.write_bytes(b'replaced by a color source')
    rejected()
    photo['blackAndWhiteReview']['kind']='color'
    rejected()
    photo['requestedColorException']=True
    photo['sourceReview']={'kind':'owner-requested-color','reviewed':True,'revision':'original','sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    rejected()
    photo['id']='89b5dd6a048342ecb9cd4b29b73ca197'
    assert verified_source(photo)==source
    assert not output_tones_reviewed(photo,{'monochromeReviewed':True})
    assert output_tones_reviewed(photo,{'colorPreservationReviewed':True})
    photo['id']='d76e78dc736a404fac0f36d68d2a760f'
    assert verified_source(photo)==source
    assert output_tones_reviewed(photo,{'colorPreservationReviewed':True})
    photo['requestedColorException']=False
    rejected()
    photo['requestedColorException']=True
    photo['revision']='edited'
    rejected()
    reset=time.time()+86400
    blocked={'error':'You have exceeded your ZeroGPU quota','retryAfter':reset}
    assert free_quota_reset({'jobs':{'removed-color:wave':blocked}})==reset
    assert free_quota_reset({'jobs':{},'excludedJobs':{'removed-color:wave':blocked}})==reset
    assert free_quota_reset({'freeQuotaResetAt':reset,'jobs':{}})==reset
    assert free_quota_reset({})==0
print('verified')
`,scripts],{encoding:'utf8'});
  assert.equal(output.trim(),'verified');
});
