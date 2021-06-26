var _ = require('lodash'),
    asyncEach = require('async/each'),
    sdk = require('postman-collection'),
    runtime = require('postman-runtime'),
    request = require('postman-request'),
    EventEmitter = require('eventemitter3'),
    SecureFS = require('./secure-fs'),
    RunSummary = require('./summary'),
    getOptions = require('./options'),
    exportFile = require('./export-file'),
    util = require('../util'),

    /**
     * This object describes the various events raised by Newman, and what each event argument contains.
     * Error and cursor are present in all events.
     *
     * @type {Object}
     */
    runtimeEvents = {
        start: [],
        beforeIteration: [],
        beforeItem: ['item'],
        beforePrerequest: ['events', 'item'],
        prerequest: ['executions', 'item'],
        beforeRequest: ['request', 'item'],
        request: ['response', 'request', 'item', 'cookies', 'history'],
        beforeTest: ['events', 'item'],
        test: ['executions', 'item'],
        item: ['item'],
        iteration: [],
        beforeScript: ['script', 'event', 'item'],
        script: ['execution', 'script', 'event', 'item']
    },

    /**
     * load all the default reporters here. if you have new reporter, add it to this list
     * we know someone, who does not like dynamic requires
     *
     * @type {Object}
     */
    defaultReporters = {
        cli: require('../reporters/cli'),
        json: require('../reporters/json'),
        junit: require('../reporters/junit'),
        progress: require('../reporters/progress'),
        emojitrain: require('../reporters/emojitrain')
    },

    /**
     * The object of known reporters and their install instruction in case the reporter is not loaded.
     * Pad message with two spaces since its a follow-up message for reporter warning.
     *
     * @private
     * @type {Object}
     */
    knownReporterErrorMessages = {
        html: '  run `npm install newman-reporter-html`\n',
        teamcity: '  run `npm install newman-reporter-teamcity`\n'
    },

    /**
     * Multiple ids or names entrypoint lookup strategy.
     *
     * @private
     * @type {String}
     */
    MULTIENTRY_LOOKUP_STRATEGY = 'multipleIdOrName';

    /**
     * Multiple items ignore strategy.
     *
     * @private
     * @type {String}
     */
    MULTIPLE_IGNORE_STRATEGY = 'itemsOrGroups';

/**
 * Runs the collection, with all the provided options, returning an EventEmitter.
 *
 * @param {Object} options - The set of wrapped options, passed by the CLI parser.
 * @param {Collection|Object|String} options.collection - A JSON / Collection / String representing the collection.
 * @param {Object|String} options.environment - An environment JSON / file path for the current collection run.
 * @param {Object|String} options.globals - A globals JSON / file path for the current collection run.
 * @param {String} options.workingDir - Path of working directory that contains files needed for the collection run.
 * @param {String} options.insecureFileRead - If true, allow reading files outside of working directory.
 * @param {Object|String} options.iterationData - An iterationData JSON / file path for the current collection run.
 * @param {Object|String} options.reporters - A set of reporter names and their associated options for the current run.
 * @param {Object|String} options.cookieJar - A tough-cookie cookieJar / file path for the current collection run.
 * @param {String} options.exportGlobals - The relative path to export the globals file from the current run to.
 * @param {String} options.exportEnvironment - The relative path to export the environment file from the current run to.
 * @param {String} options.exportCollection - The relative path to export the collection from the current run to.
 * @param {String} options.exportCookieJar - The relative path to export the cookie jar from the current run to.
 * @param {Function} callback - The callback function invoked to mark the end of the collection run.
 * @returns {EventEmitter} - An EventEmitter instance with done and error event attachments.
 */
