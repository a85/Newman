const fs = require('fs');
const _ = require('lodash');

describe('JSON reporter tests', function () {
    const outFile = 'out/newman-report.json';

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
        // eslint-disable-next-line max-len
        exec(`node ./bin/newman.js run test/fixtures/run/single-get-request.json -r json --reporter-json-export ${outFile}`, function (code) {
            expect(code, 'should have exit code of 0').to.equal(0);

            fs.readFile(outFile, 'utf8', function (err, contents) {
                expect(err).to.be.null;
                var report = JSON.parse(contents);

                expect(_.has(report.run.executions[0], 'response')).to.be.true;
                done();
            });
        });
    });

    it('should correctly export json without API response ', function (done) {
        // eslint-disable-next-line max-len
        exec(`node ./bin/newman.js run test/fixtures/run/single-get-request.json -r json --reporter-json-export ${outFile} --reporter-json-skip-responses`, function (code) {
            expect(code, 'should have exit code of 0').to.equal(0);

            fs.readFile(outFile, 'utf8', function (err, contents) {
                expect(err).to.be.null;
                var report = JSON.parse(contents);

                expect(_.has(report.run.executions[0], 'response')).to.be.false;
                done();
            });
        });
    });
});
