const _ = require('lodash'),
    reporters = [];


module.exports = {

    cast: {
        /**
         * Helper to coerce number like strings into integers.
         * Perform safety checks, and return the result.
         *
         * @param {String} arg - The stringified number argument.
         * @returns {Number} - The supplied argument, casted to an integer.
         */
        integer: (arg) => {
            const num = Number(arg);

            if (!_.isSafeInteger(num) || num <= 0) {
                throw new Error('The value must be a positive integer.');
            }

            return num.valueOf();
        },

        /**
         * Helper for collecting argument passed multiple times.
         *
         * --folder f1 --folder f2
         *
         * @param {String} val - The argument value.
         * @param {String[]} memo - The array that is populated by argument values.
         * @returns {String[]} - The array of argument values collected.
         */
        memoize: (val, memo) => {
            memo.push(val);

            return memo;
        },

        /**
         * Helper for collecting argument passed multiple times as key=value.
         *
         * --global-var "foo=bar" --global-var "alpha=beta"
         *
         * @param {String} val - The argument value, passed as key=value.
         * @param {Array} memo - The array that is populated by key value pairs.
         * @returns {Array} - [{key, value}] - The object representation of the current CLI variable.
         */
        memoizeKeyVal: (val, memo) => {
            let arg,
                eqIndex = val.indexOf('=');

            // This is done instead of splitting by `=` to avoid chopping off `=` that could be present in the value
            arg = eqIndex !== -1 ? {
                key: val.slice(0, eqIndex),
                value: val.slice(eqIndex + 1)
            } : {
                key: val,
                value: undefined
            };

            memo.push(arg);

            return memo;
        },

        /**
         * Helper to coerce comma separated string to an array.
         *
         * eg. item1,item2
         *
         * @param {String} list - The comma separated string.
         * @returns {String[]} - [item1, item2] - The array representation of the passed string.
         */
        csvParse: (list) => {
            return _.split(list, ',');
        },

        /**
         * Helper to parse variadic parameters for reporters to an array.
         *
         * eg. item1,item2
         *
         * @param {String} list - The comma separated parameters.
         * @returns {String[]} - [item1, item2] - The array representation of the passed parameters.
         */
        reporterParse: (list) => {
            if (list.includes(',')) {
                list.split(',').forEach((name) => {
                    if (name.length) {
                        reporters.push(name);
                    }
                });
            }
            else {
                reporters.push(list);
            }

            return reporters;
        },

        colorOptions: (value) => {
            if (!(/^(auto|on|off)$/).test(value)) {
                throw new Error(`invalid value \`${value}\` for --color. Expected: auto|on|off`);
            }

            return value;
        }
    },

    /**
     * Extract selected options in the provided command.
     * Omits commander private variables and other objects.
     *
     * @param {Object} command - Commander.Command Instance
     * @returns {Object} - Extracted options from command
     */
    commanderToObject: (command) => {
        return _.reduce(command, (result, value, key) => {
            // Exclude command's private `_` variables and other objects
            const validProp = !_.startsWith(key, '_') && !_.includes(['commands', 'options', 'parent'], key);

            validProp && (result[key] = value);

            return result;
        }, {});
    },

    /**
     * Remove nested options having the provided prefix from `process.argv`.
     *
     * @param {String[]} argv - Argument vector.
     * @param {String} optionPrefix - Argument prefix to search for.
     * @returns {String[]} - All arguments without prefixed options and their values
     */
    omitNestedOptions: (argv, optionPrefix) => {
        let args = [],
            len,
            i;

        for (i = 0, len = argv.length; i < len; i++) {
            if (!_.startsWith(argv[i], optionPrefix)) {
                args.push(argv[i]);
                continue;
            }

            // For prefixed args also omit its value, --prefix-arg value
            if (argv[i + 1] && !_.startsWith(argv[i + 1], '-')) {
                ++i;
            }
        }

        return args;
    },

    /**
     * Parse nested options having the provided prefix from `process.argv`.
     *
     * @param {String[]} argv - Argument vector.
     * @param {String} optionPrefix - Argument prefix to search for.
     * @param {String[]} options - Selected options.
     * @returns {Object} Parsed object with nested options.
     *
     * @example
     * let argv = ['--reporters=json,html', '--reporter-html-template=template.hb', '--reporter-export=path'],
     *     options = ['json', 'html'];
     * parseNestedOptions(argv, '--reporter-', options);
     * //returns
     * {
     *   _generic: { export: path },
     *   html: { template: template.hb },
     *   json: {}
     * }
     *
     */
    parseNestedOptions: (argv, optionPrefix, options) => {
        let args = [],
            parsed = { _generic: {} },
            name,
            path,
            len,
            eqIndex,
            i;

        // Extract prefixed arguments from argv
        for (i = 0, len = argv.length; i < len; i++) {
            const arg = argv[i];

            if (!_.startsWith(arg, optionPrefix)) { continue; } // skip non-prefixed args

            eqIndex = arg.indexOf('=');

            if (eqIndex !== -1) {
                // Split the attribute if its like key=value
                args.push(arg.slice(0, eqIndex), arg.slice(eqIndex + 1));
            }
            else if (argv[i + 1] && !_.startsWith(argv[i + 1], '-')) {
                // Also push the next parameter if it's not an option.
                args.push(arg, argv[++i]);
            }
            else {
                args.push(arg);
            }
        }

        // ensure that whatever option is provided a blank options object is forwarded
        _.forEach(options, (option) => { parsed[option] = {}; });
        // Parse nested options
        for (i = 0, len = args.length; i < len; i++) {
            const arg = args[i].replace(optionPrefix, '');

            name = _.split(arg, '-', 1)[0]; // eg. `cli` in --reporter-cli-silent

            // if we have a valid option, the path should be the <name>.camelCaseOfTheRest
            // otherwise, we add it to the generic options.
            path = _.includes(options, name) ?
                [name, _.camelCase(arg.replace(name + '-', ''))].join('.') :
                ['_generic', _.camelCase(arg)].join('.');

            // If the next arg is an option, set the current arg to true,
            // otherwise set it to the next arg.
            _.set(parsed, path, (!args[i + 1] || _.startsWith(args[i + 1], '-')) ? true : args[++i]);
        }

        return parsed;
    }

};
