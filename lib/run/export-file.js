var fs = require('fs'),
    nodePath = require('path'),

    _ = require('lodash'),
    async = require('async'),
    mkdirp = require('mkdirp'),

    { join: joinPath, parse: parsePath, resolve: resolvePath } = nodePath,

    /**
     * The root path specifier
     *
     * @const
     * @private
     * @type {string}
     */
    E = '',

    /**
     * Default timestamp separator.
     *
     * @const
     * @private
     * @type {string}
     */
    TS_SEP = '-',

    /**
     * Writes the specified content to a file at the provided path.
     *
     * @param {Object} path - A set of path details for file writing.
     * @param {String|Buffer} content - The content to be written to the file.
     * @param {Object} options - A set of options for the current file write.
     * @param {Function} cb - The callback invoked when the file writing operation has completed, with/without errors.
     */
    writeFile = function (path, content, options, cb) {
        fs.writeFile(path.unparsed, content, function (err) {
            cb(_.set(err, 'help',
                `error writing file "${path.unparsed}" for ${options.name || 'unknown-source'}`), path);
        });
    },

    /**
     * Generate a timestamp from date
     *
     * @param {Date=} date - The timestamp used to mark the exported file.
     * @param {String=} separator - The optional string with which to separate different sections of the timestamp,
     * defaults to TS_SEP
     * @returns {String} - yyyy-mm-dd-HH-MM-SS-MS-0
     */
    timestamp = function (date, separator) {
        // use the iso string to ensure left padding and other stuff is taken care of
        return (date || new Date()).toISOString().replace(/[^\d]+/g, _.isString(separator) ? separator : TS_SEP);
    };

/**
 * Module whose job is to export a file which is in an export format.
 *
 * @param {Object} options - The set of file export options.
 * @param {String} options.path - The path to the exported file.
 * @param {String|Object} options.content - The JSON / stringified content that is to be written to the file.
 * @param {Function} done - The callback whose invocation marks the end of the file export routine.
 * @returns {*}
 */
module.exports = function (options, done) {
    // parse the path if one is available as string
    var path = _.isString(options.path) && parsePath(resolvePath(options.path)),
        content = _.isPlainObject(options.content) ? JSON.stringify(options.content, 0, 2) : (options.content || E);

    // if a path was not provided by user, we need to prepare the default path. but create the default path only if one
    // is provided.
    if (!path && _.isString(options.default)) {
        path = parsePath(options.default);
        // delete the path and directory if one is detected when parsing defaults
        path.root = E;
        path.dir = 'newman';

        // append timestamp
        path.name = `${path.name}-${timestamp()}0`; // @todo make -0 become incremental if file name exists
        path.base = path.name + path.ext;
    }
    // final check that path is valid
    if (!(path && path.base)) {
        return;
    }

    // now sore the unparsed result back for quick re-use during writing and a single place for unparsing
    path.unparsed = joinPath(path.dir, path.base);

    // in case the path has a directory, ensure that the directory is available
    if (path.dir) {
        async.waterfall([
            function (next) {
                mkdirp(path.dir)
                    .then(() => {
                        return next();
                    })
                    .catch((err) => {
                        return next(_.set(err, 'help',
                            `error creating path for file "${path.unparsed}" for ${options.name || 'unknown-source'}`));
                    });
            },
            function (next) {
                fs.stat(path.unparsed, function (err, stat) { // eslint-disable-line handle-callback-err
                    next(null, stat);
                });
            },
            function (stat, next) {
                var target;

                // handle cases where the specified export path is a pre-existing directory
                if (stat && stat.isDirectory()) {
                    target = parsePath(options.default);

                    // append timestamp
                    // @todo make -0 become incremental if file name exists
                    target.name += '-' + timestamp() + '0';
                    target.base = target.name + target.ext;

                    path.unparsed = joinPath(path.unparsed, target.base);
                }

                next(null, path);
            },
            function (path, next) {
                writeFile(path, content, options, next);
            }
        ], done);
    }
    else {
        writeFile(path, content, options, done);
    }
};
