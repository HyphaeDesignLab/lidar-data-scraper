const fs = require('fs');
const path = require('path')

// start running server by passing the ENV file (usually .env in same folder) that contains all environment variables
let env = {};
if (process.argv[2]) {
    const envFileContents = fs.readFileSync(process.argv[2]);
    if (envFileContents) {
        env = JSON.parse(envFileContents);
    }
}

var express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!!env.cors_urls) {
    const cors = require("cors")({origin: env.cors_urls.split('|')});
    app.use(cors);
}

const childProcess = require("child_process");
const removeSpaces = s => s.replace(/[^\w]/, '_').replace(/__+/, '_').replace(/^_+|_+$/, '');

const checkSourceIdAndDir = id => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    const sources = JSON.parse(text);
    if (!id) {
        throw new Error('no source id')
    }
    if (!sources[id]) {
        throw new Error(`no such source: ${id}`)
    }
    return [id, sources[id].dir];
}
const checkCmd = (cmd, allowed) => {
    const cmdSanitized = cmd.replace(/\W/g, '');
    if (cmd !== cmdSanitized) {
        throw new Error(`command can only contain letters and _: ${cmd}`);
    }
    if (!allowed.find(i => i === cmdSanitized)) {
        throw new Error(`${cmd} is not recognized` );
    }
    return cmdSanitized;
}
const checkProjectId = id => {
    if (!id) {
        throw new Error('no project id')
    }
    const sanitizedId = id.replace(/[^\w\-]+/g, '');
    if (id !== sanitizedId) {
        throw new Error(`id can only contain letters, _ and -: ${id}`)
    }
    return sanitizedId;
}
app.get('/sources', function (req, res) {
    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(text);
});
app.get('/source/:id/:cmd', function (req, res) {
    res.setHeader("Content-Type", "application/json");

    let sourceId, sourceDir, cmd;
    try {
        cmd = checkCmd(req.params.cmd, ['get', 'scrape']);
        [sourceId, sourceDir] = checkSourceIdAndDir(req.params.id);
    } catch(e) {
        res.status(500).send({error: e.message});
        return;
    }

    const output = childProcess.execSync(`cd ../${sourceDir}/ && python3 scrape.py --cmd=projects_${cmd} --options=json_only | cat`)
    if (!output) {
        res.status(500).send({error: `${sourceId} ${cmd} failed`});
        return;
    }

    res.status(200).send(output);
});
app.get('/source/:id/:project_id/:cmd', function (req, res) {
    res.setHeader("Content-Type", "application/json");

    let sourceId, sourceDir, projectId, cmd;
    try {
        cmd = checkCmd(req.params.cmd, ['get', 'scrape']);
        [sourceId, sourceDir] = checkSourceIdAndDir(req.params.id);
        projectId = checkProjectId(req.params.project_id);
    } catch(e) {
        res.status(500).send({error: e.message});
        return;
    }

    const output = childProcess.execSync(`cd ../${sourceDir}/ && python3 scrape.py --cmd=project_${cmd} --project_id='${projectId}' --options=json_only | cat`)
    if (!output) {
        res.status(500).send({error: `${sourceId} ${projectId} ${cmd} failed`});
        return;
    }

    res.status(200).send(output);
});
app.get('/source/:id/:project_id/:subproject_id/:cmd', function (req, res) {
    res.setHeader("Content-Type", "application/json");

    let sourceId, sourceDir, projectId, subprojectId, cmd;
    try {
        cmd = checkCmd(req.params.cmd, ['get', 'scrape', 'meta_scrape', 'meta_scrape_check']);
        [sourceId, sourceDir] = checkSourceIdAndDir(req.params.id);
        projectId = checkProjectId(req.params.project_id);
        subprojectId = checkProjectId(req.params.subproject_id);
    } catch(e) {
        res.status(500).send({error: e.message});
        return;
    }

    let output = '';
    if (cmd === 'meta_scrape') {
        let activeScrapeProcess = childProcess.execSync('ps aux | grep -i scrape.py | grep metadata_files_fetch | grep -v grep | cat');
        if (!activeScrapeProcess.toString()) {
            const scrapeMetaProcess = childProcess.spawn('python3',
                ['scrape.py',
                    '--cmd', 'metadata_files_fetch',
                    '--project_id', projectId,
                    '--subproject_id', subprojectId,
                ],
                {'cwd': `../${sourceDir}/`});
            scrapeMetaProcess.stderr.on('data', data => {
                console.log('scrapeMetaProcess error: ' + data);
            });
            scrapeMetaProcess.stdout.on('data', data => {
                console.log('scrapeMetaProcess: ' + data);
            });
            scrapeMetaProcess.on('close', code => {
                console.log('scrapeMetaProcess done: ' + code);
            });
        }
        activeScrapeProcess = childProcess.execSync('ps aux | grep -i scrape.py | grep metadata_files_fetch | grep -v grep | cat')

        output = { is_running: !!activeScrapeProcess.toString(), message: !!activeScrapeProcess.toString() ? 'started, running' : 'failed to start, not running'};
    } else if (cmd === 'meta_scrape_check') {
        let activeScrapeProcess = childProcess.execSync('ps aux | grep -i scrape.py | grep metadata_files_fetch | grep -v grep | cat');
        let project = childProcess.execSync(`cd ../${sourceDir}/ && python3 scrape.py --cmd=project_get --project_id='${projectId}' --subproject_id='${subprojectId}' --options=json_only | cat`).toString();
        output = { is_running: !!activeScrapeProcess.toString(), message: !!activeScrapeProcess.toString() ? 'running' : 'not running', project: JSON.parse(project)};
    } else {
        output = childProcess.execSync(`cd ../${sourceDir}/ && python3 scrape.py --cmd=project_${cmd} --project_id='${projectId}' --subproject_id='${subprojectId}' --options=json_only | cat`)
        if (!output) {
            res.status(500).send({error: `${sourceId} ${projectId}/${subprojectId} ${cmd} failed`});
            return;
        }
    }

    res.status(200).send(output);
});

