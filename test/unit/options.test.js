var _ = require('lodash'),
    options = require('../../lib/run/options');

describe('options', function () {
    describe('JSON with spaces', function () {
        it('should be handled correctly for collections', function (done) {
            var collection = require('../../test/fixtures/run/spaces/single-get-request.json');

            options({
                collection: './test/fixtures/run/spaces/single-get-request.json'
            }, function (err, result) {
                expect(err).to.be.null;

                // remove undefined properties
                result = JSON.parse(JSON.stringify(result.collection.toJSON()));
                expect(_.omit(result,
                    // eslint-disable-next-line max-len
                    ['event', 'info._postman_id', 'variable', 'item.0.id', 'item.0.response', 'item.0.event.0.script.id']))
                    .to.eql(collection);
                done();
            });
        });

        it('should be handled correctly for environments', function (done) {
            var environment = require('../../test/fixtures/run/spaces/simple-variables.json');

            options({
                environment: './test/fixtures/run/spaces/simple-variables.json'
            }, function (err, result) {
                expect(err).to.be.null;

                expect(_.omit(result.environment.toJSON(), 'id')).to.eql(environment);
                done();
            });
        });

        it('should be handled correctly for globals', function (done) {
            var globals = require('../../test/fixtures/run/spaces/simple-variables.json');

            options({
                globals: './test/fixtures/run/spaces/simple-variables.json'
            }, function (err, result) {
                expect(err).to.be.null;

                expect(_.omit(result.globals.toJSON(), 'id')).to.eql(globals);
                done();
            });
        });

        it('should be handled correctly for iterationData', function (done) {
            var data = require('../../test/fixtures/run/spaces/data.json');

            options({
                iterationData: './test/fixtures/run/spaces/data.json'
            }, function (err, result) {
                expect(err).to.be.null;
                expect(result.iterationData).to.eql(data);
                done();
            });
        });

        it('should be handled correctly for cookieJar', function (done) {
            var data = require('../../test/fixtures/run/spaces/simple-cookie-jar.json');

            options({
                cookieJar: './test/fixtures/run/spaces/simple-cookie-jar.json'
            }, function (err, result) {
                expect(err).to.be.null;
                expect(result.cookieJar.toJSON()).to.eql(data);
                done();
            });
        });
    });

    it('should have newmanVersion property by default', function (done) {
        var newmanVersion = require('../../package.json').version;

        options({}, function (err, result) {
            expect(err).to.be.null;
            expect(result).to.have.property('newmanVersion', newmanVersion);
            done();
        });
    });

    it('should set current directory as workingDir if not given', function (done) {
        options({}, function (err, result) {
            expect(err).to.be.null;
            expect(result).to.have.property('workingDir', process.cwd());
            done();
        });
    });

    it('should set insecureFileRead to true if not given', function (done) {
        options({}, function (err, result) {
            expect(err).to.be.null;
            expect(result).to.have.property('insecureFileRead', true);
            done();
        });
    });

    describe('option --exclude-folder', function () {
        var collection = {
            id: 'C1',
            name: 'Collection C1',
            item: [{
                id: 'ID1',
                name: 'R1',
                request: 'https://postman-echo.com/get'
            }, {
                id: 'ID2',
                name: 'R2',
                request: 'https://postman-echo.com/get'
            }, {
                id: 'ID3',
                name: 'R3',
                request: 'https://postman-echo.com/get'
            }]
        };

        it('should be undefined by default', function (done) {
            options({}, function (err, result) {
                expect(err).to.be.null;
                expect(result).to.have.property('excludeFolder').to.be.undefined;
                done();
            });
        });

        it('should use string when single folder is passed', function (done) {
            options({ excludeFolder: 'myFolder' }, function (err, result) {
                expect(err).to.be.null;
                expect(result).to.have.property('excludeFolder').to.eql('myFolder');
                done();
            });
        });

        it('should use array when multiple arguments are passed', function (done) {
            options({ excludeFolder: ['myFolder1', 'myFolder2'] }, function (err, result) {
                expect(err).to.be.null;
                expect(result).to.have.property('excludeFolder').to.eql(['myFolder1', 'myFolder2']);
                done();
            });
        });

        it('should exclude the specified requests in case multiple folder names are passed', function (done) {
            newman.run({
                collection: collection,
                excludeFolder: ['R1', 'R3']
            }, function (err, summary) {
                expect(err).to.be.null;
                expect(summary.run.stats.iterations.total, 'should have 1 iteration').to.equal(1);
                expect(summary.run.executions, 'should have 1 executions').to.have.lengthOf(1);
                expect(summary.run.executions.map((e) => { return e.item.name; })).to.eql(['R2']);
                done();
            });
        });
        it('should overrule the folder specified by --folder option in case of same arguments passed', function (done) {
            newman.run({
                collection: collection,
                excludeFolder: ['R1', 'R3'],
                folder: ['R1']
            }, function (err, summary) {
                expect(err).to.be.null;
                expect(summary.run.stats.iterations.total, 'should have 0 iteration').to.equal(0);
                expect(summary.run.executions, 'should have 0 executions').to.have.lengthOf(0);
                done();
            });
        });
    });
});
