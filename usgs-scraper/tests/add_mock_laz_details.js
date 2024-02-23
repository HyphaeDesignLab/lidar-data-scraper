const fs = require('fs');
const childProcess = require("child_process");

const files = childProcess.execSync('find ../projects/ -name \'map_tiles.json\'').toString();
files.split('\n').forEach(file => {
    if (!file) {
        return;
    }
    if (file.match(/projects\/+map_tiles.json/)) {
        return;
    }
    const json = fs.readFileSync(file).toString();
    const obj = JSON.parse(json);
    if (obj.features && obj.features.length) obj.features.forEach(f => {
        f.properties.leaves = (['on', 'off', 'mixed'])[Math.floor(Math.random() * 3)];
        if (Math.random() < .2) {
            f.properties.laz_tile = null;
            f.properties.laz_size = null;
        } else {
            f.properties.laz_tile = 'tile_' + Math.floor(Math.random() * Math.pow(16, 10)).toString(16);
            f.properties.laz_size = Math.floor(Math.random() * 500) + 'M';
        }
    });
    fs.writeFileSync(file, JSON.stringify(obj));
});