var newmanVersion = require('../../package.json').version;

describe('CLI run options', function () {
    it('should work correctly without any extra options', function (done) {
        exec('node ./bin/newman.js run test/fixtures/run/single-get-request.json', done);
    });

    it('should display the current Newman version with `--version`', function (done) {
        exec('node ./bin/newman.js --version', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 0').to.equal(0);
            expect(stdout).to.equal(`${newmanVersion}\n`);
            expect(stderr).to.equal('');
            done();
        });
    });

    it('should display the current Newman version with `-v`', function (done) {
        exec('node ./bin/newman.js -v', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 0').to.equal(0);
            expect(stdout).to.equal(`${newmanVersion}\n`);
            expect(stderr).to.equal('');
            done();
        });
    });

    it('should display help message if no arguments are provided', function (done) {
        exec('node ./bin/newman.js', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 1').to.equal(1);
            expect(stderr).to.match(/Usage: newman*/);
            expect(stdout).to.equal('');
            done();
        });
    });

    it('should not work without a collection', function (done) {
        exec('node ./bin/newman.js run -e test/fixtures/run/simple-variables.json',
            function (code) {
                expect(code, 'should have exit code of 1').to.equal(1);
                done();
            });
    });

    it('should not work without any options', function (done) {
        exec('node ./bin/newman.js run', function (code) {
            expect(code, 'should have exit code of 1').to.equal(1);
            done();
        });
    });

    it('should fail a collection run with undefined test cases', function (done) {
        exec('node ./bin/newman.js run test/fixtures/run/undefined-test-checks.json', function (code) {
            expect(code, 'should have exit code of 1').to.equal(1);
            done();
        });
    });

    it('should handle invalid collection URLs correctly', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run https://api.getpostman.com/collections/my-collection-uuid?apikey=my-secret-api-key', function (code) {
            expect(code, 'should have exit code of 1').to.equal(1);
            done();
        });
    });

    it('should correctly work with global variable overrides passed with --global-var', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/integration/steph/steph.postman_collection.json --global-var first=James --global-var last=Bond', function (code) {
            expect(code, 'should have exit code of 0').to.equal(0);
            done();
        });
    });

    it('should throw an error for missing --global-var values', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/integration/steph/steph.postman_collection.json --global-var', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 1').to.equal(1);
            expect(stderr).to.equal('error: option \'--global-var <value>\' argument missing\n');
            done();
        });
    });

    it('should correctly work with environment variable overrides passed with --env-var', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/fixtures/overrides/pmcollection.json --env-var dummyVar=bar2', function (code) {
            expect(code, 'should have exit code of 0').to.equal(0);
            done();
        });
    });

    it('should throw an error for missing --env-var values', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/fixtures/overrides/pmcollection.json --env-var', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 1').to.equal(1);
            expect(stderr).to.equal('error: option \'--env-var <value>\' argument missing\n');
            done();
        });
    });

    it('should log a warning if the v1 collection format is used', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/integration/multi-level-folders-v1.postman_collection.json', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 0').to.equal(0);
            expect(stderr).to.equal('newman: Newman v4 deprecates support for the v1 collection format\n' +
                '  Use the Postman Native app to export collections in the v2 format\n\n');

            done();
        });
    });

    it('should work correctly with --exclude-folder option when specified', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/integration/exclude-folder-variant/exclude-folder-tests.postman_collection.json --exclude-folder R1', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 0').to.equal(0);
            expect(stderr).to.equal('');
            done();
        });
    });

    it('should work correctly with --exclude-folder when more than 1 folder is specified', function (done) {
        // eslint-disable-next-line max-len
        exec('node ./bin/newman.js run test/integration/exclude-folder-variant/exclude-folder-tests.postman_collection.json --exclude-folder R1 --exclude-folder R2', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 0').to.equal(0);
            expect(stderr).to.equal('');
            done();
        });
    });

    describe('script timeouts', function () {
        it('should be handled correctly when breached', function (done) {
            // eslint-disable-next-line max-len
            exec('node ./bin/newman.js run test/integration/timeout/timeout.postman_collection.json --timeout-script 5', function (code) {
                // .to.be.(1) is not used as the windows exit code can be an arbitrary non-zero value
                expect(code, 'should have non-zero exit code').to.be.above(0);
                done();
            });
        });

        it('should be handled correctly when not breached', function (done) {
            // eslint-disable-next-line max-len
            exec('node ./bin/newman.js run test/integration/timeout/timeout.postman_collection.json --timeout-script 500', function (code) {
                expect(code, 'should have exit code of 0').to.equal(0);
                done();
            });
        });
    });
});
