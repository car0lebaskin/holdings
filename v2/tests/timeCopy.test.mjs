import test from 'node:test';
import assert from 'node:assert/strict';
import {greetingForHour} from '../src/lib/timeCopy.mjs';
test('uses device-local hour boundaries for time-of-day greetings',()=>{
 assert.equal(greetingForHour(0),'Good morning');
 assert.equal(greetingForHour(11),'Good morning');
 assert.equal(greetingForHour(12),'Good afternoon');
 assert.equal(greetingForHour(13),'Good afternoon');
 assert.equal(greetingForHour(16),'Good afternoon');
 assert.equal(greetingForHour(17),'Good evening');
 assert.equal(greetingForHour(23),'Good evening');
});
