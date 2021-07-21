const _ = require('lodash'),
    runtime = require('postman-runtime'),
    asyncEach = require('async/each'),
    RunSummary = require('../run/summary'),
    exportFile = require('../run/export-file'),
    EventEmitter = require('eventemitter3'),
    util = require('./util'),

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

    // all default reporters loaded here
    defaultReporters = {
        cli: require('../reporters/cli'),
        json: require('../reporters/json'),
        junit: require('../reporters/junit'),
        progress: require('../reporters/progress'),
        emojitrain: require('../reporters/emojitrain')
    };

module.exports = function (options, callback) {
    // validate all options. it is to be noted that `options` parameter is option and is polymorphic
    (!callback && _.isFunction(options)) && (
        (callback = options),
        (options = {})
    );
    !_.isFunction(callback) && (callback = _.noop);

    // ensure that the curl command is present before starting a run
    if (!_.isString(options.curl)) {
        return callback(new Error('expecting a valid curl command to run'));
    }

    const runner = new runtime.Runner(),
        emitter = new EventEmitter();

    // store summary object and other relevant information inside the emitter
    emitter.summary = new RunSummary(emitter, options);

    util.convertCurltoCollection(options.curl, function (err, curlCollection) {
        if (err) {
            callback(err); // eslint-disable-line
        }

        runner.run(curlCollection, {}, function (err, runResult) {
            if (err) {
                return callback(err);
            }

            var callbacks = {},
                // ensure that the reporter option type polymorphism is handled
                reporters = _.isString(options.reporters) ? [options.reporters] : options.reporters;

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
                 * Custom callback to override the `done` event to fire the end callback.
                 *
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

                    asyncEach(emitter.exports, exportFile, function (err) {
                        // we now trigger actual done event which we had overridden
                        emitter.emit('done', err, emitter.summary);
                        callback(err, emitter.summary);
                    });
                }
            });

            // initialise all the reporters
            !emitter.reporters && (emitter.reporters = {});
            _.isArray(reporters) && _.forEach(reporters, function (reporterName) {
                // disallow duplicate reporter initialisation
                if (_.has(emitter.reporters, reporterName)) { return; }

                var Reporter;

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
                        console.warn(`  this seems to be a problem in the "${reporterName}" reporter.\n`);
                    }
                    console.warn(error);
                }
            });

            // we ensure that everything is async to comply with event paradigm and start the run
            setImmediate(function () {
                runResult.start(callbacks);
            });

            return callback(null, runResult);
        });
    });
};
