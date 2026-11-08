import {test} from 'node:test';import assert from 'node:assert/strict';
import {dayItems,summary,instant,localParts,conflicts,streak,lanes,calendarItems} from '../public/planner-core.mjs';
const p={id:'one',start_date:'2026-11-01',start_min:480,end_min:540,repeat:'daily',weekdays:[],timezone:'Asia/Tashkent',category:'study'};
test('recurring completion belongs only to its occurrence',()=>{
 const overrides=[{template_id:'one',date:'2026-11-05',status:'done'}];
 assert.equal(dayItems([p],overrides,'2026-11-05')[0].status,'done');
 assert.equal(dayItems([p],overrides,'2026-11-06')[0].status,'pending');
 assert.equal(summary(dayItems([p],overrides,'2026-11-05')).byCategory.study,60);
 assert.equal(streak([p],overrides,'2026-11-06'),1);
});
test('weekly selection, cancellations, overlapping blocks and timezones',()=>{
 assert.equal(dayItems([{...p,repeat:'weekly',weekdays:[1]}],[],'2026-11-03').length,0);
 assert.equal(dayItems([p],[{template_id:'one',date:'2026-11-05',cancelled:true}],'2026-11-05').length,0);
 const other={...p,id:'two',start_min:500,end_min:560};assert.equal(conflicts([p],other).length,1);assert.equal(lanes([p,other])[0].columns,2);
 assert.equal(new Date(instant('2026-11-05',480,'Asia/Tashkent')).toISOString(),'2026-11-05T03:00:00.000Z');
 assert.equal(localParts(Date.parse('2026-11-05T22:00Z'),'Asia/Tashkent').date,'2026-11-06');
 assert.equal(instant('2026-03-29',90,'Europe/London'),null);
});
test('calendar converts Istanbul to Tashkent and preserves source date across midnight',()=>{
 const event={...p,timezone:'Europe/Istanbul',repeat:'once',start_date:'2026-11-05',start_min:1380,end_min:1440};
 const result=calendarItems([event],[],'2026-11-06','Asia/Tashkent');
 assert.equal(result.length,1);assert.equal(result[0].start_min,60);assert.equal(result[0].end_min,120);assert.equal(result[0].source_date,'2026-11-05');
 assert.equal(calendarItems([event],[],'2026-11-05','Asia/Tashkent').length,0);
});
