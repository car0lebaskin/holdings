import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSettlement, exportSummary} from '../src/lib/settlement.mjs';
const seats=[{id:'a',display_name_snapshot:'Alex'},{id:'b',display_name_snapshot:'Blair'},{id:'c',display_name_snapshot:'Casey'}];
const row=(seat_id,kind,amount_cents,voided=false)=>({seat_id,kind,amount_cents,voided});
test('balanced three-player table yields exact transfers and P&L',()=>{
 const tx=[row('a','buyin',10000),row('b','buyin',10000),row('c','buyin',10000),row('a','cashout',15000),row('b','cashout',0),row('c','cashout',15000)];
 const r=calculateSettlement(seats,tx);
 assert.equal(r.ready,true);assert.equal(r.discrepancy,0);
 assert.deepEqual(r.transfers,[{from:'Blair',to:'Alex',amount:5000},{from:'Blair',to:'Casey',amount:5000}]);
 const str=exportSummary({title:'Friday',currency:'RM',started_at:'2026-01-01T00:00:00Z',status:'closed',stakes:'1/2'},r);
 assert.ok(str.includes('Blair pays Alex: RM 50.00'));assert.ok(str.includes('Alex: +RM 50.00'));
});
test('does not unlock when someone has chips and no cash-out',()=>{
 const r=calculateSettlement(seats,[row('a','buyin',10000),row('b','buyin',10000),row('a','cashout',20000)]);
 assert.equal(r.allOut,false);assert.equal(r.ready,false);assert.equal(r.transfers.length,0);
});
test('unbalanced bank is flagged, not marked ready',()=>{
 const r=calculateSettlement(seats.slice(0,2),[row('a','buyin',10000),row('b','buyin',10000),row('a','cashout',15000),row('b','cashout',2000)]);
 assert.equal(r.allOut,true);assert.equal(r.discrepancy,-3000);assert.equal(r.ready,false);
});
test('voided transactions are not counted and busted players count as cashed out',()=>{
 const r=calculateSettlement(seats.slice(0,2),[row('a','buyin',10000),row('b','buyin',10000),row('b','buyin',5000,true),row('a','cashout',20000),row('b','cashout',0)]);
 assert.equal(r.ready,true);assert.equal(r.totalBuyin,20000);
 assert.deepEqual(r.transfers,[{from:'Blair',to:'Alex',amount:10000}]);
});
