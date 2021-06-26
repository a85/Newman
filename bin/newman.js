#!/usr/bin/env node

require('../lib/node-version-check'); // @note that this should not respect CLI --silent

const _ = require('lodash'),
    waterfall = require('async/waterfall'),
    { Command } = require('commander'),
    program = new Command(),
    version = require('../package.json').version,
    newman = require('../'),
    util = require('./util');

program
    .name('newman')
    .addHelpCommand(false)
    .version(version, '-v, --version');

// The `run` command allows you to specify a collection to be run with the provided options.
program
    .command('run <collection>')
    .description('Initiate a Postman Collection run from a given URL or path')
    .usage('<collection> [options]')
    .option('-e, --environment <path>', 'Specify a URL or path to a Postman Environment')
    .option('-g, --globals <path>', 'Specify a URL or path to a file containing Postman Globals')
    .option('-r, --reporters [reporters]', 'Specify the reporters to use for this run', util.cast.csvParse, ['cli'])
    .option('-n, --iteration-count <n>', 'Define the number of iterations to run', util.cast.integer)
    .option('-d, --iteration-data <path>', 'Specify a data file to use for iterations (either JSON or CSV)')
    .option('--folder <path>',
        'Specify the folder to run from a collection. Can be specified multiple times to run multiple folders',
        util.cast.memoize, [])
    .option('--preserve-order',
        'Specify if the order of folder arguments in the command line should be preserved.', false)
    .option('--global-var <value>',
        'Allows the specification of global variables via the command line, in a key=value format',
        util.cast.memoizeKeyVal, [])
    .option('--env-var <value>',
        'Allows the specification of environment variables via the command line, in a key=value format',
        util.cast.memoizeKeyVal, [])
    .option('--export-environment <path>', 'Exports the final environment to a file after completing the run')
    .option('--export-globals <path>', 'Exports the final globals to a file after completing the run')
    .option('--export-collection <path>', 'Exports the executed collection to a file after completing the run')
    .option('--postman-api-key <apiKey>', 'API Key used to load the resources from the Postman API')
    .option('--bail [modifiers]',
        'Specify whether or not to gracefully stop a collection run on encountering an error' +
        ' and whether to end the run with an error based on the optional modifier', util.cast.csvParse)
    .option('--ignore-redirects', 'Prevents Newman from automatically following 3XX redirect responses')
    .option('-x , --suppress-exit-code', 'Specify whether or not to override the default exit code for the current run')
    .option('--silent', 'Prevents Newman from showing output to CLI')
    .option('--disable-unicode', 'Forces Unicode compliant symbols to be replaced by their plain text equivalents')
    .option('--color <value>', 'Enable/Disable colored output (auto|on|off)', util.cast.colorOptions, 'auto')
    .option('--delay-request [n]', 'Specify the extent of delay between requests (milliseconds)', util.cast.integer, 0)
    .option('--timeout [n]', 'Specify a timeout for collection run (milliseconds)', util.cast.integer, 0)
    .option('--timeout-request [n]', 'Specify a timeout for requests (milliseconds)', util.cast.integer, 0)
    .option('--timeout-script [n]', 'Specify a timeout for scripts (milliseconds)', util.cast.integer, 0)
    .option('--working-dir <path>', 'Specify the path to the working directory')
    .option('--no-insecure-file-read', 'Prevents reading the files situated outside of the working directory')
    .option('-k, --insecure', 'Disables SSL validations')
    .option('--ssl-client-cert-list <path>', 'Specify the path to a client certificates configurations (JSON)')
    .option('--ssl-client-cert <path>', 'Specify the path to a client certificate (PEM)')
    .option('--ssl-client-key <path>', 'Specify the path to a client certificate private key')
    .option('--ssl-client-passphrase <passphrase>', 'Specify the client certificate passphrase (for protected key)')
    .option('--ssl-extra-ca-certs <path>', 'Specify additionally trusted CA certificates (PEM)')
    .option('--cookie-jar <path>', 'Specify the path to a custom cookie jar (serialized tough-cookie JSON) ')
    .option('--export-cookie-jar <path>', 'Exports the cookie jar to a file after completing the run')
    .option('--verbose', 'Show detailed information of collection run and each request sent')
    .action((collection, command) => {
        let options = util.commanderToObject(command),

            // parse custom reporter options
            reporterOptions = util.parseNestedOptions(program._originalArgs, '--reporter-', options.reporters);

        // Inject additional properties into the options object
        options.collection = collection;
        options.reporterOptions = reporterOptions._generic;
        options.reporter = _.transform(_.omit(reporterOptions, '_generic'), (acc, value, key) => {
            acc[key] = _.assignIn(value, reporterOptions._generic); // overrides reporter options with _generic
        }, {});

        newman.run(options, function (err, summary) {
            const runError = err || summary.run.error || summary.run.failures.length;

            if (err) {
                console.error(`error: ${err.message || err}\n`);
                err.friendly && console.error(`  ${err.friendly}\n`);
            }
            runError && !_.get(options, 'suppressExitCode') && process.exit(1);
        });
    });

program.addHelpText('after', `
To get available options for a command:
  newman <command> -h`);

// Warn on invalid command and then exits.
program.on('command:*', (command) => {
    console.error(`error: invalid command \`${command}\`\n`);
    program.help();
});

/**
 * Starts the script execution.
 * callback is required when this is required as a module in tests.
 *
 * @param {String[]} argv - Argument vector.
 * @param {?Function} callback - The callback function invoked on the completion of execution.
 */
function run (argv, callback) {
    waterfall([
        (next) => {
            // cache original argv, required to parse nested options later.
            program._originalArgs = argv;
            // omit custom nested options, otherwise commander will throw unknown options error
            next(null, util.omitNestedOptions(argv, '--reporter-'));
        },
        (args, next) => {
            let error = null;

            try {
                program.parse(args);
            }
            catch (err) {
                error = err;
            }
            next(error);
        },
        (next) => {
            // throw error if no argument is provided.
            next(program.args.length ? null : new Error('no arguments provided'));
        }
    ], (error) => {
        // invoke callback if this is required as module, used in tests.
        if (callback) { return callback(error); }

        // in case of an error, log error message and print help message.
        if (error) {
            console.error(`error: ${error.message || error}\n`);
            program.help();
        }
    });
}

// This hack has been added from https://github.com/nodejs/node/issues/6456#issue-151760275
// @todo: remove when https://github.com/nodejs/node/issues/6456 has been fixed
(Number(process.version[1]) >= 6) && [process.stdout, process.stderr].forEach((s) => {
    s && s.isTTY && s._handle && s._handle.setBlocking && s._handle.setBlocking(true);
});

// Run this script if this is a direct stdin.
!module.parent && run(process.argv);

// Export to allow debugging and testing.
module.exports = run;
