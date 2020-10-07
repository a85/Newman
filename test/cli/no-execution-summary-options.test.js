var fs = require('fs'),

    _ = require('lodash'),
    sh = require('shelljs');

describe('executionSummary option', function () {
    var outDir = 'out',
        outFile = outDir + '/newman-report.json';

    beforeEach(function () {
        sh.test('-d', outDir) && sh.rm('-rf', outDir);
        sh.mkdir('-p', outDir);
    });

    afterEach(function () {
        sh.rm('-rf', outDir);
    });

    it('when executionsSummary option specified should not add executions in the result', function (done) {
        // eslint-disable-next-line max-len
        exec(`node ./bin/newman.js run test/fixtures/run/single-get-request.json -r json --reporter-json-export ${outFile} --no-executions-summary`,
            function (code) {
                expect(code, 'should have exit code of 0').to.equal(0);
                fs.readFile(outFile, function (err, data) {
                    expect(err).to.not.be.ok;
                    const jsonReport = JSON.parse(data),
                        executions = jsonReport.run.executions;

                    expect(jsonReport).to.have.property('run');
                    expect(_.keys(jsonReport.run).sort())
                        .to.eql(['stats', 'timings', 'executions', 'transfers', 'failures', 'error'].sort());
                    expect(executions).to.be.an('array');
                    expect(executions, 'should have 0 executions').to.have.lengthOf(0);
                    done();
                });
            });
    });

    it('when executionsSummary option not specified should add executions in the result', function (done) {
        // eslint-disable-next-line max-len
        exec(`node ./bin/newman.js run test/fixtures/run/single-get-request.json -r json --reporter-json-export ${outFile}`,
            function (code) {
                expect(code, 'should have exit code of 0').to.equal(0);
                fs.readFile(outFile, function (err, data) {
                    expect(err).to.not.be.ok;
                    const jsonReport = JSON.parse(data),
                        executions = jsonReport.run.executions;

                    expect(jsonReport).to.have.property('run');
                    expect(_.keys(jsonReport.run).sort())
                        .to.eql(['stats', 'timings', 'executions', 'transfers', 'failures', 'error'].sort());
                    expect(executions).to.be.an('array');
                    expect(executions, 'should have 1 executions').to.have.lengthOf(1);
                    done();
                });
            });
    });
});
