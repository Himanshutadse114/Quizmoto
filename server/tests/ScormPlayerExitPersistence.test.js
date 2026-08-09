const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM player local-first persistence', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/scorm/play.js'), 'utf8');

    it('does not depend on the legacy per-call runtime endpoints', () => {
        expect(source).to.not.include('/api/scorm/runtime/');
        expect(source).to.not.include('RUNTIME+"/initialize"');
        expect(source).to.not.include('RUNTIME+"/commit"');
        expect(source).to.not.include('xhr.open(method,path,false)');
        expect(source).to.include("const sessionEndpoint = '/api/scorm/session/' + reg.id");
    });

    it('keeps SCORM Get/Set/Initialize/Commit synchronous and in memory', () => {
        expect(source).to.include('localValues=Object.create(null)');
        expect(source).to.include('LMSInitialize:function(){');
        expect(source).to.include('localValues[key]=v==null?"":String(v)');
        expect(source).to.include('Object.prototype.hasOwnProperty.call(localValues,key)');
        expect(source).to.include('LMSCommit:function(){if(initialized){dirty=true;revision++;persist("commit",false);}');
    });

    it('loads saved attempt state before loading SCORM content', () => {
        expect(source).to.include('src="about:blank"');
        expect(source).to.include('function loadSavedState()');
        expect(source).to.include('.finally(loadContent)');
        expect(source).to.include('frame.src=BOOT.contentSrc');
        expect(source).to.include('installDefaults(!!(d&&d.resume))');
    });

    it('persists a full state document asynchronously', () => {
        expect(source).to.include('clientVersion:2,values:localValues');
        expect(source).to.include('fetch(SESSION,{method:"POST"');
        expect(source).to.include('scheduleSave(900,"autosave")');
        expect(source).to.include('setInterval(function(){if(dirty&&!saveInFlight)persist("heartbeat",false);},5000)');
    });

    it('uses lifecycle-safe persistence without blocking navigation', () => {
        expect(source).to.include('navigator.sendBeacon');
        expect(source).to.include('keepalive:body.length<60000');
        expect(source).to.include('document.addEventListener("visibilitychange"');
        expect(source).to.include('window.addEventListener("pagehide"');
    });

    it('notifies the opener after successful persistence', () => {
        expect(source).to.include('notifyOpener("quizmoto-scorm-progress",d&&d.summary?d.summary:null)');
        expect(source).to.include('registrationId:BOOT.registrationId');
    });

    it('flushes authored iframe state before finishing the local LMS API', () => {
        const start = source.indexOf('function persistAndFinish(){');
        expect(start).to.be.greaterThan(-1);
        const end = source.indexOf('function notifyParentExit()', start);
        expect(end).to.be.greaterThan(start);
        const block = source.slice(start, end);
        expect(block.indexOf('flushFrameState()')).to.be.greaterThan(-1);
        expect(block.indexOf('window.API.LMSFinish')).to.be.greaterThan(block.indexOf('flushFrameState()'));
    });
});
