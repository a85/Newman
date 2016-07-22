var _ = require('lodash'),
    EventEmitter = require('eventemitter3'),
    runtime = require('postman-runtime'),
    transformer = require('postman-collection-transformer'),
    RunSummary = require('./summary'),
    config = require('./config'),
    util = require('./util'),
    Collection = require('postman-collection').Collection,

    runtimeEvents = {
        start: [],
        beforeIteration: [],
        beforeItem: ['item'],
        beforePrerequest: ['events', 'item'],
        prerequest: ['executions', 'item'],
        beforeRequest: ['request', 'item'],
        request: ['response', 'request', 'item'],
        beforeTest: ['events', 'item'],
        test: ['executions', 'item'],
        item: ['item'],
        iteration: [],
        beforeScript: ['script', 'event', 'item'],
        script: ['execution', 'script', 'event', 'item']
    },

    /**
     * Accepts an object, and extracts the property inside an object which is supposed to contain the required data.
     * In case of variables, it also extracts them into plain JS objects.
     *
     * @param {Object} source
     * @param {String} type - "environment" or "globals", etc
     *
     * @returns {Object}
     */
    extractModel = function (source, type) {
        source = source[type] || source; // extract object that holds variable. these usually come from cloud API
        if (!_.isObject(source)) {
            return undefined;
        }

        // ensure we unbox the JSON if it comes from cloud-api or similar sources
        !source.values && _.isObject(source[type]) && (source = source[type]);

        // ensure we handle environment sent in form of array of values
        (source.name && _.isArray(source.values)) && (source = source.values);

        // we ensure that environment passed as array is converted to plain object. runtime does this too, but we do it
        // here for consistency of options passed to reporters
        return _.isArray(source) ? _(source).keyBy('key').mapValues('value').value() : source;
    },

    /**
     * Loads the given data of type from a specified external location
     *
     * @param {String} type - The type of data to load.
     * @param {String} location - The location to load from (path or URL)
     * @param {function} cb
     * @returns {*}
     */
    externalLoader = function (type, location, cb) {
        return _.isString(location) ? util.fetch(location, function (err, data) {
            if (err) {
                return cb(err);
            }
            return cb(null, extractModel(data, type));
        }) : cb(null, location);
    },

    /**
     * Custom configuration loaders for the required configuration keys.
     *
     * @type {Object}
     */
    configLoaders = {
        collection: function (value, callback) {
            externalLoader('collection', value, function (err, data) {
                if (err) {
                    return callback(err);
                }
                if (_.isObject(data) && !_.get(data, 'info.schema')) {
                    return transformer.convert(data, { inputVersion: '1.0.0', outputVersion: '2.0.0' }, callback);
                }
                callback(null, data);
            });
        },
        environment: externalLoader.bind(this, 'environment'),
        globals: externalLoader.bind(this, 'globals'),
        iterationData: util.fetch // todo: use a csv parser to allow csv files.
    };

/**
 * @param {Object} options
 * @param {Collection|Object} options.collection
 * @param {Object} options.environment
 * @param {Object} options.globals
 * @param {Object} options.iterationData
 * @param {Array|String} options.reporters
 * @param {Function} callback
 *
 * @returns {EventEmitter}
 */
