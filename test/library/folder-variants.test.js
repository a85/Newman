describe('folder variants', function () {
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

    it('should run the specified request in case folder name is valid', function (done) {
        newman.run({
            collection: collection,
            folder: 'R1'
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.stats.iterations.total, 'should have 1 iteration').to.equal(1);
            expect(summary.run.executions, 'should have 1 executions').to.have.lengthOf(1);
            expect(summary.run.executions.map((e) => { return e.item.name; })).to.eql(['R1']);
            done();
        });
    });

    it('should not preserve the order if not specified', function (done) {
        newman.run({
            collection: collection,
            folder: ['R3', 'R1']
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.executions.map((e) => { return e.item.name; })).to.eql(['R1', 'R3']);
            done();
        });
    });

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('should preserve the order if specified', function (done) {
        newman.run({
            collection: collection,
            folder: ['R3', 'R1'],
            preserveOrder: true
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.executions.map((e) => { return e.item.name; })).to.eql(['R3', 'R1']);
            done();
        });
    });

    it('should skip the collection run in case folder name is invalid', function (done) {
        newman.run({
            collection: collection,
            folder: 'R123'
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.stats.iterations.total, 'should have 0 iteration').to.equal(0);
            expect(summary.run.executions, 'should have 0 executions').to.have.lengthOf(0);
            done();
        });
    });

    it('should run the specified requests in case multiple folder names are passed', function (done) {
        newman.run({
            collection: collection,
            folder: ['R1', 'R3']
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.stats.iterations.total, 'should have 1 iteration').to.equal(1);
            expect(summary.run.executions, 'should have 2 executions').to.have.lengthOf(2);
            expect(summary.run.executions.map((e) => { return e.item.name; })).to.eql(['R1', 'R3']);
            done();
        });
    });

    it('should skip the collection run in case any of the folder name is invalid', function (done) {
        newman.run({
            collection: collection,
            folder: ['R1', 'R123']
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.stats.iterations.total, 'should have 0 iteration').to.equal(0);
            expect(summary.run.executions, 'should have 0 executions').to.have.lengthOf(0);
            done();
        });
    });
});
