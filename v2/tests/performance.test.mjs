import test from 'node:test';
import assert from 'node:assert/strict';
import {playerPerformance} from '../src/lib/performance.mjs';
const nights=[
 {game:{id:'old',title:'Old',started_at:'2026-07-01T12:00:00Z'},items:[{key:'a',net:10000,buyin:10000}]},
 {game:{id:'one',title:'Friday',started_at:'2026-11-05T12:00:00Z'},items:[{key:'a',net:-2000,buyin:10000}]},
 {game:{id:'two',title:'Saturday',started_at:'2026-11-20T12:00:00Z'},items:[{key:'a',net:5000,buyin:10000},{key:'b',net:-5000,buyin:10000}]}
];
test('cumulative player graph includes zero baseline and exact P&L',()=>{
 const result=playerPerformance(nights,'a','all',new Date('2026-11-22T10:00:00Z'));
 assert.deepEqual(result.values,[0,10000,8000,13000]);
 assert.equal(result.net,13000);assert.equal(result.wins,2);assert.equal(result.losses,1);
 assert.equal(result.average,4333);assert.equal(result.games,3);
});
test('period filtering excludes older games without altering historical records',()=>{
 const result=playerPerformance(nights,'a','30d',new Date('2026-11-22T10:00:00Z'));
 assert.equal(result.net,3000);assert.equal(result.games,2);
 assert.deepEqual(result.values,[0,-2000,3000]);
 assert.equal(result.winRate,.5);
});
test('player with no completed games returns an empty, non-misleading result',()=>{
 const result=playerPerformance(nights,'unknown','90d',new Date('2026-11-22T10:00:00Z'));
 assert.equal(result.net,0);assert.equal(result.games,0);assert.deepEqual(result.values,[0]);
});
