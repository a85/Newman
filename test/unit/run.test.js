var _ = require('lodash'),
    path = require('path'),
    async = require('async'),
    sinon = require('sinon'),
    sdk = require('postman-collection'),
    runtime = require('postman-runtime');

describe('run module', function () {
    var run = require('../../lib/run');

    it('should export a function', function () {
        expect(run).to.be.a('function');
    });

    it('should start a run with no options and return error in callback', function (done) {
        expect(function () {
            run(function (err) {
                expect(err).to.be.ok;
                expect(err.message).to.equal('expecting a collection to run');
                done();
            });
        }).to.not.throw();
    });

    it('should error out if collection is absent in options', function (done) {
        expect(function () {
            run({}, function (err) {
                expect(err).be.ok;
                expect(err && err.message).to.equal('expecting a collection to run');

                done();
            });
        }).to.not.throw();
    });

    // @todo enable when the v1 collection format support is dropped in Newman v5.
    it.skip('should error out if v1 collection is passed', function (done) {
        const v1Collection = {
            id: 'a4f4a069-00a2-4f70-a792-513877241083',
            name: 'C1',
            order: ['3e5349fa-a259-4ac2-a920-b694e6f8c1e6'],
            requests: [{
                id: '3e5349fa-a259-4ac2-a920-b694e6f8c1e6',
                name: 'R1',
                collectionId: '5adbd3b7-80cb-43cc-bf1e-8578ab3c9b15',
                method: 'GET',
                url: 'https://postman-echo.com/get',
                responses: [],
                pathVariableData: [],
                queryParams: [],
                headerData: []
            }]
        };

        run({
            collection: v1Collection
        }, function (err) {
            expect(err).be.ok;
            expect(err).to.have.property('message', 'Newman >= v5 does not support the v1 collection format');
            expect(err).to.have.property('friendly',
                'Use the Postman Native app to export collections in the v2 format');
            done();
        });
    });

    it('should start a run with empty collection as plain object', function (done) {
        expect(function () {
            run({
                collection: {}
            }, done);
        }).to.not.throw();
    });

    it('should start a run with empty collection as SDK instance', function (done) {
        expect(function () {
            run({
                collection: new sdk.Collection()
            }, done);
        }).to.not.throw();
    });

    it('should provide sdk instances as part of the run', function (done) {
        expect(function () {
            run({
                collection: {}
            }, function (err, newman) {
                if (err) {
                    return done(err);
                }

                expect(newman).to.be.an('object');
                expect(newman).to.have.property('collection');
                expect(newman).to.have.property('environment');
                expect(newman).to.have.property('globals');

                expect(newman.collection,
                    'should be an instance of PostmanCollection').to.be.an.instanceof(sdk.Collection);
                expect(newman.environment,
                    'should be an instance of PostmanVariableScope').to.be.an.instanceof(sdk.VariableScope);
                expect(newman.globals,
                    'should be an instance of PostmanVariableScope').to.be.an.instanceof(sdk.VariableScope);

                done();
            });
        }).to.not.throw();
    });

    it('should retain sdk references from options', function (done) {
        var options = {
            collection: new sdk.Collection(),
            environment: new sdk.VariableScope(),
            globals: new sdk.VariableScope()
        };

        expect(function () {
            run(options, function (err, newman) {
                if (err) {
                    return done(err);
                }

                expect(_.omit(newman.collection.toJSON(), '_')).to.eql(options.collection.toJSON());
                expect(newman.environment).to.eql(options.environment);
                expect(newman.globals).to.eql(options.globals);

                done();
            });
        }).to.not.throw();
    });

    it('should gracefully send error to callback on garbage collection', function (done) {
        async.parallel([
            function (next) {
                expect(function () {
                    run({
                        collection: null
                    }, function (err) {
                        expect(err).be.ok;
                        expect(err && err.message).to.equal('expecting a collection to run');
                        next();
                    });
                }).to.not.throw();
            },
            function (next) {
                expect(function () {
                    run({
                        collection: 3.14
                    }, function (err) {
                        expect(err).be.ok;
                        expect(err && err.message).to.equal('collection could not be loaded');
                        next();
                    });
                }).to.not.throw();
            },
            function (next) {
                expect(function () {
                    run({
                        collection: 'abcd'
                    }, function (err) {
                        expect(err).be.ok;
                        expect(err && err.message).to.include('collection could not be loaded\n' +
                            '  unable to read data from file "abcd"\n' +
                            '  ENOENT: no such file or directory, open \'');
                        next();
                    });
                }).to.not.throw();
            }
        ], done);
    });

    it('should gracefully send error to callback on garbage iterationData', function (done) {
        async.parallel([
            function (next) {
                expect(function () {
                    run({
                        collection: {},
                        iterationData: 'xyz'
                    }, function (err) {
                        expect(err).be.ok;
                        expect(err && err.message).to.include('iteration data could not be loaded\n' +
                            '  ENOENT: no such file or directory, open \'');
                        next();
                    });
                }).to.not.throw();
            },
            function (next) {
                expect(function () {
                    run({
                        collection: {},
                        iterationData: 'http://'
                    }, function (err) {
                        expect(err).be.ok;
                        expect(err && err.message).to.equal('iteration data could not be loaded\n' +
                            '  Invalid URI "http:///"');
                        next();
                    });
                }).to.not.throw();
            }
        ], done);
    });

    // @todo: run tests with exec and nock instead
    it('should correctly resolve conflicts between iterationData.length and iterationCount', function (done) {
        this.timeout(10000); // set 10s timeout

        var testData = path.join(__dirname, '..', 'fixtures', 'run', 'test-data.postman_data.json'),
            testCollection = path.join(__dirname, '..', 'fixtures', 'run', 'single-get-request.json');

        async.parallel([
            // collection run with neither iterationData, nor iterationCount specified
            function (next) {
                expect(function () {
                    run({
                        collection: testCollection
                    }, function (err, summary) {
                        expect(err).to.be.null;
                        expect(summary.run.stats.iterations.total).to.equal(1);
                        next();
                    });
                }).to.not.throw();
            },
            // collection run with iterationData, but no iterationCount specified
            function (next) {
                expect(function () {
                    run({
                        collection: testCollection,
                        iterationData: testData
                    }, function (err, summary) {
                        expect(err).to.be.null;
                        expect(summary.run.stats.iterations.total).to.equal(2);
                        next();
                    });
                }).to.not.throw();
            },
            // collection run with iterationCount, but no iterationData specified
            function (next) {
                expect(function () {
                    run({
                        collection: testCollection,
                        iterationCount: 2
                    }, function (err, summary) {
                        expect(err).to.be.null;
                        expect(summary.run.stats.iterations.total).to.equal(2);
                        next();
                    });
                }).to.not.throw();
            },
            // collection run with both iterationData and iterationCount specified
            function (next) {
                expect(function () {
                    run({
                        collection: testCollection,
                        iterationData: testData,
                        iterationCount: 3
                    }, function (err, summary) {
                        expect(err).to.be.null;
                        expect(summary.run.stats.iterations.total).to.equal(3);
                        next();
                    });
                }).to.not.throw();
            }
        ], done);
    });

    describe('Runner.run options', function () {
        before(function () {
            // stub runtime.Runner and override `run` to return options argument as error to stop further execution.
            sinon.stub(runtime, 'Runner').prototype.run = (collection, options, callback) => {
                callback(options);
            };
        });

        after(function () {
            runtime.Runner.restore();
        });

        describe('entrypoint', function () {
            it('should be undefined by default', function (done) {
                run({ collection: {} }, function (options) {
                    expect(options).to.have.property('entrypoint').to.be.undefined;
                    done();
                });
            });

            it('should handle options.folder passed as string correctly', function (done) {
                run({ collection: {}, folder: 'f1', preserveOrder: false }, function (options) {
                    expect(options).to.have.deep.property('entrypoint', { execute: 'f1', preserveOrder: false });
                    done();
                });
            });

            it('should use multipleIdOrName strategy if options.folder is passed as an array', function (done) {
                run({ collection: {}, folder: ['f1', 'f2'], preserveOrder: true }, function (options) {
                    expect(options).to.have.deep.property('entrypoint', {
                        execute: ['f1', 'f2'],
                        lookupStrategy: 'multipleIdOrName',
                        preserveOrder: true
                    });
                    done();
                });
            });

            it('should not use multipleIdOrName strategy if options.folder is a single item array', function (done) {
                run({ collection: {}, folder: ['f1'], preserveOrder: false }, function (options) {
                    expect(options).to.have.property('entrypoint').to.eql({ execute: 'f1', preserveOrder: false });
                    done();
                });
            });
        });
    });
});
