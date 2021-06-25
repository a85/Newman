var _ = require('lodash'),
    sdk = require('postman-collection'),
    SerialiseError = require('serialised-error'),
    RunSummary;

/**
 * Creates and returns a RunSummary instance for the current collection run.
 *
 * @constructor
 * @param {EventEmitter} emitter - An EventEmitter instance with event handler attachments to add run information to.
 * @param {Object} options - A set of run summary creation options.
 */
RunSummary = function RunSummary (emitter, options) {
    // keep a copy of this instance since, we need to refer to this from various events
    var summary = this;

    // and store the trackers and failures in the summary object itself
    _.assign(summary, /** @lends RunSummary.prototype */ {
        /**
         * The collection that is being executed.
         *
         * @type {Collection}
         */
        collection: _.get(options, 'collection'),

        /**
         * The environment that is being used during the run
         *
         * @type {VariableScope}
         *
         */
        environment: _.get(options, 'environment'),

        /**
         * Global variables being used during the run
         *
         * @type {VariableScope}
         */
        globals: _.get(options, 'globals'),

        /**
         * Holds information related to the run.
         */
        run: {
            /**
             * Holds the statistics of the run. Each property in it is the item being tracked and has three numeric
             * properties - total, failed, pending
             *
             * @type {Object.<Object>}
             */
            stats: {
                iterations: {},
                items: {},
                scripts: {},
                prerequests: {},
                requests: {},
                tests: {},
                assertions: {},
                testScripts: {},
                prerequestScripts: {}
            },

            /**
             * Stores all generic timing information
             *
             * @type {Object}
             */
            timings: {
                /**
                 * The average response time of the run
                 *
                 * @type {number}
                 */
                responseAverage: 0,

                /**
                 * The miminum response time of the run
                 *
                 * @type {number}
                 */
                responseMin: 0,

                /**
                 * The maximum response time of the run
                 *
                 * @type {number}
                 */
                responseMax: 0,

                /**
                 * Standard deviation of response time of the run
                 *
                 * @type {number}
                 */
                responseSd: 0,

                /**
                 * The average DNS lookup time of the run
                 *
                 * @type {number}
                 */
                dnsAverage: 0,

                /**
                 * The minimum DNS lookup time of the run
                 *
                 * @type {number}
                 */
                dnsMin: 0,

                /**
                 * The maximum DNS lookup time of the run
                 *
                 * @type {number}
                 */
                dnsMax: 0,

                /**
                 * Standard deviation of DNS lookup time of the run
                 *
                 * @type {number}
                 */
                dnsSd: 0,

                /**
                 * The average first byte time of the run
                 *
                 * @type {number}
                 */
                firstByteAverage: 0,

                /**
                 * The minimum first byte time of the run
                 *
                 * @type {number}
                 */
                firstByteMin: 0,

                /**
                 * The maximum first byte time of the run
                 *
                 * @type {number}
                 */
                firstByteMax: 0,

                /**
                 * Standard deviation of first byte time of the run
                 *
                 * @type {number}
                 */
                firstByteSd: 0
            },

            /**
             * Stores detailed information about the order of execution, request, response and assertions
             *
             * @type {Array<Object>}
             */
            executions: [],

            /**
             * Stores information on data transfer made during the collection
             *
             * @type {Object}
             */
            transfers: {
                /**
                 * The total data received as response to every request
                 *
                 * @type {number}
                 */
                responseTotal: 0
            },

            /**
             * An array of all errors encountered during the run
             *
             * @type {Array.<Error>}
             */
            failures: [],

            /**
             * This stores any fatal error during the run that caused the run to abort prematurely.
             *
             * @type {Error}
             */
            error: null
        }
    });

    // track run timings (start and end)
    RunSummary.attachTimingTrackers(this, emitter);

    // accumulate statistics on all event
    // for all types of events track the counters for the event and its corresponding "before" counterpart
    RunSummary.attachStatisticTrackers(this, emitter);

    // accumulate statistics on requests - such as size and time
    RunSummary.attachRequestTracker(this, emitter);

    // accumulate errors (failures) from all events
    RunSummary.attachFailureTrackers(this, emitter);

    // accumulate all execution specific data in collection
    RunSummary.attachReportingTrackers(this, emitter);
};

