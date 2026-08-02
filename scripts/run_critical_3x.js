const { spawn } = require('child_process');

async function run() {
    for (let i = 1; i <= 3; i++) {
        console.log(`\n\n=================================================`);
        console.log(`      RUNNING CRITICAL GATE ITERATION ${i} / 3     `);
        console.log(`=================================================\n\n`);
        
        await new Promise((resolve, reject) => {
            const child = spawn('node', ['scripts/run_critical.js'], { stdio: 'inherit', shell: true });
            child.on('close', code => {
                if (code !== 0) reject(new Error(`Failed on iteration ${i} with exit code ${code}`));
                else resolve();
            });
        });
    }
    console.log(`\n✅ ALL 3 ITERATIONS OF CRITICAL GATE PASSED SUCCESSFULLY!`);
}

run().catch(e => { 
    console.error(`\n❌ 3X EXECUTION FAILED:`, e.message); 
    process.exit(1); 
});
