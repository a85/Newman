var _ = require('lodash');

/**
 * Reporter that simply dumps the summary object to file (default: newman-run-report.json).
 *
 * @param {Object} newman - The collection run object, with event hooks for reporting run details.
 * @param {Object} options - A set of collection run options.
 * @param {String} options.export - The path to which the summary object must be written.
 * @param {Boolean} options.skipResponses - Do not log responses into the output file.
 * @returns {*}
 */
module.exports = function (newman, options) {
    newman.on('beforeDone', function (err, o) {
        if (err) { return; }
        var output = {},
            summaryClone;

        if (options.skipResponses) {
            // Clone the summary object and remove the responses before JSON.stringify()
            summaryClone = _.cloneDeep(_.omit(o.summary, 'exports'));
            summaryClone.run.executions = _.map(summaryClone.run.executions, function (item) {
                return _.omit(item, 'response');
            });
            output = JSON.stringify(summaryClone, 0, 2);
        }
        else {
            output = JSON.stringify(_.omit(o.summary, 'exports'), 0, 2);
        }
        newman.exports.push({
            name: 'json-reporter',
            default: 'newman-run-report.json',
            path: options.export,
            content: output
        });
    });
};
