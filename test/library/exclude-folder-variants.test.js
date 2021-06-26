describe('exclude folder variants', function () {
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

    it('should exclude the specified request in case folder name is valid', function (done) {
        newman.run({
            collection: collection,
            excludeFolder: 'R1'
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.stats.iterations.total, 'should have 1 iteration').to.equal(1);
            expect(summary.run.executions, 'should have 2 executions').to.have.lengthOf(2);
            expect(summary.run.executions.map((e) => { return e.item.name; })).to.eql(['R2', 'R3']);
            done();
        });
    });

    it('should not affect the collection run in case folder name is invalid', function (done) {
        newman.run({
            collection: collection,
            excludeFolder: 'R123'
        }, function (err, summary) {
            expect(err).to.be.null;
            expect(summary.run.stats.iterations.total, 'should have 1 iteration').to.equal(1);
            expect(summary.run.executions, 'should have 3 executions').to.have.lengthOf(3);
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
