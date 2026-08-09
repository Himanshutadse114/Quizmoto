const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM player exit persistence', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/scorm/play.js'), 'utf8');

    it('buffers SetValue calls for authored and uploaded packages and schedules background autosave', () => {
        expect(source).to.include('bufferedWrites: true');
        expect(source).to.include('pendingValues=Object.create(null),localValues=Object.create(null)');
        expect(source).to.include('pendingValues[key]=value;localValues[key]=value');
        expect(source).to.include('scheduleAutosave()');
        expect(source).to.include('fetch(RUNTIME+"/commit"');
    });

    it('makes buffered LMSCommit non-blocking while keeping explicit final flush synchronous', () => {
        expect(source).to.include('LMSCommit:function(p){if(BUFFERED){scheduleAutosave(0);lastError.code=0;return "true";}');
        expect(source).to.include('LMSFinish:function(p){var d=BUFFERED?flushBuffered(RUNTIME+"/finish")');
        expect(source).to.include('syncCall("POST",path,{values:values})');
    });

    it('keeps locally written values visible to LMSGetValue before autosave completes', () => {
        expect(source).to.include('Object.prototype.hasOwnProperty.call(localValues,el)');
        expect(source).to.include('return String(localValues[el])');
    });

    it('notifies the admin opener after successful background or final persistence', () => {
        expect(source).to.include('notifyOpener("quizmoto-scorm-progress",d.summary||null)');
        expect(source).to.include('registrationId:');
    });

    it('flushes iframe state before finishing the LMS runtime', () => {
        const start = source.indexOf("'function persistAndFinish(){\\n' +");
        expect(start).to.be.greaterThan(-1);
        const end = source.indexOf("'function closePlayer(){\\n' +", start);
        expect(end).to.be.greaterThan(start);
        const block = source.slice(start, end);

        const flush = block.indexOf('flushFrameState()');
        const finish = block.indexOf('window.API.LMSFinish');
        expect(flush).to.be.greaterThan(-1);
        expect(finish).to.be.greaterThan(flush);
    });

    it('does not add a redundant parent commit after the explicit Quizmoto flush', () => {
        expect(source).to.include('if(flushMode!=="explicit"){try{window.API.LMSCommit("");}catch(e){}}');
    });

    it('uses the same persistence path for the Exit button and browser close', () => {
        expect(source).to.include('document.getElementById("btnExit").onclick=function(){persistAndFinish();closePlayer();};');
        expect(source).to.include('window.addEventListener("beforeunload",function(){persistAndFinish();});');
    });

    it('supports both the explicit Quizmoto flush hook and existing-package unload fallback', () => {
        expect(source).to.include('typeof w.__quizmotoFlushScormState==="function"');
        expect(source).to.include('w.__quizmotoFlushScormState(true)');
        expect(source).to.include('new w.Event("beforeunload")');
        expect(source).to.include('w.dispatchEvent(ev)');
    });
});
