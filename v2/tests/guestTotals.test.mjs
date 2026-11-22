import test from 'node:test';
import assert from 'node:assert/strict';
import {guestPlayerTotals} from '../src/lib/guestTotals.mjs';
const snapshot={players:[{seat_id:'a',name:'Alex'},{seat_id:'b',name:'Blair'}],transactions:[
 {id:'1',seat_id:'a',kind:'buyin',amount_cents:10000,created_at:'2026-11-22T01:00:00Z',voided:false},
 {id:'2',seat_id:'a',kind:'buyin',amount_cents:10000,created_at:'2026-11-22T02:00:00Z',voided:false},
 {id:'3',seat_id:'a',kind:'buyin',amount_cents:20000,created_at:'2026-11-22T03:00:00Z',voided:true},
 {id:'4',seat_id:'b',kind:'buyin',amount_cents:50000,created_at:'2026-11-22T04:00:00Z',voided:false},
 {id:'5',seat_id:'a',kind:'cashout',amount_cents:25000,created_at:'2026-11-22T05:00:00Z',voided:false}
]};
test('guest total excludes other players and voided buy-ins',()=>{
 const a=guestPlayerTotals(snapshot,'a');
 assert.equal(a.totalBuyin,20000);assert.equal(a.buyinCount,2);
 assert.equal(a.totalCashout,25000);assert.equal(a.net,5000);
 assert.equal(a.entries[0].kind,'cashout');
});
test('guest with no payout has no final net',()=>{
 const b=guestPlayerTotals(snapshot,'b');
 assert.equal(b.totalBuyin,50000);assert.equal(b.net,null);
 assert.equal(b.buyinCount,1);
});
test('unknown player cannot inherit a previous player total',()=>{
 assert.equal(guestPlayerTotals(snapshot,'nonexistent'),null);
});
