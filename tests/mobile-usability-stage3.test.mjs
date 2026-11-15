import test from 'node:test';
import assert from 'node:assert/strict';
import '../mobile-usability-stage3.js';

const {keyboardOpen}=globalThis.FFSMobileUsabilityStage3;
test('U06 keyboard detection tolerates browser chrome and missing VisualViewport',()=>{
  assert.equal(keyboardOpen(844,undefined),false);
  assert.equal(keyboardOpen(844,844),false);
  assert.equal(keyboardOpen(844,750),false,'browser toolbar changes do not release the sticky footer');
  assert.equal(keyboardOpen(844,510),true,'a keyboard-sized viewport reduction releases the footer');
  assert.equal(keyboardOpen(844,844),false,'closing the keyboard restores compact sticky navigation');
});
