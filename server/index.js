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
app.get('/sources', function app_sources(req, res) {
    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(text);
});
app.get('/source/:id/:cmd', function app_sourceCmd(req, res) {
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
app.get('/source/:id/:project_id/:cmd', function app_sourceProjectCmd(req, res) {
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
app.get('/source/:id/:project_id/:subproject_id/:cmd', function app_sourceProjectSubprojectCmd(req, res) {
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

app.get('/scrape/check', function app_scrapeCheck (req, res) {
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

app.get('/test/run-in-bg', function app_testRunInBg(req, res) {

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
app.get('/test/check', function app_testCheck(req, res) {
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

app.get('/usgs/map/test-add-laz-dates-form', function app_testMapTileEdit(req, res) {
    const sampleNewLazDates = {"project/subproject": {"{u}_{prj}_tileId":{"date_start":123123123, "date_end": 123123123}}};
    const html = `<form method="post" action="/usgs/map/add-laz-dates"><input name=secret value="${env.secret}"/><textarea name=json>${JSON.stringify(sampleNewLazDates)}</textarea><input type="submit" /></form>`;
    res.status(200).send(html);
});

/* LAZ dates save to map_tile
  this endpoint is called by a python script ran to extract tile dates from LAZ file directly
  - save the new map_tiles.json
  - save new dates to LAZ.TXT file if XML and LAZ dates differ
  - keep old dates XML.TXT intact, because other scripts will overwrite
*/
app.post('/usgs/map/add-laz-dates', function app_mapTileEdit(req, res) {
    const usgsProjectsPath = path.join(__dirname, '..', 'usgs-scraper', 'projects');

    if (!req.body.secret || req.body.secret !== env.secret) {
        res.status(500).send('n/s');
        return;
    }
    if (!req.body.json) {
        res.status(500).send('project or tile json missing');
        return;
    }

    let newLazDates;
    try {
        newLazDates = JSON.parse(req.body.json);
        let errorMessage;
        if (!(newLazDates instanceof Object)) {
            errorMessage = 'new laz dates must be a hash of project IDs to new dates';
        }
        if (errorMessage) {
            res.status(500).send(errorMessage);
            return;
        }
    } catch(e) {
        res.status(500).send({error: 'cannot parse the tile json:' + e.message});
        return;
    }

    let hasErrors = false;
    Object.keys(newLazDates).forEach(project => {
        // write tile-specific dates to *.laz.txt files (from which the map_tiles.json file is compiled)
        //   IF they are different from the .xml.txt file
        // keep *.xml.txt intact as other scripts will overwrite
        const projectPieces = project.split('/');
        Object.keys(newLazDates[project]).forEach((tileId,i) => {
            if (!newLazDates[project][tileId].date_start || !newLazDates[project][tileId].date_end) {
                newLazDates[project][tileId].errors = ` date start (${newLazDates[project][tileId].date_start} or end (${newLazDates[project][tileId].date_end} missing`;
                hasErrors = true;
                return;
            }

            let lazTxtFilePath = `${usgsProjectsPath}/${project}/laz/${tileId}.laz.txt`;
            lazTxtFilePath = lazTxtFilePath.replace('{u}', 'USGS_LPC_').replace('{prj}', projectPieces[0]);
            if (projectPieces[1]) {
                lazTxtFilePath = lazTxtFilePath.replace('{sprj}', projectPieces[1]);
            }

            try {
                let lazTxtContents = `date_start:${newLazDates[project][tileId].date_start}\ndate_end:${newLazDates[project][tileId].date_end}`;
                fs.writeFileSync(lazTxtFilePath, lazTxtContents);
            } catch (e) {
                hasErrors = true;
                newLazDates[project][tileId].errors = ` error saving dates to file: ${e.message}`;
            }
        });
    })

    if (hasErrors) {
        res.status(500).send({error: true, body: newLazDates});
    }

    res.status(200).send('ok');
});

//express.static.mime.define({'text/javascript': ['md']});
app.use('/apps', express.static(path.join(__dirname, 'public')));
app.use('/usgs/map', express.static(path.join(__dirname, '..', 'usgs-scraper', 'client')));
app.use('/usgs/map/projects', express.static(path.join(__dirname, '..', 'usgs-scraper', 'projects')));


app.get('/', function app_defaultOk(req, res) {
    res.send('ok');
});


if (env.env === 'prod') {
    const key = fs.readFileSync(env.ssl_key);
    const cert = fs.readFileSync(env.ssl_cert);
    const ca = fs.readFileSync(env.ssl_chain);
    const https = require('https');
    let server = https.createServer({key: key, cert: cert, ca }, app);
    console.log(`serving apps/files on httpS://localhost:${env.port}`)
    server.listen(env.port);
} else {
    console.log(`serving apps/files on http://localhost:${env.port}`)
    app.listen(env.port);
}