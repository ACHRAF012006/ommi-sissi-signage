import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uuid} from '../public/js/common.js';
test('HTTP LAN origins generate unique UUID v4 even when randomUUID is unavailable',()=>{
 const crypto=globalThis.crypto,original=Object.getOwnPropertyDescriptor(crypto,'randomUUID');
 Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
 try{const values=new Set(Array.from({length:100},uuid));assert.equal(values.size,100);for(const value of values)assert.match(value,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);}finally{if(original)Object.defineProperty(crypto,'randomUUID',original);else delete crypto.randomUUID;}
});
