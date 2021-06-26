/**
 * @fileOverview A sample script to demonstrate parallel collection runs using async. 
 */
var path = require('path'), // ensures that the path is consistent, regardless of where the script is run from

    async = require('async'), // https://npmjs.org/package/async 
    newman = require('../'), // change to require('newman'), if using outside this repository

    /**
     * A set of collection run options for the paralle collection runs. For demonstrative purposes in this script, an
     * identical set of options has been used. However, different options can be used, so as to actually run different
     * collections, with their corresponding run options in parallel.
     * 
     * @type {Object}
     */
    options = {
        collection: path.join(__dirname, 'sample-collection.json')
    },

    /**
     * A collection runner function that runs a collection for a pre-determined options object.
     *
     * @param {Function} done - A callback function that marks the end of the current collection run, when called.
     */
    parallelCollectionRun = function (done) {
        newman.run(options, done);
    };
 
// Runs the Postman sample collection thrice, in parallel.
async.parallel([
    parallelCollectionRun,
    parallelCollectionRun,
    parallelCollectionRun
],

/**
 * The
 *
 * @param {?Error} err - An Error instance / null that determines whether or not the parallel collection run
 * succeeded.
 * @param {Array} results - An array of collection run summary objects.
 */
function (err, results) {
    err && console.error(err);

    results.forEach(function (result) {
        var failures = result.run.failures;

        console.info(failures.length ? JSON.stringify(failures.failures, null, 2) :
            `${result.collection.name} ran successfully.`);
    });
});
