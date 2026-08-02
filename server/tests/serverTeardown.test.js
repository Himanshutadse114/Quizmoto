const { expect } = require('chai');
const express = require('express');
const { createServer } = require('http');

describe('Server Teardown & EADDRINUSE Prevention', () => {
    it('should cleanly release the port after server.close() is called', (done) => {
        const app1 = express();
        const server1 = createServer(app1);
        
        server1.listen(0, () => { // Bind to random open port
            const port = server1.address().port;
            
            // Close the server
            server1.close(() => {
                // Now attempt to bind a NEW server to the EXACT same port
                const app2 = express();
                const server2 = createServer(app2);
                
                server2.once('error', (err) => {
                    // If we get EADDRINUSE, teardown failed!
                    done(err);
                });
                
                server2.listen(port, () => {
                    // Success! The port was freed correctly.
                    server2.close(done);
                });
            });
        });
    });
});
