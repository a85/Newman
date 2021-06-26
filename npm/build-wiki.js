#!/usr/bin/env node
/* eslint-env node, es6 */
// ---------------------------------------------------------------------------------------------------------------------
// This script is intended to generate a wiki for this module
// ---------------------------------------------------------------------------------------------------------------------

require('shelljs/global');

var fs = require('fs'),

    colors = require('colors/safe'),
    jsdoc2md = require('jsdoc-to-markdown'),

    OUT_DIR = 'out/wiki',
    INP_DIR = 'lib/**/*.js',
    OUT_FILE = 'REFERENCE.md',
    OUT_PATH = OUT_DIR + '/' + OUT_FILE,
    SUCCESS_MESSAGE = colors.green.bold(`- wiki generated at "${OUT_PATH}"`);  

module.exports = function (exit) {
    console.info(colors.yellow.bold('Generating wiki using jsdoc2md...'));

    // clean directory
    test('-d', OUT_DIR) && rm('-rf', OUT_DIR);
    mkdir('-p', OUT_DIR);

    // execute command
    jsdoc2md.render({ files: INP_DIR })
        .then(function (markdown) {
            fs.writeFile(OUT_PATH, markdown, function (err) {
                console.info(err ? err : SUCCESS_MESSAGE);
                exit(err ? 1 : 0);
            });
        })
        .catch(function (err) {
            console.error(err);
            exit(1);
        });
};

// ensure we run this script exports if this is a direct stdin.tty run
!module.parent && module.exports(exit);
