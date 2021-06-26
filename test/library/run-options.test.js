var _ = require('lodash'),
    runtimeVersion = require('../../package.json').dependencies['postman-runtime'],
    path = require('path'),
    fs = require('fs');

describe('Newman run options', function () {
    var collection = 'test/fixtures/run/single-get-request.json';

    it('should work correctly without any extra options', function (done) {
        newman.run({
            collection
        }, done);
    });

    it('should correctly send the test name as a part of error information for failed assertions', function (done) {
        newman
            .run({
                collection: 'test/fixtures/run/single-request-failing.json'
            }, done)
            .on('assertion', function (err) {
                expect(err).to.be.ok;
                expect(err).to.have.property('name', 'AssertionError');
                expect(err).to.have.property('index', 0);
                expect(err).to.have.property('test', 'response code is 200');
                expect(err).to.have.property('message', 'expected false to be truthy');
                expect(err).to.have.property('stack');
            });
    });

    it('should not work without a collection', function (done) {
        newman.run({
            environment: 'test/fixtures/run/simple-variables.json'
        }, function (err) {
            expect(err).to.be.ok;
            expect(err.message).to.eql('expecting a collection to run');
            done();
        });
    });

    it('should not work with empty options', function (done) {
        newman.run({}, function (err) {
            expect(err).to.be.ok;
            expect(err.message).to.eql('expecting a collection to run');
            done();
        });
    });

    it('should fail a collection run with undefined test cases', function (done) {
        newman.run({
            collection: 'test/fixtures/run/undefined-test-checks.json'
        }, function (err, summary) {
            if (err) { return done(err); }

            expect(summary.run.failures, 'should have 1 failure').to.have.a.lengthOf(1);
            expect(summary.run.failures[0].error).to.have.property('name', 'AssertionError');

            done();
        });
    });

    it('should accept iterationData as an array of objects', function (done) {
        newman.run({
            collection: 'test/integration/steph/steph.postman_collection.json',
            iterationData: require('../integration/steph/steph.postman_data.json')
        }, function (err, summary) {
            expect(err).to.not.be.ok;
            expect(summary.run.failures).to.be.empty;
            done();
        });
    });

    it('should correctly handle a multitude of responses', function (done) {
        newman.run({
            collection: 'test/fixtures/run/response-bodies.json'
        }, function (err, summary) {
            expect(err).to.not.be.ok;
            expect(summary.run.failures).to.be.empty;

            var executions = summary.run.executions,
                response = executions[0].response.json(),
                postmanToken = _.get(response, 'headers.postman-token');

            expect(executions, 'should have 3 executions').to.have.lengthOf(3);
            expect(response).to.have.property('args')
                .that.eql({ source: 'newman-sample-github-collection' });
            expect(response).to.have.property('url')
                .that.eql('https://postman-echo.com/get?source=newman-sample-github-collection');
            expect(response).to.have.property('headers').that.include({
                host: 'postman-echo.com',
                accept: '*/*',
                'cache-control': 'no-cache',
                'postman-token': postmanToken,
                'accept-encoding': 'gzip, deflate, br',
                'user-agent': `PostmanRuntime/${runtimeVersion}` // change this when runtime is bumped
            });
            // eslint-disable-next-line max-len
            expect(executions[1].response.text()).to.equal('<!DOCTYPE html><html><head><title>Hello World!</title></head><body><h1>Hello World!</h1></body></html>');
            // eslint-disable-next-line max-len
            expect(executions[2].response.text()).to.eql('<?xml version="1.0" encoding="utf-8"?><food><key>Homestyle Breakfast</key><value>950</value></food>');

            done();
        });
    });

    it('should correctly handle invalid collection URLs', function (done) {
        newman.run({
            collection: 'https://api.getpostman.com/collections/my-collection-uuid?apikey=my-secret-api-key'
        }, function (err, summary) {
            expect(err).to.be.ok;
            expect(err.message).to.equal('collection could not be loaded\n' +
                '  Error fetching the collection from the provided URL. Ensure that the URL is valid.\n' +
                '  Invalid API Key. Every request requires a valid API Key to be sent.');
            expect(summary).to.not.be.ok;

            done();
        });
    });

    it('should correctly handle invalid iteration data', function (done) {
        newman.run({
            collection: 'test/fixtures/run/failed-request.json',
            iterationData: 3.14
        }, function (err, summary) {
            expect(err).to.be.ok;
            expect(err.message).to.include('iteration data could not be loaded\n' +
                '  ENOENT: no such file or directory, open \'');
            expect(summary).to.not.be.ok;

            done();
        });
    });

    describe('bail modifiers', function () {
        it('should skip collection run in case of error when folder is specified', function (done) {
            newman.run({
                collection: 'test/fixtures/run/failed-request.json',
                bail: ['folder']
            }, function (err) {
                expect(err).to.be.ok;
                expect(err.message).to.include('getaddrinfo ENOTFOUND 123.random.z');

                done();
            });
        });

        it('should gracefully stop a collection run in case of error with no additional modifiers', function (done) {
            newman.run({
                collection: 'test/fixtures/run/failed-request.json',
                bail: true
            }, function (err) {
                expect(err).to.not.be.ok;

                done();
            });
        });

        it('should skip collection run in case of error when both folder and failure are specified', function (done) {
            newman.run({
                collection: 'test/fixtures/run/failed-request.json',
                folder: 'invalidName',
                bail: ['folder', 'failure']
            }, function (err) {
                expect(err).to.be.ok;
                expect(err.message).to.equal('Unable to find a folder or request: invalidName');

                done();
            });
        });
    });

    describe('script timeouts', function () {
        // @todo: Unskip this when the underlying runtime behaviour has been fixed
        it.skip('should be handled correctly when breached', function (done) {
            newman.run({
                collection: 'test/integration/timeout/timeout.postman_collection.json',
                timeoutScript: 5
            }, function (err, summary) {
                expect(err.message).to.equal('Script execution timed out.');
                expect(summary).to.be.ok;
                done();
            });
        });

        it('should be handled correctly when not breached', function (done) {
            newman.run({
                collection: 'test/integration/timeout/timeout.postman_collection.json',
                timeoutScript: 500
            }, function (err, summary) {
                expect(err).to.be.null;
                expect(summary).to.be.ok;
                done();
            });
        });
    });

    describe('request timeouts', function () {
        // @todo: Unskip this when the underlying runtime behaviour has been fixed
        it.skip('should be handled correctly when breached', function (done) {
            newman.run({
                collection: 'test/integration/timeout/timeout.postman_collection.json',
                timeoutRequest: 500
            }, function (err, summary) {
                expect(err.message).to.equal('ESOCKETTIMEDOUT');
                expect(summary).to.be.ok;
                done();
            });
        });

        it('should be handled correctly when not breached', function (done) {
            newman.run({
                collection: 'test/integration/timeout/timeout.postman_collection.json',
                timeoutRequest: 5000
            }, function (err, summary) {
                expect(err).to.be.null;
                expect(summary).to.be.ok;
                done();
            });
        });
    });

    describe('global timeouts', function () {
        it('should be handled correctly when breached', function (done) {
            newman.run({
                collection: 'test/integration/timeout/timeout.postman_collection.json',
                timeout: 1000
            }, function (err, summary) {
                expect(err.message).to.equal('callback timed out');
                expect(summary).to.be.ok;
                done();
            });
        });

        it('should be handled correctly when not breached', function (done) {
            newman.run({
                collection: 'test/integration/timeout/timeout.postman_collection.json',
                timeout: 10000
            }, function (err, summary) {
                expect(err).to.be.null;
                expect(summary).to.be.ok;
                done();
            });
        });
    });

    describe('Option --ignore-iteration ', function () {
        var iterationProperty = 'run.stats.iterations.total',
            collectionRunPath = path.join(__dirname, '..', '..', 'out', 'iteration-count-test.json');

        it('should work correctly when specified', function (done) {
            newman.run({
                collection: 'test/integration/steph/steph.postman_collection.json',
                iterationData: 'test/integration/steph/steph.postman_data.json',
                reporters: ['json'],
                reporter: { json: { export: collectionRunPath } },
                ignoreIteration: 1
            }, function (err) {
                if (err) { return done(err); }

                var collectionRun;

                try { collectionRun = JSON.parse(fs.readFileSync(collectionRunPath).toString()); }
                catch (e) { console.error(e); }

                expect(_.get(collectionRun, iterationProperty), 'should have 1 iterations').to.equal(1);
                done();
            });
        });
    });
});
