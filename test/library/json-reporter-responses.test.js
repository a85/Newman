var fs = require('fs'),
    _ = require('lodash');

describe('JSON reporter', function () {
    var outFile = 'out/newman-report.json';

    beforeEach(function (done) {
        fs.stat('out', function (err) {
            if (err) {
                return fs.mkdir('out', done);
            }

            done();
        });
    });

    afterEach(function (done) {
        fs.stat(outFile, function (err) {
            if (err) {
                return done();
            }

            fs.unlink(outFile, done);
        });
    });

    it('should correctly export json with API response ', function (done) {
        newman.run({
            collection: 'test/fixtures/run/single-get-request.json',
            reporters: ['json'],
            reporter: { json: { export: outFile } }
        }, function (err) {
            if (err) { return done(err); }
            fs.readFile(outFile, 'utf8', function (err, contents) {
                expect(err).to.be.null;
                var report = JSON.parse(contents);

                expect(_.has(report.run.executions[0], 'response')).to.be.true;
                done();
            });
        });
    });

    it('should correctly export json without API response ', function (done) {
        newman.run({
            collection: 'test/fixtures/run/single-get-request.json',
            reporters: ['json'],
            reporter: { json: { export: outFile, skipResponses: true } }
        }, function (err) {
            if (err) { return done(err); }
            fs.readFile(outFile, 'utf8', function (err, contents) {
                expect(err).to.be.null;
                var report = JSON.parse(contents);

                expect(_.has(report.run.executions[0], 'response')).to.be.false;
                done();
            });
        });
    });
});