module.exports = function (options, callback) {
    // validate all options. it is to be noted that `options` parameter is option and is polymorphic
    (!callback && _.isFunction(options)) && (
        (callback = options),
        (options = {})
    );
    !_.isFunction(callback) && (callback = _.noop);

    var emitter = new EventEmitter(), // @todo: create a new inherited constructor
        runner = new runtime.Runner(),
        stopOnFailure,
        entrypoint,
        exclude;

    // get the configuration from various sources
    getOptions(options, function (err, options) {
        if (err) {
            return callback(err);
        }

        // ensure that the collection option is present before starting a run
        if (!_.isObject(options.collection)) {
            return callback(new Error('expecting a collection to run'));
        }

        // use client certificate list to allow different ssl certificates for
        // different URLs
        var sslClientCertList = options.sslClientCertList || [],
            // allow providing custom cookieJar
            cookieJar = options.cookieJar || request.jar();

        // if sslClientCert option is set, put it at the end of the list to
        // match all URLs that didn't match in the list
        if (options.sslClientCert) {
            sslClientCertList.push({
                name: 'client-cert',
                matches: [sdk.UrlMatchPattern.MATCH_ALL_URLS],
                key: { src: options.sslClientKey },
                cert: { src: options.sslClientCert },
                passphrase: options.sslClientPassphrase
            });
        }

        // iterates over the bail array and sets each item as an obj key with a value of boolean true
        // [item1, item2] => {item1: true, item2: true}
        if (_.isArray(options.bail)) {
            options.bail = _.transform(options.bail, function (result, value) {
                result[value] = true;
            }, {});
        }

        // sets entrypoint to execute if options.folder is specified.
        if (options.folder) {
            entrypoint = { execute: options.folder };

            // uses `multipleIdOrName` lookupStrategy in case of multiple folders.
            _.isArray(entrypoint.execute) && (entrypoint.lookupStrategy = MULTIENTRY_LOOKUP_STRATEGY);
        }

        // sets exclude to ignore if options.excludeFolder is specified.
        if (options.excludeFolder) {
            exclude = { ignore: options.excludeFolder };

            // uses `findItemsOrGroups` ignoreStrategy in case of multiple folders.
            _.isArray(exclude.ignore) && (exclude.ignoreStrategy = MULTIPLE_IGNORE_STRATEGY);
        }

        // sets stopOnFailure to true in case bail is used without any modifiers or with failure
        // --bail => stopOnFailure = true
        // --bail failure => stopOnFailure = true
        (typeof options.bail !== 'undefined' &&
            (options.bail === true || (_.isObject(options.bail) && options.bail.failure))) ?
            stopOnFailure = true : stopOnFailure = false;

        // store summary object and other relevant information inside the emitter
        emitter.summary = new RunSummary(emitter, options);

        // to store the exported content from reporters
        emitter.exports = [];

        // now start the run!
        runner.run(options.collection, {
            stopOnFailure: stopOnFailure, // LOL, you just got trolled ¯\_(ツ)_/¯
            abortOnFailure: options.abortOnFailure, // used in integration tests, to be considered for a future release
            abortOnError: _.get(options, 'bail.folder'),
            iterationCount: options.iterationCount,
            environment: options.environment,
            globals: options.globals,
            entrypoint: entrypoint,
            exclude: exclude,
            data: options.iterationData,
            delay: {
                item: options.delayRequest
            },
            timeout: {
                global: options.timeout || 0,
                request: options.timeoutRequest || 0,
                script: options.timeoutScript || 0
            },
            fileResolver: new SecureFS(options.workingDir, options.insecureFileRead),
            requester: {
                useWhatWGUrlParser: true,
                cookieJar: cookieJar,
                followRedirects: _.has(options, 'ignoreRedirects') ? !options.ignoreRedirects : undefined,
                strictSSL: _.has(options, 'insecure') ? !options.insecure : undefined,
                timings: Boolean(options.verbose),
                extendedRootCA: options.sslExtraCaCerts,
                agents: _.isObject(options.requestAgents) ? options.requestAgents : undefined
            },
            certificates: sslClientCertList.length && new sdk.CertificateList({}, sslClientCertList)
        }, function (err, run) {
            if (err) { return callback(err); }

            var callbacks = {},
                // ensure that the reporter option type polymorphism is handled
                reporters = _.isString(options.reporters) ? [options.reporters] : options.reporters,
                // keep a track of start assertion indices of legacy assertions
                legacyAssertionIndices = {};

            // emit events for all the callbacks triggered by the runtime
            _.forEach(runtimeEvents, function (definition, eventName) {
                // intercept each runtime.* callback and expose a global object based event
                callbacks[eventName] = function (err, cursor) {
                    var args = arguments,
                        obj = { cursor };

                    // convert the arguments into an object by taking the key name reference from the definition
                    // object
                    _.forEach(definition, function (key, index) {
                        obj[key] = args[index + 2]; // first two are err, cursor
                    });

                    args = [eventName, err, obj];
                    emitter.emit.apply(emitter, args); // eslint-disable-line prefer-spread
                };
            });

            // add non generic callback handling
            _.assignIn(callbacks, {

                /**
                 * Bubbles up console messages.
                 *
                 * @param {Object} cursor - The run cursor instance.
                 * @param {String} level - The level of console logging [error, silent, etc].
                 * @returns {*}
                 */
                console (cursor, level) {
                    emitter.emit('console', null, {
                        cursor: cursor,
                        level: level,
                        messages: _.slice(arguments, 2)
                    });
                },

                /**
                 * The exception handler for the current run instance.
                 *
                 * @todo Fix bug of arg order in runtime.
                 * @param {Object} cursor - The run cursor.
                 * @param {?Error} err - An Error instance / null object.
                 * @returns {*}
                 */
                exception (cursor, err) {
                    emitter.emit('exception', null, {
                        cursor: cursor,
                        error: err
                    });
                },

                assertion (cursor, assertions) {
                    _.forEach(assertions, function (assertion) {
                        var errorName = _.get(assertion, 'error.name', 'AssertionError');

                        !assertion && (assertion = {});

                        // store the legacy assertion index
                        assertion.index && (legacyAssertionIndices[cursor.ref] = assertion.index);

                        emitter.emit('assertion', (assertion.passed ? null : {
                            name: errorName,
                            index: assertion.index,
                            test: assertion.name,
                            message: _.get(assertion, 'error.message', assertion.name || ''),

                            stack: errorName + ': ' + _.get(assertion, 'error.message', '') + '\n' +
                                '   at Object.eval sandbox-script.js:' + (assertion.index + 1) + ':' +
                                ((cursor && cursor.position || 0) + 1) + ')'
                        }), {
                            cursor: cursor,
                            assertion: assertion.name,
                            skipped: assertion.skipped,
                            error: assertion.error,
                            item: run.resolveCursor(cursor)
                        });
                    });
                },

                /**
                 * Custom callback to override the `done` event to fire the end callback.
                 *
                 * @todo Do some memory cleanup here?
                 * @param {?Error} err - An error instance / null passed from the done event handler.
                 * @param {Object} cursor - The run instance cursor.
                 * @returns {*}
                 */
                done (err, cursor) {
                    // in case runtime faced an error during run, we do not process any other event and emit `done`.
                    // we do it this way since, an error in `done` callback would have anyway skipped any intermediate
                    // events or callbacks
                    if (err) {
                        emitter.emit('done', err, emitter.summary);
                        callback(err, emitter.summary);

                        return;
                    }

                    // we emit a `beforeDone` event so that reporters and other such addons can do computation before
                    // the run is marked as done
                    emitter.emit('beforeDone', null, {
                        cursor: cursor,
                        summary: emitter.summary
                    });

                    _.forEach(['environment', 'globals', 'collection', 'cookie-jar'], function (item) {
                        // fetch the path name from options if one is provided
                        var path = _.get(options, _.camelCase(`export-${item}`));

                        // if the options have an export path, then add the item to export queue
                        path && emitter.exports.push({
                            name: item,
                            default: `newman-${item}.json`,
                            path: path,
                            content: item === 'cookie-jar' ?
                                cookieJar.toJSON() :
                                _(emitter.summary[item].toJSON())
                                    .defaults({
                                        name: item
                                    })
                                    .merge({
                                        _postman_variable_scope: item,
                                        _postman_exported_at: (new Date()).toISOString(),
                                        _postman_exported_using: util.userAgent
                                    })
                                    .value()
                        });
                    });

                    asyncEach(emitter.exports, exportFile, function (err) {
                        // we now trigger actual done event which we had overridden
                        emitter.emit('done', err, emitter.summary);
                        callback(err, emitter.summary);
                    });
                }
            });

            emitter.on('script', function (err, o) {
                // bubble special script name based events
                o && o.event && emitter.emit(o.event.listen + 'Script', err, o);
            });

            emitter.on('beforeScript', function (err, o) {
                // bubble special script name based events
                o && o.event && emitter.emit(_.camelCase('before-' + o.event.listen + 'Script'), err, o);
            });

            // initialise all the reporters
            !emitter.reporters && (emitter.reporters = {});
            _.isArray(reporters) && _.forEach(reporters, function (reporterName) {
                // disallow duplicate reporter initialisation
                if (_.has(emitter.reporters, reporterName)) { return; }

                var Reporter;

                try {
                    // check if the reporter is an external reporter
                    Reporter = require((function (name) { // ensure scoped packages are loaded
                        var prefix = '',
                            scope = (name.charAt(0) === '@') && name.substr(0, name.indexOf('/') + 1);

                        if (scope) {
                            prefix = scope;
                            name = name.substr(scope.length);
                        }

                        return prefix + 'newman-reporter-' + name;
                    }(reporterName)));
                }
                // @todo - maybe have a debug mode and log error there
                catch (error) {
                    if (!defaultReporters[reporterName]) {
                        // @todo: route this via print module to respect silent flags
                        console.warn(`newman: could not find "${reporterName}" reporter`);
                        console.warn('  ensure that the reporter is installed in the same directory as newman');

                        // print install instruction in case a known reporter is missing
                        if (knownReporterErrorMessages[reporterName]) {
                            console.warn(knownReporterErrorMessages[reporterName]);
                        }
                        else {
                            console.warn('  please install reporter using npm\n');
                        }
                    }
                }

                // load local reporter if its not an external reporter
                !Reporter && (Reporter = defaultReporters[reporterName]);

                try {
                    // we could have checked _.isFunction(Reporter), here, but we do not do that so that the nature of
                    // reporter error can be bubbled up
                    Reporter && (emitter.reporters[reporterName] = new Reporter(emitter,
                        _.get(options, ['reporter', reporterName], {}), options));
                }
                catch (error) {
                    // if the reporter errored out during initialisation, we should not stop the run simply log
                    // the error stack trace for debugging
                    console.warn(`newman: could not load "${reporterName}" reporter`);

                    if (!defaultReporters[reporterName]) {
                        // @todo: route this via print module to respect silent flags
                        console.warn(`  this seems to be a problem in the "${reporterName}" reporter.\n`);
                    }
                    console.warn(error);
                }
            });

            // raise warning when more than one dominant reporters are used
            (function (reporters) {
                // find all reporters whose `dominant` key is set to true
                var conflicts = _.keys(_.transform(reporters, function (conflicts, reporter, name) {
                    reporter.dominant && (conflicts[name] = true);
                }));

                (conflicts.length > 1) && // if more than one dominant, raise a warning
                    console.warn(`newman: ${conflicts.join(', ')} reporters might not work well together.`);
            }(emitter.reporters));

            // we ensure that everything is async to comply with event paradigm and start the run
            setImmediate(function () {
                run.start(callbacks);
            });
        });
    });

    return emitter;
};
