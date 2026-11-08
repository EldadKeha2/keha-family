import{test}from'node:test';
import assert from'node:assert/strict';
import{verifiedEvidence,proposalMatches}from'../public/assets/face-verification.mjs';

test('flowers, a hat and an ashtray cannot pass as people merely by surviving mirrored detections',()=>{
 for(const scores of [[.701,.851,.811],[.743,.858,.836],[.608,.722,.614],[0,0,.453],[.701,.315,0]])assert.equal(verifiedEvidence(scores,-1,40),false);
 assert.equal(verifiedEvidence([.735,.826,.824],2.868,190),true,'A partly hidden real face has separate cascade support');
 assert.equal(verifiedEvidence([.89,.901,.904],-1,134),true,'Sunglasses do not require the frontal cascade to agree');
 assert.equal(verifiedEvidence([.523,.463,.634],-1,8),true,'A distant face with only a few pixels retains its two-context route');
 assert.equal(verifiedEvidence([.7,0,0],-1,8),false,'One weak local view is insufficient even for a tiny face');
});
test('a face somewhere inside a large proposal crop is not proof of a torso or a neighbouring head',()=>{
 const face={rect:{x:.4,y:.2,width:.1,height:.12},score:.94};face.landmarks=[[.25,.3],[.7,.3],[.48,.53],[.32,.75],[.65,.75]].map(([x,y])=>({x:face.rect.x+x*face.rect.width,y:face.rect.y+y*face.rect.height}));
 assert.equal(proposalMatches({rect:{x:.395,y:.19,width:.115,height:.14}},face),true);
 assert.equal(proposalMatches({rect:{x:.4,y:.36,width:.2,height:.2}},face),false);
 assert.equal(proposalMatches({rect:{x:.1,y:.1,width:.8,height:.8}},face),false);
});

test('consistent local contexts retain genuine profiles without admitting frontal texture guesses',()=>{
 const profile={rect:{x:0,y:0,width:1,height:1},score:.85,landmarks:[{x:.4,y:.3},{x:.55,y:.3},{x:.25,y:.55},{x:.4,y:.75},{x:.5,y:.75}]};
 assert.equal(verifiedEvidence([.592,.754,.756],-1,44,profile),true);
 assert.equal(verifiedEvidence([.581,.543,.585],-1,30,{...profile,score:.717}),true);
 assert.equal(verifiedEvidence([.685,.740,.792],-1,122,{...profile,score:.695}),true);
 assert.equal(verifiedEvidence([.592,.754,.756],-1,44,{...profile,landmarks:undefined}),false);
 assert.equal(verifiedEvidence([.592,0,.756],-1,44,profile),false);
 assert.equal(verifiedEvidence([.581,.543,.585],-1,30,{...profile,score:.65}),false);
});
test('small distant heads need repeated scale support and the exception does not extend to large objects',()=>{
 assert.equal(verifiedEvidence([0,0,.595,0,.685,.712],-1,17,{score:.826}),true);
 assert.equal(verifiedEvidence([0,0,0,.767,.783,.767],-1,27,{score:.783}),true);
 assert.equal(verifiedEvidence([0,0,.595,0,.685,.712],-1,50,{score:.826}),false);
 assert.equal(verifiedEvidence([0,0,.595,0,.685,.712],-1,17,{score:.6}),false);
 assert.equal(verifiedEvidence([0,0,0,0,.685,.712],-1,17,{score:.826}),false);
});
