var _ = require('lodash'),
    SerialiseError = require('serialised-error'),
    RunSummary;

/**
 * @constructor
 * @param {EventEmitter} emitter
 *
 * @note
 * The summary object looks somewhat like the following:
 * (
 *   iterations: { total: 1, pending: 0, failed: 0 },
 *   items: { total: 23, pending: 0, failed: 0 },
 *   scripts: { total: 24, pending: 0, failed: 3 },
 *   prerequests: { total: 23, pending: 0, failed: 0 },
 *   requests: { total: 23, pending: 0, failed: 0 },
 *   tests: { total: 23, pending: 0, failed: 0 },
 *   assertions: { total: 62, pending: 0, failed: 8 },
 *   failures: [{ source: 'DigestAuth Request', error: [Object] }]
 * }
 */
RunSummary = function RunSummary (emitter) {
    // keep a copy of this instance since, we need to refer to this from various events
    var summary = this,
        // execute `trackEvent` function to attach listeners and update the pass, fail and pending count of each event
        trackers = RunSummary.trackEvent(['iteration', 'item', 'script', 'prerequest', 'request', 'test', 'assertion'],
            emitter),
        // maintain a list of failures for this summary
        failures = trackers.failures;


    // store the trackers and failures in the summary object itself
    _.assign(summary, trackers.counters, {
        failures: failures
    });

    // mark the point when the run started
    // also mark the point when run completed and also store error if needed
    emitter.on('start', function () { summary.started = Date.now(); });
    emitter.on('done', function (err) {
        summary.completed = Date.now();
        err && (summary.error = err);
    });

    // generate pseudo assertion events since runtime does not trigger assertion events yet.
    // without this, all reporters would needlessly need to extract assertions and create an error object
    // out of it
    emitter.on('script', function (err, o) {
        // we iterate on each test asserion to trigger an evemt. during this, we create a pseudo error object
        // for the assertion
        var index = 0;

        _.each(_.get(o.execution, 'globals.tests'), function (passed, assertion) {
            emitter.emit('assertion', passed ? null : (new SerialiseError({
                name: 'AssertionFailure',
                message: assertion,
                stack: 'AssertionFailure: Expected tests["' + assertion + '"] to be truthy\n' +
                    '   at Object.eval test.js:' + (index + 1) + ':' + (o.cursor.position + 1) + ')',
                index: index // @todo find better way to notify the same
            }, true)), {
                cursor: o.cursor,
                assertion: assertion,
                event: o.event,
                item: o.item
            });
            index += 1;
        });
    });
};

/**
 * Sets up common listeners for a set of events, which tracks how many times they were executed and records the ones
 * which had an error passed as first argument
 *
 * @param {[type]} events [description]
 * @param {[type]} emitter [description]
 *
 * @returns {[type]} [description]
 */
RunSummary.trackEvent = function (events, emitter) {
    var trackers = {
        counters: {},
        failures: []
    };

    _.each(events, function (event) {
        var tracker = trackers.counters[event + 's'] = {
            total: 0,
            pending: 0,
            failed: 0
        };

        emitter.on(_.camelCase('before-' + event), function (err, o) {
            var item = o.item;
            tracker.pending += 1;

            err && trackers.failures.push({
                source: item ? (item.name || item.id) : '<unknown>',
                at: _.camelCase('before-' + event),
                error: err,
                cursor: o.cursor,
                parent: o.item && item.__parent && item.__parent.__parent
            });
        });

        emitter.on(event, function (err, o) {
            var item = o.item,
                source = event;

            // check pending so that, it does not negate for items that do not have a `before` counterpart
            tracker.pending && (tracker.pending -= 1);
            tracker.total += 1; // increment total

            if (err) { // on error push it to the failure array
                // @todo - perform per-event message detection until, the arguments are unified as an object
                // in case of user script error, point to the line and column of the script and its type
                if (event === 'script') {
                    o.event && (source = o.event.listen + '-script');
                    if (err.stacktrace && err.stacktrace[0] && err.stacktrace[0].lineNumber) {
                        source += (':' + (err.stacktrace[0].lineNumber - 2));
                        err.stacktrace[0].columnNumber && (source += (':' + err.stacktrace[0].columnNumber));
                    }
                }
                else if (event === 'assertion') {
                    _.has(err, 'index') && (source += (':' + (err.index + 1)));
                    source += ' in test-script';
                }

                if (err.stack && !err.stacktrace) {
                    err = new SerialiseError(err, true);
                }

                tracker.failed += 1;
                trackers.failures.push({
                    cursor: o.cursor,
                    source: item,
                    parent: item && item.__parent && item.__parent.__parent,
                    at: source,
                    error: err
                });
            }
        });
    });

    return trackers;
};

module.exports = RunSummary;