app.get('/scrape/check', function (req, res) {
    try {
        const testPath = path.join(__dirname, '..', 'usgs-scraper', 'run_in_bg.txt');
        const out = childProcess.execSync('ps aux | grep -i test.py | grep -v grep | cat');
        res.setHeader("Content-Type", "text/plain");
        // res.setHeader("Content-Type", "application/json");
        res.send(String(out) + "\n\n"+ fs.readFileSync(testPath).toString().split("\n").length + ' lines output so far');
    } catch(error) {
        const output = JSON.stringify({id: 0, error: error.message})
        res.status(500).send(output);
    }
});

app.get('/test/run-in-bg', function (req, res) {

    try {
        const testPath = path.join(__dirname, '..', 'usgs-scraper', 'tests');

        // to run a file WITHOUT a shell.
        const testPy = childProcess.spawn('python3',
            ['run-in-bg.py', '--cmd', 'background'],
            {'cwd': testPath});
        testPy.stderr.on('data', data => {
            console.log('test py error '+data);
        });
        testPy.stdout.on('data', data => {
            console.log('test py out '+ data);
        });
        testPy.on('close', code => {
            console.log('test py exited with '+code);
        });

        const out = childProcess.execSync('ps aux | grep -i run-in-bg.py | grep -v grep | cat')
        res.send(`running in bg:  ${out}`);
    } catch(error) {
        const output = JSON.stringify({id: 0, error: error.message})
        res.status(500).send(output);
    }
});
app.get('/test/check', function (req, res) {
    try {
        const testPath = path.join(__dirname, '..', 'usgs-scraper', 'tests', 'run-in-bg.txt');
        const out = childProcess.execSync('ps aux | grep -i run-in-bg.py | grep -v grep | cat');
        res.setHeader("Content-Type", "text/plain");
        // res.setHeader("Content-Type", "application/json");
        res.send(String(out) + "\n\n"+ fs.readFileSync(testPath).toString().split("\n").length + ' lines output so far');
    } catch(error) {
        const output = JSON.stringify({id: 0, error: error.message})
        res.status(500).send(output);
    }
});

const staticPublicPath = path.join(__dirname, 'public');
//express.static.mime.define({'text/javascript': ['md']});
app.use(express.static(staticPublicPath));
app.use('/usgs/map', express.static(path.join(__dirname, '..', 'usgs-scraper', 'client')));
app.use('/usgs/map/projects', express.static(path.join(__dirname, '..', 'usgs-scraper', 'projects')));


app.get('/', function (req, res) {
    res.send('ok');
});


if (env.env === 'prod') {
    const key = fs.readFileSync(env.ssl_key);
    const cert = fs.readFileSync(env.ssl_cert);
    const ca = fs.readFileSync(env.ssl_chain);
    const https = require('https');
    let server = https.createServer({key: key, cert: cert, ca }, app);
    console.log(`serving apps/files on httpS://localhost:${port}`)
    server.listen(env.port);
} else {
    console.log(`serving apps/files on http://localhost:${port}`)
    app.listen(env.port);
}