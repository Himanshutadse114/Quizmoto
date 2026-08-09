const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM player exit persistence', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/scorm/play.js'), 'utf8');

    it('buffers Quizmoto-authored SetValue calls instead of making synchronous network writes', () => {
        expect(source).to.include("bufferedWrites: pkg.source === 'ai_author'");
        expect(source).to.include('pendingValues=Object.create(null)');
        expect(source).to.include('pendingValues[String(el||"")]=v==null?"":String(v)');
        expect(source).to.include('BUFFERED?flushBuffered(RUNTIME+"/commit")');
        expect(source).to.include('syncCall("POST",path,{values:values})');
    });

    it('keeps pending local values visible to LMSGetValue before a commit', () => {
        expect(source).to.include('Object.prototype.hasOwnProperty.call(pendingValues,el)');
        expect(source).to.include('return String(pendingValues[el])');
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
