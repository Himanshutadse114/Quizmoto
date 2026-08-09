const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM player exit persistence', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/scorm/play.js'), 'utf8');

    it('flushes iframe state before committing and finishing the LMS runtime', () => {
        const start = source.indexOf("'function persistAndFinish(){\\n' +");
        expect(start).to.be.greaterThan(-1);
        const end = source.indexOf("'function closePlayer(){\\n' +", start);
        expect(end).to.be.greaterThan(start);
        const block = source.slice(start, end);

        const flush = block.indexOf("'  flushFrameState();\\n' +");
        const commit = block.indexOf('window.API.LMSCommit');
        const finish = block.indexOf('window.API.LMSFinish');

        expect(flush).to.be.greaterThan(-1);
        expect(commit).to.be.greaterThan(flush);
        expect(finish).to.be.greaterThan(commit);
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
