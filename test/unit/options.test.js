const { expect } = require('chai');
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
});

describe('Option --item-from-folder', function () {
    it('should be undefined by default', function (done) {
        options({}, function (err, result) {
            expect(err).to.be.null;
            expect(result.itemFromFolder).to.be.undefined;
            done();
        });
    });

    it('should handle options.itemFromFolder passed as string correctly', function (done) {
        options({ itemFromFolder: 'f1' }, function (err, result) {
            expect(err).to.be.null;
            expect(result.itemFromFolder).to.eql('f1');
            done();
        });
    });

    it('should use multipleIdOrName strategy if options.itemFromFolder is passed as an array', function (done) {
        options({ itemFromFolder: ['f1', 'f2'] }, function (err, result) {
            expect(err).to.be.null;
            expect(result.itemFromFolder).to.eql(['f1', 'f2']);
            done();
        });
    });
});

