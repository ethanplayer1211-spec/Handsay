/** Verify shipped inputs against the pinned upstream Git tree. No network or
 * private recordings are read. Source-selection reasoning is recorded beside
 * the report; this check is not an independent training reproduction.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const commit='ffc0578e68449676b6e9545da82092679914e8c8';
const files=[
 ['public/models/model.onnx','web/public/models/model.onnx','4cdac8c0feabfebe651f5d59dfd5ea65a9ea9934',false],
 ['public/replay/clips.json','web/public/replay/clips.json','b6c1bb1c9b713e87987d7fecf02c4687550a6511',true],
 ['public/models/model-meta.json','web/public/models/model-meta.json','59f3ce319e2fccb81ef5b1c3996efce92c3bb722',true],
];
const rows=files.map(([local,upstream,expected,text])=>{
 const original=readFileSync(local),bytes=text?Buffer.from(original.toString('utf8').replace(/[\r\n]+$/,'')+'\n'):original;
 const actual=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 assert.equal(actual,expected,`Upstream content mismatch: ${local}`);
 return {local,upstream,gitBlob:actual,expectedGitBlob:expected,matched:true,normalization:text?'Single final LF; all other bytes unchanged':'None',source:`https://github.com/shashank11yadav/GestureSign/blob/${commit}/${upstream}`};
});
const meta=JSON.parse(readFileSync('public/models/model-meta.json','utf8'));
assert.deepEqual(meta.trainedOn.heldOutParticipants,[16069,37055,61333]);
const replay=JSON.parse(readFileSync('public/replay/clips.json','utf8'));
assert.equal(replay.clips.length,6);
assert.ok(replay.clips.every(c=>c.note.includes('Held-out signer')));
const report={checkedAt:new Date().toISOString(),passed:true,commit,files:rows,testParticipants:meta.trainedOn.heldOutParticipants,
 sourceCodeEvidence:[
  {path:'pipeline/configs/default.toml',lines:'19-24',gitBlob:'603dc3aef8f3e48f4126623e348a3b513a18ccb0',finding:'The configured test participants are 16069, 37055 and 61333.'},
  {path:'pipeline/src/gesturesign/prepare.py',lines:'238-245',gitBlob:'c1984fc4f92db2e5ac49a5cd394bc48994ed566e',finding:'Training excludes both test and validation participant masks.'},
  {path:'pipeline/src/gesturesign/replay.py',lines:'95-134',gitBlob:'2940adcb1301a0657a3d9c0fdd8b63f509f8bfd8',finding:'Real replay candidates are restricted to test participants before six examples are selected.'},
 ],
 conclusion:'The six bundled clips have verified upstream held-out-signer provenance for the shipped base model, based on pinned exporter/split code and matching shipped artefacts.',
 limitations:['Six author-selected clips; not a representative sample.','The upstream training run and original Kaggle archive were not independently reproduced.','These clips have been used during Handsay development, so they are regression examples, not an untouched test of the app filters.','No fluent live signer, general non-sign false-alarm or demographic validation.'],
};
mkdirSync('docs/evaluation',{recursive:true});writeFileSync('docs/evaluation/data-provenance.json',JSON.stringify(report,null,2)+'\n');
console.log('Matched pinned model, replay and metadata; checked upstream held-out signer export chain.');