module.exports = function (options, callback) {
    // validate all options. it is to be noted that `options` parameter is option and is polymorphic
    (!callback && _.isFunction(options)) && (
        (callback = options),
            (options = {})
    );
    !_.isFunction(callback) && (callback = _.noop);

    var emitter = new EventEmitter(), // @todo: create a new inherited constructor
        runner = new runtime.Runner();

    // get the configuration from various sources
    config.get(options, { loaders: configLoaders, command: 'run' }, function (err, options) {
        if (err) {
            return callback(err);
        }

        // ensure that the collection option is present before starting a run
        if (!_.isObject(options.collection)) {
            callback(new Error('newman: expecting a collection to run'));
            return emitter;
        }
        // create a collection in case it is not one. user can send v2 JSON as a source and that will be converted
        // to a collection
        if (_.isPlainObject(options.collection) && !Collection.isCollection(options.collection)) {
            options.collection = new Collection(options.collection);
        }

        // store summary object and other relevant information inside the emitter
        emitter.summary = new RunSummary(emitter, options);

        options.collection && runner.run(options.collection, {
            abortOnFailure: options.abortOnError, // todo: could be a better name, especially in the CLI.
            iterationCount: options.iterationCount,
            environment: options.environment,
            globals: options.globals,
            entrypoint: options.folder,
            data: options.iterationData,
            // todo: add support for more types of timeouts, currently only request is supported
            timeout: options.timeoutRequest ? { request: options.timeoutRequest } : undefined,
            requester: {
                followRedirects: _.has(options, 'avoidRedirects') ? !options.avoidRedirects : undefined,
                strictSSL: _.has(options, 'insecure') ? !options.insecure : undefined
            }
        }, function (err, run) {
            var callbacks = {},
                // ensure that the reporter option type polymorphism is handled
                reporters = _.isString(options.reporters) ? [options.reporters] : options.reporters;

            // emit events for all the callbacks triggered by the runtime
            _.each(runtimeEvents, function (definition, eventName) {

                // intercept each runtime.* callback and expose a global object based event
                callbacks[eventName] = function (err, cursor) {
                    var args = arguments,
                        obj = { cursor: cursor };

                    // convert the arguments into an object by taking the key name reference from the definition
                    // object
                    _.each(definition, function (key, index) {
                        obj[key] = args[index + 2]; // first two are err, cursor
                    });

                    args = [eventName, err, obj];
                    emitter.emit.apply(emitter, args); // eslint-disable-line prefer-spread
                };
            });

            // two runtime callbacks do not follow pattern, define them separately
            callbacks.console = emitter.emit.bind(emitter, 'console');
            callbacks.exception = function (cursor, err) {
                emitter.emit('exception', err, {
                    cursor: cursor
                });
            };

            // override the `done` event to fire the end callback
            callbacks.done = function (err) { // @todo - do some memory cleanup here?
                emitter.emit('done', err, emitter.summary); // we now trigger actual done event which we had overridden
                callback(err, emitter.summary);
            };

            // generate pseudo assertion events since runtime does not trigger assertion events yet.
            // without this, all reporters would needlessly need to extract assertions and create an error object
            // out of it
            emitter.on('script', function (err, o) {
                // we iterate on each test assertion to trigger an event. during this, we create a pseudo error object
                // for the assertion
                var index = 0,
                    type = o && o.event && o.event.listen;

                _.each(_.get(o.execution, 'globals.tests'), function (passed, assertion) {
                    emitter.emit('assertion', (passed ? null : {
                        name: 'AssertionFailure',
                        index: index,
                        message: assertion,

                        stack: 'AssertionFailure: Expected tests["' + assertion + '"] to be truthy\n' +
                            '   at Object.eval test.js:' + (index + 1) + ':' +
                            ((o.cursor && o.cursor.position || 0) + 1) + ')'
                    }), {
                        cursor: o.cursor,
                        assertion: assertion,
                        event: o.event,
                        item: o.item
                    });
                    index += 1;
                });

                // bubble special script name based events
                type && emitter.emit(type + 'Script', err, o);
            });

            emitter.on('beforeScript', function (err, o) {
                // bubble special script name based events
                o && o.event && o.event && emitter.emit(_.camelCase('before-' + o.event.listen + 'Script'), err, o);
            });

            // initialise all the reporters
            _.isArray(reporters) && _.each(reporters, function (reporterName) {
                // @todo validate reporter name to exist
                // @todo look up for node module "newman-reporter-" as reporters if one is not found locally
                // @todo sanitise the reporter name for security reasons
                (emitter.reporters || (emitter.reporters = {}))[reporterName] =
                    new (require('./reporters/' + reporterName))(emitter, options);
            });

            // we ensure that everything is async to comply with event paradigm and start the run
            setImmediate(function () {
                run.start(callbacks);
            });
        });
    });

    return emitter;
};
