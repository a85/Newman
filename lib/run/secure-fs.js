const fs = require('fs'),
    _ = require('lodash'),
    path = require('path'),
    util = require('util'),
    Readable = require('stream').Readable,

    PPERM_ERR = 'PPERM: insecure file access outside working directory',
    FUNCTION = 'function',
    DEPRECATED_SYNC_WRITE_STREAM = 'SyncWriteStream',
    EXPERIMENTAL_PROMISE = 'promises',

    // Use simple character check instead of regex to prevent regex attack
    /*
     * Windows root directory can be of the following from
     *
     * | File System | Actual           | Modified          |
     * |-------------|------------------|-------------------|
     * | LFS (Local) | C:\Program       | /C:/Program       |
     * | UNC         | \\Server\Program | ///Server/Program |
     */
    isWindowsRoot = (path) => {
        const drive = path.charAt(1);

        return ((path.charAt(0) === '/') &&
            ((drive >= 'A' && drive <= 'Z') || (drive >= 'a' && drive <= 'z')) &&
            (path.charAt(2) === ':')) ||
            path.slice(0, 3) === '///'; // Modified UNC path
    },

    stripTrailingSep = (thePath) => {
        if (thePath[thePath.length - 1] === path.sep) {
            return thePath.slice(0, -1);
        }

        return thePath;
    },

    pathIsInside = (thePath, potentialParent) => {
        // For inside-directory checking, we want to allow trailing slashes, so normalize.
        thePath = stripTrailingSep(thePath);
        potentialParent = stripTrailingSep(potentialParent);

        // Node treats only Windows as case-insensitive in its path module; we follow those conventions.
        if (global.process.platform === 'win32') {
            thePath = thePath.toLowerCase();
            potentialParent = potentialParent.toLowerCase();
        }

        return thePath.lastIndexOf(potentialParent, 0) === 0 &&
            (
                thePath[potentialParent.length] === path.sep ||
                thePath[potentialParent.length] === undefined
            );
    };

/**
 * Secure file resolver wrapper over fs. It only allows access to files inside working directory unless specified.
 */
class SecureFS {
    /**
     * Initialises all member variables
     *
     * @param {*} workingDir - Path of working directory
     * @param {*} [insecureFileRead=false] - If true, allow reading files outside working directory
     * @param {*} [fileWhitelist=[]] - List of allowed files outside of working directory
     */
    constructor (workingDir, insecureFileRead = false, fileWhitelist = []) {
        this._fs = fs;
        this._path = path;
        this.constants = this._fs.constants;

        this.workingDir = workingDir;
        this.insecureFileRead = insecureFileRead;
        this.fileWhitelist = fileWhitelist;

        this.isWindows = global.process.platform === 'win32';
    }

    /**
     * Private method to resolve the path based based on working directory
     *
     * @param {String} relOrAbsPath - Relative or absolute path to resolve
     * @param {Array} whiteList - A list of absolute path to whitelist
     *
     * @returns {String} The resolved path
     * @private
     */
    _resolve (relOrAbsPath, whiteList) {
        // Special handling for windows absolute paths to work cross platform
        this.isWindows && isWindowsRoot(relOrAbsPath) && (relOrAbsPath = relOrAbsPath.substring(1));

        // Resolve the path from the working directory. The file should always be resolved so that
        // cross os variations are mitigated
        let resolvedPath = this._path.resolve(this.workingDir, relOrAbsPath);

        // Check file is within working directory
        if (!this.insecureFileRead && // insecureFile read disabled
            !pathIsInside(resolvedPath, this.workingDir) && // File not inside working directory
            !_.includes(whiteList, resolvedPath)) { // File not in whitelist
            // Exit
            return undefined;
        }

        return resolvedPath;
    }

    /**
     * Asynchronous path resolver function
     *
     * @param {String} relOrAbsPath - Relative or absolute path to resolve
     * @param {Array} [whiteList] - A optional list of additional absolute path to whitelist
     * @param {Function} callback -
     */
    resolvePath (relOrAbsPath, whiteList, callback) {
        if (!callback && typeof whiteList === FUNCTION) {
            callback = whiteList;
            whiteList = [];
        }

        let resolvedPath = this._resolve(relOrAbsPath, _.concat(this.fileWhitelist, whiteList));

        if (!resolvedPath) {
            return callback(new Error(PPERM_ERR));
        }

        return callback(null, resolvedPath);
    }

    /**
     * Synchronous path resolver function
     *
     * @param {String} relOrAbsPath - Relative or absolute path to resolve
     * @param {Array} [whiteList] - A optional list of additional absolute path to whitelist
     *
     * @returns {String} The resolved path
     */
    resolvePathSync (relOrAbsPath, whiteList) {
        // Resolve the path from the working directory
        const resolvedPath = this._resolve(relOrAbsPath, _.concat(this.fileWhitelist, whiteList));

        if (!resolvedPath) {
            throw new Error(PPERM_ERR);
        }

        return resolvedPath;
    }

    /**
     * @override
     */
    stat (path, callback) {
        this.resolvePath(path, (err, resolvedPath) => {
            if (err) {
                return callback(err);
            }

            return this._fs.stat(resolvedPath, callback);
        });
    }

    /**
     * @override
     */
    createReadStream (path, options) {
        try {
            return this._fs.createReadStream(this.resolvePathSync(path), options);
        }
        catch (err) {
            // Create a fake read steam that emits and error and
            const ErrorReadStream = () => {
                // Replicating behavior of fs module of disabling emitClose on destroy
                Readable.call(this, { emitClose: false });

                // Emit the error event with insure file access error
                this.emit('error', new Error(PPERM_ERR));

                // Options exists and disables autoClose then don't destroy
                (options && !options.autoClose) || this.destroy();
            };

            util.inherits(ErrorReadStream, Readable);

            return new ErrorReadStream();
        }
    }
}


// Attach all functions in fs to postman-fs
Object.getOwnPropertyNames(fs).map((prop) => {
    // Bail-out early to prevent fs module from logging warning for deprecated,
    // experimental and overridden methods
    if (prop === DEPRECATED_SYNC_WRITE_STREAM || prop === EXPERIMENTAL_PROMISE ||
         typeof fs[prop] !== FUNCTION || SecureFS.prototype[prop]) {
        return;
    }

    SecureFS.prototype[prop] = fs[prop];
});


module.exports = SecureFS;
