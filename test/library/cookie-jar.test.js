var path = require('path'),
    fs = require('fs'),
    sh = require('shelljs'),
    CookieJar = require('tough-cookie').CookieJar;

describe('newman.run cookieJar', function () {
    var cookieJar = new CookieJar(),
        cookieJarPath = 'test/fixtures/run/spaces/simple-cookie-jar.json',
        collection = 'test/integration/cookie-jar.postman_collection.json';

    it('should correctly persist cookies across requests in a run', function (done) {
        newman.run({
            collection
        }, function (err, summary) {
            expect(err).to.be.null;

            expect(summary.run.executions[0].response.cookies.reference).to.be.empty;
            expect(summary.run.executions[0].request.headers.get('cookie')).to.match(/foo=bar;/);

            expect(summary.run.executions[1].response.cookies.reference).to.be.empty;
            expect(summary.run.executions[1].request.headers.get('cookie')).to.match(/foo=bar;/);

            done();
        });
    });

    it('should persist cookies in custom cookie jar', function (done) {
        newman.run({
            collection,
            cookieJar
        }, function (err) {
            expect(err).to.be.null;

            var cookies = cookieJar.getCookieStringSync('http://postman-echo.com/');

            expect(cookies).to.match(/foo=bar;/);

            done();
        });
    });

    it('should load cookies from cookie jar file', function (done) {
        newman.run({
            collection: collection,
            cookieJar: cookieJarPath
        }, function (err, summary) {
            expect(err).to.be.null;

            expect(summary.run.executions[0].response.cookies.reference).to.be.empty;
            // existing cookie
            expect(summary.run.executions[0].request.headers.get('cookie')).to.match(/foo2=baz;/);
            // new cookie
            expect(summary.run.executions[0].request.headers.get('cookie')).to.match(/foo=bar;/);

            done();
        });
    });

    describe('export cookieJar', function () {
        var outDir = 'out',
            exportedCookieJarPath = path.join(__dirname, '..', '..', outDir, 'test-cookie-jar.json');

        beforeEach(function () {
            sh.test('-d', outDir) && sh.rm('-rf', outDir);
            sh.mkdir('-p', outDir);
        });

        afterEach(function () {
            sh.rm('-rf', outDir);
        });

        it('should export cookie jar to a file', function (done) {
            newman.run({
                collection: collection,
                exportCookieJar: exportedCookieJarPath
            }, function (err, summary) {
                expect(err).to.be.null;

                var exportedCookieJar,
                    cookies;

                try { exportedCookieJar = CookieJar.fromJSON(fs.readFileSync(exportedCookieJarPath).toString()); }
                catch (e) { console.error(e); }

                expect(summary.run.executions[0].response.cookies.reference).to.be.empty;
                expect(summary.run.executions[0].request.headers.get('cookie')).to.match(/foo=bar;/);

                expect(exportedCookieJar).to.be.ok;

                cookies = exportedCookieJar.getCookieStringSync('http://postman-echo.com/');

                expect(cookies).to.match(/foo=bar;/);

                done();
            });
        });
    });
});
