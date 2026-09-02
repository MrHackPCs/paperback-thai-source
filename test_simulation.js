const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function testSource(sourceId) {
    console.log(`\n🧪 Testing ${sourceId} in sandboxed Node.js vm...`);
    const bundlePath = path.join(__dirname, 'public', sourceId, 'source.js');
    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found at ${bundlePath}`);
    }

    const bundleCode = fs.readFileSync(bundlePath, 'utf8');

    // Create Paperback mock environment
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        App: {
            createRequestManager: (opts) => ({
                schedule: async (req) => {
                    console.log(`    [Mock Request] ${req.method || 'GET'} ${req.url}`);
                    return { data: '<html><body>Mock HTML</body></html>', status: 200 };
                }
            }),
            createRequest: (opts) => opts,
            createSourceManga: (opts) => opts,
            createMangaInfo: (opts) => opts,
            createMangaTile: (opts) => opts,
            createIconText: (opts) => opts,
            createChapter: (opts) => opts,
            createChapterDetails: (opts) => opts,
            createTagSection: (opts) => opts,
            createTag: (opts) => opts,
            createHomeSection: (opts) => opts,
            createPagedResults: (opts) => opts
        },
        _Sources: {},
        Sources: {}
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(bundleCode, context);

    const SourceClass = sandbox._Sources?.[sourceId] || sandbox.Sources?.[sourceId] || sandbox[sourceId];
    const SourceInfo = sandbox._Sources?.[`${sourceId}Info`] || sandbox.Sources?.[`${sourceId}Info`] || sandbox[`${sourceId}Info`];

    if (!SourceClass) {
        throw new Error(`Source class ${sourceId} not found on Sources object! Available: ${Object.keys(sandbox._Sources || {})}`);
    }
    if (!SourceInfo) {
        throw new Error(`SourceInfo ${sourceId}Info not found!`);
    }

    console.log(`  ✔ Source Info: ${SourceInfo.name} v${SourceInfo.version}`);

    // Instantiate source
    const instance = new SourceClass(sandbox.cheerio);
    console.log(`  ✔ Successfully instantiated ${sourceId}`);

    // Verify required methods exist
    const requiredMethods = [
        'getMangaDetails',
        'getChapters',
        'getChapterDetails',
        'getHomePageSections',
        'getViewMoreItems',
        'getSearchResults',
        'getCloudflareBypassRequest',
        'getCloudflareBypassRequestAsync'
    ];

    for (const method of requiredMethods) {
        if (typeof instance[method] !== 'function') {
            throw new Error(`Missing required method: ${method}`);
        }
        console.log(`    - Method verified: ${method}`);
    }

    // Verify bypass request
    const bypassReq = instance.getCloudflareBypassRequest();
    if (!bypassReq || !bypassReq.url) {
        throw new Error(`Invalid Cloudflare bypass request: ${JSON.stringify(bypassReq)}`);
    }
    console.log(`  ✔ Cloudflare bypass URL: ${bypassReq.url}`);

    console.log(`✅ ${sourceId} passed all simulation checks!`);
}

async function runAll() {
    const sources = ['SnapManga', 'FlashManga', 'MangaKimi', 'NekoPost', 'ChibiManga'];
    for (const s of sources) {
        await testSource(s);
    }
    console.log('\n🎉 ALL 5 SOURCES PASSED SANDBOX SIMULATION TEST!');
}

runAll().catch(err => {
    console.error('❌ Simulation Test Failed:', err);
    process.exit(1);
});
