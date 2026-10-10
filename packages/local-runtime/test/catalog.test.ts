import test from'node:test';import assert from'node:assert/strict';import{selectLocalBackend,type LocalHardwareSnapshot}from'../src/index.ts';
const hw=(patch:Partial<LocalHardwareSnapshot>={}):LocalHardwareSnapshot=>({platform:'linux',arch:'x64',cpu:'test',totalRamGb:64,nvidia:[],appleSilicon:false,python:'python3',git:true,ffmpeg:true,ffprobe:true,...patch});
test('selects Wan for 24GB NVIDIA',()=>assert.equal(selectLocalBackend(hw({nvidia:[{name:'RTX 4090',vramGb:24}]})).backend,'wan22-ti2v5b'));
test('selects LTX 13B for 16-23GB NVIDIA',()=>assert.equal(selectLocalBackend(hw({nvidia:[{name:'RTX',vramGb:20}]})).backend,'ltx-13b'));
test('selects LTX 2B for 6-15GB NVIDIA',()=>assert.equal(selectLocalBackend(hw({nvidia:[{name:'RTX',vramGb:8}]})).backend,'ltx-2b'));
test('selects LTX on Apple silicon and deterministic without supported accelerator',()=>{assert.equal(selectLocalBackend(hw({platform:'darwin',arch:'arm64',appleSilicon:true,totalRamGb:16})).backend,'ltx-2b');assert.equal(selectLocalBackend(hw({totalRamGb:8})).backend,'deterministic')});