_.assign(RunSummary, {
    attachReportingTrackers (summary, emitter) {
        var cache = {},
            executions = summary.run.executions;

        emitter.on('beforeItem', function (err, o) {
            if (err || !_.get(o, 'cursor.ref')) { return; }

            cache[o.cursor.ref] = _.assignIn(cache[o.cursor.ref] || {}, {
                cursor: o.cursor,
                item: o.item
            });
        });

        // save all responses in executions array
        emitter.on('request', function (err, o) {
            if (!_.get(o, 'cursor.ref')) { return; }

            var execution = cache[o.cursor.ref] = (cache[o.cursor.ref] || {}),
                item;

            item = _.assignIn({}, execution, {
                cursor: o.cursor,
                request: o.request,
                response: o.response,
                id: _.get(o, 'item.id')
            }, err && {
                requestError: err || undefined
            });

            if (!execution.request) {
                // normal request
                cache[o.cursor.ref] = item;
                // for `sendRequest` in script, should not affect the `normal request`
            }
            executions.push(item);
        });

        // save all script execution errors in each execution
        emitter.on('script', function (err, o) {
            if (!_.get(o, 'cursor.ref')) { return; }

            var execution = cache[o.cursor.ref] = (cache[o.cursor.ref] || {}),
                eventName = o && o.event && (o.event.listen + 'Script');

            // store the script error corresponding to the script event name
            err && (execution && eventName) && (execution[eventName] || (execution[eventName] = [])).push({
                error: err
            });
        });

        // save all assertions in each execution
        emitter.on('assertion', function (err, o) {
            if (!_.get(o, 'cursor.ref')) { return; }

            var execution = cache[o.cursor.ref] = (cache[o.cursor.ref] || {});

            if (!execution) { return; }

            (execution.assertions || (execution.assertions = [])).push({
                assertion: o.assertion,
                skipped: o.skipped,
                error: err || undefined
            });
        });
    },

    attachTimingTrackers (summary, emitter) {
        // mark the point when the run started
        // also mark the point when run completed and also store error if needed
        emitter.on('start', function () { summary.run.timings.started = Date.now(); });
        emitter.on('beforeDone', function () {
            summary.run.timings.completed = Date.now();
        });
        emitter.on('done', function (err) {
            err && (summary.error = err);
        });
    },
    attachStatisticTrackers (summary, emitter) {
        // accumulate statistics on all event
        // for all types of events track the counters for the event and its corresponding "before" counterpart
        _.forEach(summary.run.stats, function (tracker, name) {
            // the actual event names are singular than their plural trackers, so we make the name singular
            name = name.slice(0, -1); // remove last character

            // populate initial values of trackers
            _.assign(tracker, { total: 0, pending: 0, failed: 0 });

            // Set up common listeners for a set of events, which tracks how many times they were executed and records
            // the ones which had an error passed as first argument
            emitter.on(_.camelCase('before-' + name), function () {
                tracker.pending += 1;
            });

            emitter.on(name, function (err) {
                // check pending so that, it does not negate for items that do not have a `before` counterpart
                tracker.pending && (tracker.pending -= 1);
                err && (tracker.failed += 1);
                tracker.total += 1;
            });
        });
    },

    attachRequestTracker (summary, emitter) {
        // accumulate statistics on requests
        emitter.on('request', function (err, o) {
            if (err || !(o && o.response)) { return; }

            var size = _.isFunction(o.response.size) && o.response.size(),
                time = o.response.responseTime,
                requestCount = summary.run.stats.requests.total,
                timings,
                timingPhases;

            // compute the response size total
            size && (summary.run.transfers.responseTotal += (size.body || 0 + size.headers || 0));

            // if there are redirects, get timings for the last request sent
            timings = _.last(_.get(o, 'history.execution.data'));
            timings = timings && timings.timings;
            timingPhases = timings && sdk.Response.timingPhases(timings);

            (timingPhases || time) && _.forEach([
                'dns',
                'firstByte',
                'response'
            ], (value) => {
                var currentValue = (value === 'response') ? time : (timingPhases && timingPhases[value]),
                    previousAverage = summary.run.timings[`${value}Average`],
                    previousVariance = Math.pow(summary.run.timings[`${value}Sd`], 2),
                    delta1 = currentValue - previousAverage,
                    delta2,
                    currentVariance;

                if (!currentValue) { return; }

                // compute average time for the given phase of request
                summary.run.timings[`${value}Average`] =
                    (previousAverage * (requestCount - 1) + currentValue) / requestCount;

                // compute minimum time for the given phase of request
                if (!summary.run.timings[`${value}Min`]) {
                    summary.run.timings[`${value}Min`] = currentValue;
                }
                else {
                    summary.run.timings[`${value}Min`] =
                        Math.min(summary.run.timings[`${value}Min`], currentValue);
                }

                // compute maximum time the given phase of request
                summary.run.timings[`${value}Max`] = Math.max(summary.run.timings[`${value}Max`], currentValue);

                // compute standard deviation for the given phase of request
                // refer Welford's online algorithm from
                // https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
                delta2 = currentValue - summary.run.timings[`${value}Average`];
                currentVariance = (previousVariance * (requestCount - 1) + (delta1 * delta2)) / requestCount;
                summary.run.timings[`${value}Sd`] = Math.sqrt(currentVariance);
            });
        });
    },

    attachFailureTrackers (summary, emitter) {
        var eventsToTrack = ['beforeIteration', 'iteration', 'beforeItem', 'item', 'beforeScript', 'script',
            'beforePrerequest', 'prerequest', 'beforeRequest', 'request', 'beforeTest', 'test', 'beforeAssertion',
            'assertion'];

        // accumulate failures of all events
        // NOTE that surrogate events (which throw duplicate arguments) are not recorded
        _.forEach(eventsToTrack, function (event) {
            // push failures sent from "before" events
            emitter.on(event, function (err, o) {
                if (!err) { return; }

                var item = o && o.item,
                    source = event;

                // in case of user script error, point to the line and column of the script and its type
                if (event === 'script') {
                    o.event && (source = o.event.listen + '-script');
                    if (err.stacktrace && err.stacktrace[0] && err.stacktrace[0].lineNumber) {
                        source += (':' + (err.stacktrace[0].lineNumber - 2));
                        err.stacktrace[0].columnNumber && (source += (':' + err.stacktrace[0].columnNumber));
                    }
                }
                // assertion errors need to know which assertion in the test was this
                else if (event === 'assertion') {
                    _.has(err, 'index') && (source += (':' + err.index));
                    source += ' in test-script';
                }

                // if this is a plain error, convert it to serialised error
                if (err.stack && !err.stacktrace) {
                    err = new SerialiseError(err, true);
                }

                summary.run.failures.push({
                    error: err,
                    at: source,
                    source: item || undefined,
                    parent: item && item.__parent && item.__parent.__parent || undefined,
                    cursor: o.cursor || {}
                });
            });
        });
    }
});

module.exports = RunSummary;
