describe('Newman request options', function () {
    var getRequestCurl = 'curl -X GET https://postman-echo.com/get';

    it('should work correctly without any extra options', function (done) {
        newman.request({ curl: getRequestCurl }, done);
    });

    it('should not work with empty options', function (done) {
        newman.request({}, function (err) {
            expect(err).to.be.ok;
            expect(err.message).to.eql('expecting a valid curl command to run');
            done();
        });
    });
});
