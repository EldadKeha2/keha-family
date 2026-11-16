import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryCategory,memoryYear,sniffAudio} from '../src/memories.mjs';

test('memories allow an unknown year, but reject invalid categories and future dates',()=>{
  for(const value of ['',null,undefined])assert.equal(memoryYear(value),null);
  assert.equal(memoryYear('1934'),1934);assert.equal(memoryCategory('roots'),'roots');
  for(const value of [0,-1,'yesterday',2026.5,new Date().getUTCFullYear()+1])assert.throws(()=>memoryYear(value));
  assert.throws(()=>memoryCategory('aliyah'));assert.throws(()=>memoryCategory('<script>'));
});
test('recording types are recognized from bytes rather than trusting a renamed file',()=>{
  const bytes=word=>new TextEncoder().encode(word);
  assert.equal(sniffAudio(bytes('ID3\x04\0\0recording'),'recording.mp3').mime,'audio/mpeg');
  assert.equal(sniffAudio(bytes('RIFF1234WAVEdata'),'recording.wav').mime,'audio/wav');
  assert.equal(sniffAudio(bytes('OggSOpusHead'),'recording.ogg').mime,'audio/ogg');
  assert.equal(sniffAudio(bytes('fLaC1234'),'recording.flac').mime,'audio/flac');
  assert.equal(sniffAudio(bytes('1234ftypM4A '),'recording.m4a').mime,'audio/mp4');
  assert.equal(sniffAudio(new Uint8Array([255,241,80,128]),'recording.aac').mime,'audio/aac');
  assert.equal(sniffAudio(new Uint8Array([255,251,144,100]),'recording.mp3').mime,'audio/mpeg');
  for(const word of ['<script>alert(1)</script>','RIFF1234WEBP','1234ftypavif','1234ftypmp42',''])assert.throws(()=>sniffAudio(bytes(word),'renamed.mp3'));
});
