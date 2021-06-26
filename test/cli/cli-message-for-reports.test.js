const { expect } = require('chai');


describe('CLI ', function () {
    it('should print the path of the report with a message when JSON or Junit reporters are used', function (done) {
        exec('node ./bin/newman.js run test/fixtures/run/single-get-request.json -r json',
            function (_code, stdout, stderr) {
                var message = stdout.split('/');

                expect(message[0]).to.eql('Report saved at newman');
                expect(stderr).to.be.empty;
                done();
            });
    });
});
