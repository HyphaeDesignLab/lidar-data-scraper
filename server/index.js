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

app.get('/sources', function (req, res) {
    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(text);
});
app.get('/sources/:id', function (req, res) {
    res.setHeader("Content-Type", "application/json");

    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    const sources = JSON.parse(text);
    const id = req.params.id;
    if (!id) {
        res.status(500).send({error: `no project id`});
        return;
    }
    if (!sources[id]) {
        res.status(500).send({error: `no such project: ${req.params.id}`});
        return;
    }
    const projects = childProcess.execSync(`cd ../${sources[id].dir}/ && python3 scrape.py --cmd=projects_list_get --options=json_only | cat`)
    if (!projects) {
        res.status(500).send({error: `project ${req.params.id} has no index`});
        return;
    }

    res.status(200).send(projects);
});
app.get('/sources/:id/scrape', function (req, res) {
    res.setHeader("Content-Type", "application/json");

    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    const sources = JSON.parse(text);
    const id = req.params.id;
    if (!id) {
        res.status(500).send({error: `no project id`});
        return;
    }
    if (!sources[id]) {
        res.status(500).send({error: `no such project: ${req.params.id}`});
        return;
    }
    const projects = childProcess.execSync(`cd ../${sources[id].dir}/ && python3 scrape.py --cmd=projects_list_scrape --options=json_only | cat`)
    if (!projects) {
        res.status(500).send({error: `project ${req.params.id} has no index`});
        return;
    }

    res.status(200).send(projects);
});
app.get('/sources/:id/:project_id/scrape', function (req, res) {
    res.setHeader("Content-Type", "application/json");

    const text = fs.readFileSync(path.join(__dirname, '..', 'sources.json'));
    const sources = JSON.parse(text);
    const id = req.params.id;
    const projectId = req.params.project_id;
    if (!id || !projectId) {
        res.status(500).send({error: `no project id`});
        return;
    }
    if (!sources[id]) {
        res.status(500).send({error: `no such project: ${req.params.id}`});
        return;
    }
    const projects = childProcess.execSync(`cd ../${sources[id].dir}/ && python3 scrape.py --cmd=project_metadata_index_scrape --project_id='${projectId}' --options=json_only | cat`)
    if (!projects) {
        res.status(500).send({error: `project ${req.params.id} has no index`});
        return;
    }

    res.status(200).send(projects);
});

app.get('/usgs/scrape', function (req, res) {
    /*
    projects_list_get
    downloads_dir_get
    downloads_dir_list
    metadata_index_get
    metadata_files_fetch
    metadata_file_fetch
    metadata_extract_data
    city_polygon_get
    polygon_multipolygon_overlap_check
    find_overlapping_lidar_scans
    laz_file_fetch
    laz_extract_data
    laz_and_meta_extract_data
    */
    const cmd = req.query.cmd.replace(/\W/g, '');

    try {
        const testPath = path.join(__dirname, '..', 'usgs-scraper');

        // to run a file WITHOUT a shell.
        const testPy = childProcess.spawn('python3',
            ['test.py', '--cmd', cmd],
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

        const out = childProcess.execSync('ps aux | grep -i test.py | grep -v grep | cat')
        res.send(`running in bg:  ${out}`);
    } catch(error) {
        const output = JSON.stringify({id: 0, error: error.message})
        res.status(500).send(output);
    }
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

app.get('/', function (req, res) {
    res.send('ok');
});


if (env.env === 'prod') {
    const key = fs.readFileSync(env.ssl_key);
    const cert = fs.readFileSync(env.ssl_cert);
    const ca = fs.readFileSync(env.ssl_chain);
    const https = require('https');
    let server = https.createServer({key: key, cert: cert, ca }, app);
    server.listen(3001);
} else {
    app.listen(3001);
}