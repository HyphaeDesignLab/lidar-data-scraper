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

app.get('/blah1', function (req, res) {
    try {

        const name = decodeURIComponent(req.query.name).replace('"', ''); // sensor name
        const type = removeSpaces(req.query.type); // sensor type
        const project = removeSpaces(req.query.project);
        const deveui = req.query.deveui;
        const appeui = req.query.appeui;
        const appkey = req.query.appkey;

        const cmd = `aws iotwireless create-wireless-device \\
  --type LoRaWAN \\
  --name "${name} (type: ${type}, project: ${project})" \\
  --destination-name "${project}__${type}" \\
  --lorawan '{"DeviceProfileId": "bd2f3e79-bbea-47a0-9697-c9414b2d6394","ServiceProfileId": "349d0631-1d39-4438-8487-a43b3919d80c","OtaaV1_0_x": {"AppKey": "${appkey}","AppEui": "${appeui}"},"DevEui": "${deveui}"}'`;

        const outputBuffer = childProcess.execSync(cmd);
        const outputObject = JSON.parse(outputBuffer.toString());
        // convert hash keys to lowercase
        const outputObjectLowercaseKeys = Object.fromEntries(Object.entries(outputObject).map(e => [e[0].toLowerCase(), e[1]]));

        res.send(JSON.stringify(outputObjectLowercaseKeys));
    } catch(error) {
        const output = JSON.stringify({id: 0, error: error.stderr.toString()})
        res.status(500).send(output);
    }
});
app.get('/test/run-in-bg', function (req, res) {

    try {
        const testPath = path.join(__dirname, '..', 'usgs-scraper');

        // to run a file WITHOUT a shell.
        const testPy = childProcess.spawn('python3',
            ['test.py', '--cmd', 'run_in_bg'],
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
app.get('/test/check', function (req, res) {
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

app.get('/usgs', function (req, res) {
    try {
        const cmd = `ls -1 ../usgs-scraper/_downloads/*.json`;

        const outputBuffer = childProcess.execSync(cmd);
        if (!outputBuffer) {
            throw new Error('no USGS folder');
        }
        if (!outputBuffer.toString()) {
            throw new Error('no projects');
        }
        const projectDatasets = outputBuffer.toString().split("\n");
        let out = '';
        projectDatasets.forEach(file => {
            out += file + ";<br/>";
            if (!file.trim()) {
                return;
            }
            if (!fs.existsSync(file.trim())) {
                return;
            }
            let data = fs.readFileSync(file.trim(), 'utf8');
            out += data+"\n<br/>";
        });

        res.send(out);
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