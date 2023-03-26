var path = require('path');
var SRC_DIR = path.join(__dirname, './src');
var DIST_DIR = path.join(__dirname, '../server/public/');

module.exports = {

  /*
    EDIT: may eventally get rid of all the test files, but might be better to have different build commands to build different tests instead of build all in one command in the long run
  */
  entry: {
    'scraper':  { import: `${SRC_DIR}/scraper/index.jsx`, filename: `scraper.bundle.js` },
    // TESTS:
    // 'date-input': { import: `${SRC_DIR}/tests/date-input/index.jsx`, filename: 'tests/date-input.bundle.js'},
    //'sensor': { import: `${SRC_DIR}/tests/sensors/index.jsx`, filename: 'tests/sensor.bundle.js'},
    // 'pg': { import: `${SRC_DIR}/tests/pg/index.jsx`, filename: 'tests/pg.bundle.js'},
    // 'image-crop': { import: `${SRC_DIR}/tests/image-crop/index.jsx`, filename: 'tests/image-crop.bundle.js'},
    // 'context':  { import: `${SRC_DIR}/tests/context/index.jsx`, filename: `tests/context.bundle.js` },
    // 'form':  { import: `${SRC_DIR}/tests/form/index.jsx`, filename: `tests/form.bundle.js` }
  },
  output: {
    path: DIST_DIR
  },
  module: {
    rules: [
      {
        test: /\.jsx?/,
        exclude: /node_modules/,
        include: SRC_DIR,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env', '@babel/preset-react']
       }
      },
      {
        test: /\.(jpg|png|svg)$/,
        loader: 'url-loader',
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ]
  }
};