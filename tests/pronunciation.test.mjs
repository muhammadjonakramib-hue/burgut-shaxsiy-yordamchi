import {test} from 'node:test';import assert from 'node:assert/strict';import {selectPronunciation} from '../public/pronunciation-core.mjs';
test('British audio is selected even when Australian and US audio come first',()=>{
 const result=selectPronunciation([{word:'hello',phonetics:[{audio:'https://api.dictionaryapi.dev/media/pronunciations/en/hello-au.mp3'},{text:'/həˈləʊ/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3'},{text:'/həˈloʊ/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3'}]}],'hello');
 assert.match(result.audio,/-uk.mp3$/);assert.equal(result.phonetic,'/həˈləʊ/');assert.equal(result.accent,'en-GB');
});
test('missing British audio is never substituted with US audio; mismatched word is ignored',()=>{
 const result=selectPronunciation([{word:'achieve',phonetics:[{text:'/əˈtʃiːv/',audio:''},{audio:'https://api.dictionaryapi.dev/media/pronunciations/en/achieve-us.mp3'}]}],'achieve');
 assert.equal(result.audio,'');assert.equal(result.accent,'unspecified');assert.equal(selectPronunciation([{word:'wrong',phonetics:[{text:'/a/'}]}],'hello').phonetic,'');
});
